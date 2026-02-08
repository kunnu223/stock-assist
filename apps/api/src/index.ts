/**
 * API Entry Point
 * @module @stock-assist/api
 */

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { connectDB } from './config/db';
import { analyzeRouter } from './routes/analyze';
import { tradeRouter } from './routes/trade';
import { watchlistRouter } from './routes/watchlist';
import { analyticsRouter } from './routes/analytics';
import { backtestRouter } from './routes/backtest';
import stocksRouter from './routes/stocks';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

// Middleware
app.use(cors());
app.use(express.json());

// Request logging middleware
app.use((req, res, next) => {
    console.log(`[API] ${req.method} ${req.originalUrl || req.url}`);
    next();
});

// Health check
app.get('/health', (_req: express.Request, res: express.Response) => {
    res.json({
        success: true,
        status: 'ok',
        timestamp: new Date().toISOString(),
        mode: process.env.MONGODB_URI ? 'production' : 'demo'
    });
});

// Modular Routes
app.use('/api/analyze', analyzeRouter);
app.use('/api/trade', tradeRouter);
app.use('/api/watchlist', watchlistRouter);
app.use('/api/analytics', analyticsRouter);
app.use('/api/backtest', backtestRouter);
app.use('/api/stocks', stocksRouter);

/**
 * Start Server
 */
const start = async () => {
    try {
        // Attempt DB connection - wrap in try/catch to stay resilient
        if (process.env.MONGODB_URI) {
            await connectDB().catch(err => {
                console.error('⚠️ Database connection failed. Falling back to partial mode.');
            });
        } else {
            console.warn('⚠️ MONGODB_URI not found. Data persistence disabled.');
        }

        app.listen(PORT, () => {
            console.log(`🚀 API Server running on http://localhost:${PORT}`);
            console.log(`📡 Endpoints active: /api/analyze, /api/trade, /api/watchlist, /api/analytics, /api/backtest`);
        });
    } catch (error) {
        console.error('❌ Critical startup error:', error);
        process.exit(1);
    }
};

start();
