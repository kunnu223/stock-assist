/**
 * API Entry Point
 * @module @stock-assist/api
 */

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import helmet from 'helmet';
import compression from 'compression';
import { connectDB } from './config/db';
import { logger } from './config/logger';
import { analyzeRouter } from './routes/analyze';
import { tradeRouter } from './routes/trade';
import { watchlistRouter } from './routes/watchlist';
import { analyticsRouter } from './routes/analytics';
import { backtestRouter } from './routes/backtest';
import stocksRouter from './routes/stocks';
import { commodityRouter } from './routes/commodity';
import { journalRouter } from './routes/journal';
import { requestIdMiddleware } from './middleware/requestId';
import { generalLimiter } from './middleware/rateLimiter';
import { errorHandler } from './middleware/errors';
import { responseTimeMiddleware } from './middleware/responseTime';
import { cache } from './services/cache';
import { metricsRouter } from './routes/metrics';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

// ═══════════════════════════════════════════════════════════════
// SECURITY & INFRASTRUCTURE MIDDLEWARE
// ═══════════════════════════════════════════════════════════════

// Security headers
app.use(helmet());

// Request ID for tracing
app.use(requestIdMiddleware);

// Gzip compression
app.use(compression());

// Response time tracking
app.use(responseTimeMiddleware);

// CORS Configuration
const allowedOrigins = [
    'http://localhost:3000',
    process.env.FRONTEND_URL
].filter(Boolean);

app.use(cors({
    origin: (origin, callback) => {
        if (!origin) return callback(null, true);
        if (allowedOrigins.indexOf(origin) !== -1 || !process.env.FRONTEND_URL) {
            callback(null, true);
        } else {
            logger.warn({ origin }, 'Blocked by CORS');
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true
}));

app.use(express.json({ limit: '1mb' }));

// Rate limiting
app.use(generalLimiter);

// Request logging
app.use((req, _res, next) => {
    logger.info({ method: req.method, url: req.originalUrl || req.url, requestId: (req as any).requestId }, 'Incoming request');
    next();
});

// ═══════════════════════════════════════════════════════════════
// ROUTES
// ═══════════════════════════════════════════════════════════════

// Health check (enhanced)
app.get('/health', (_req: express.Request, res: express.Response) => {
    const memUsage = process.memoryUsage();
    res.json({
        success: true,
        status: 'ok',
        timestamp: new Date().toISOString(),
        mode: process.env.MONGODB_URI ? 'production' : 'demo',
        uptime: Math.round(process.uptime()),
        memory: {
            rss: Math.round(memUsage.rss / 1024 / 1024),
            heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
            heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
        },
        cache: cache.getStats(),
    });
});

// Modular Routes
app.use('/api/analyze', analyzeRouter);
app.use('/api/trade', tradeRouter);
app.use('/api/watchlist', watchlistRouter);
app.use('/api/analytics', analyticsRouter);
app.use('/api/backtest', backtestRouter);
app.use('/api/stocks', stocksRouter);
app.use('/api/analyze/commodity', commodityRouter);
app.use('/api/journal', journalRouter);
app.use('/metrics', metricsRouter);

// ═══════════════════════════════════════════════════════════════
// GLOBAL ERROR HANDLER (must be LAST middleware)
// ═══════════════════════════════════════════════════════════════
app.use(errorHandler);

/**
 * Start Server
 */
const start = async () => {
    try {
        if (process.env.MONGODB_URI) {
            await connectDB().catch(err => {
                logger.error({ err }, 'Database connection failed. Falling back to partial mode.');
            });
        } else {
            logger.warn('MONGODB_URI not found. Data persistence disabled.');
        }

        const server = app.listen(PORT, () => {
            logger.info({ port: PORT }, `API Server running on http://localhost:${PORT}`);
            logger.info('Endpoints active: /api/analyze, /api/analyze/commodity, /api/trade, /api/watchlist, /api/analytics, /api/backtest, /metrics');
        });

        // Graceful shutdown
        const shutdown = async (signal: string) => {
            logger.info({ signal }, 'Shutdown signal received — draining connections');
            server.close(async () => {
                logger.info('HTTP server closed');
                cache.flush();
                try {
                    const mongoose = await import('mongoose');
                    await mongoose.default.connection.close();
                    logger.info('Database connection closed');
                } catch { /* no-op if DB not connected */ }
                process.exit(0);
            });

            // Force exit after 10s
            setTimeout(() => {
                logger.error('Forced shutdown after 10s timeout');
                process.exit(1);
            }, 10000);
        };

        process.on('SIGTERM', () => shutdown('SIGTERM'));
        process.on('SIGINT', () => shutdown('SIGINT'));
    } catch (error) {
        logger.fatal({ err: error }, 'Critical startup error');
        process.exit(1);
    }
};

start();
