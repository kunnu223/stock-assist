/**
 * Stocks API Routes (Enhanced)
 * Endpoints for fetching top stocks screened from NIFTY 100
 */

import express, { Request, Response } from 'express';
import { NIFTY_100 } from '@stock-assist/shared';
import { getTodayTopStocks, getYesterdayTopStocks } from '../services/screening/topStocks';

const router = express.Router();

/**
 * GET /api/stocks/top-10
 * Get today's top 10 stocks (cached daily)
 */
router.get('/top-10', async (req: Request, res: Response) => {
    try {
        console.log('📊 GET /api/stocks/top-10');

        let stocks = await getTodayTopStocks(false);
        let isFallback = false;

        // Fallback to yesterday if today's analysis failed
        if (stocks.length === 0) {
            console.log('⚠️ No stocks for today, falling back to yesterday');
            stocks = await getYesterdayTopStocks();
            isFallback = true;
        }

        // If still empty, return error
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
            totalScanned: NIFTY_100.length,
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
    } catch (error: any) {
        console.error('❌ Error fetching top stocks:', error);
        res.status(500).json({
            error: 'Internal server error',
            message: error.message,
        });
    }
});

/**
 * POST /api/stocks/top-10/refresh
 * Force refresh today's top stocks (screens all 100 stocks)
 */
router.post('/top-10/refresh', async (req: Request, res: Response) => {
    try {
        console.log('🔄 POST /api/stocks/top-10/refresh — Screening', NIFTY_100.length, 'stocks...');
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
            totalScanned: NIFTY_100.length,
            updatedAt: new Date(),
            message: `Screened ${NIFTY_100.length} stocks → selected top ${stocks.length}`,
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
    } catch (error: any) {
        console.error('❌ Error refreshing top stocks:', error);
        res.status(500).json({
            error: 'Internal server error',
            message: error.message,
        });
    }
});

export default router;
