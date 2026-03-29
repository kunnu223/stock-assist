/**
 * Stocks API Routes (Enhanced)
 * Endpoints for fetching top stocks screened from NIFTY 100
 * and stock chart (OHLC) data.
 */

import express, { Request, Response, NextFunction } from 'express';
import { SCREENING_UNIVERSE } from '@stock-assist/shared';
import { getTodayTopStocks, getYesterdayTopStocks } from '../services/screening/topStocks';
import { fetchHistory } from '../services/data/yahooHistory';
import { screeningLimiter } from '../middleware/rateLimiter';
import { logger } from '../config/logger';

const router = express.Router();

/**
 * GET /api/stocks/top-10
 * Get today's top 10 stocks (cached daily)
 */
router.get('/top-10', async (req: Request, res: Response, next: NextFunction) => {
    try {
        logger.info('GET /api/stocks/top-10');

        let stocks = await getTodayTopStocks(false);
        let isFallback = false;

        if (stocks.length === 0) {
            logger.warn('No stocks for today, falling back to yesterday');
            stocks = await getYesterdayTopStocks();
            isFallback = true;
        }

        if (stocks.length === 0) {
            return res.status(503).json({
                error: 'Unable to fetch top stocks',
                message: 'No stocks available. Please try refreshing.',
            });
        }

        const avgConfidence = Math.round(
            stocks.reduce((sum, s) => sum + s.confidence, 0) / stocks.length
        );

        res.json({
            success: true,
            stocks,
            count: stocks.length,
            totalScanned: SCREENING_UNIVERSE.length,
            updatedAt: stocks[0]?.updatedAt || new Date(),
            metadata: {
                cached: true,
                isFallback,
                avgConfidence,
                signalPersistence: {
                    age3: stocks.filter(s => s.signalAge === 3).length,
                    age2: stocks.filter(s => s.signalAge === 2).length,
                    age1: stocks.filter(s => s.signalAge === 1).length,
                },
                directionSplit: {
                    bullish: stocks.filter(s => s.direction === 'bullish').length,
                    bearish: stocks.filter(s => s.direction === 'bearish').length,
                },
            },
        });
    } catch (error) {
        next(error);
    }
});

/**
 * POST /api/stocks/top-10/refresh
 * Force refresh today's top stocks (screens all 100 stocks)
 */
router.post('/top-10/refresh', screeningLimiter, async (req: Request, res: Response, next: NextFunction) => {
    try {
        logger.info({ totalStocks: SCREENING_UNIVERSE.length }, 'POST /api/stocks/top-10/refresh — Screening stocks');
        const startTime = Date.now();

        const stocks = await getTodayTopStocks(true);

        if (stocks.length === 0) {
            return res.status(503).json({
                error: 'Analysis failed',
                message: 'Unable to analyze stocks at this time. Please try again later.',
            });
        }

        const scanDuration = ((Date.now() - startTime) / 1000).toFixed(1);
        const avgConfidence = Math.round(
            stocks.reduce((sum, s) => sum + s.confidence, 0) / stocks.length
        );

        res.json({
            success: true,
            stocks,
            count: stocks.length,
            totalScanned: SCREENING_UNIVERSE.length,
            updatedAt: new Date(),
            message: `Screened ${SCREENING_UNIVERSE.length} stocks → selected top ${stocks.length}`,
            metadata: {
                cached: false,
                scanDuration: `${scanDuration}s`,
                avgConfidence,
                signalPersistence: {
                    age3: stocks.filter(s => s.signalAge === 3).length,
                    age2: stocks.filter(s => s.signalAge === 2).length,
                    age1: stocks.filter(s => s.signalAge === 1).length,
                },
                directionSplit: {
                    bullish: stocks.filter(s => s.direction === 'bullish').length,
                    bearish: stocks.filter(s => s.direction === 'bearish').length,
                },
            },
        });
    } catch (error) {
        next(error);
    }
});

/**
 * GET /api/stocks/chart
 * Fetch OHLC chart data for a given symbol and range.
 * Query params: symbol (required), range (default: 3mo)
 */
const VALID_RANGES = ['1mo', '3mo', '6mo', '1y', '2y'];

router.get('/chart', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const symbol = (req.query.symbol as string || '').trim().toUpperCase();
        const range = (req.query.range as string || '3mo').trim();

        if (!symbol) {
            return res.status(400).json({ success: false, error: 'Symbol is required' });
        }
        if (!VALID_RANGES.includes(range)) {
            return res.status(400).json({ success: false, error: `Invalid range. Valid: ${VALID_RANGES.join(', ')}` });
        }

        logger.info({ symbol, range }, 'GET /api/stocks/chart');

        // Use weekly interval for ranges > 6mo, daily otherwise
        const interval = range === '1y' || range === '2y' ? '1wk' : '1d';
        const data = await fetchHistory(symbol, range, interval);

        if (data.length === 0) {
            return res.status(404).json({ success: false, error: `No chart data found for ${symbol}` });
        }

        res.json({
            success: true,
            symbol,
            data,
            range,
            interval,
        });
    } catch (error) {
        next(error);
    }
});

export default router;
