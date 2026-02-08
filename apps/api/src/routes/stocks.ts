/**
 * Stocks API Routes
 * Endpoints for fetching top stocks
 */

import express, { Request, Response } from 'express';
import { getTodayTopStocks, getYesterdayTopStocks } from '../services/screening/topStocks';

const router = express.Router();

/**
 * GET /api/stocks/top-10
 * Get today's top 10 stocks (cached for 1 hour)
 */
router.get('/top-10', async (req: Request, res: Response) => {
    try {
        console.log('📊 GET /api/stocks/top-10');

        let stocks = await getTodayTopStocks(false);

        // Fallback to yesterday if today's analysis failed
        if (stocks.length === 0) {
            console.log('⚠️ No stocks for today, falling back to yesterday');
            stocks = await getYesterdayTopStocks();
        }

        // If still empty, return error
        if (stocks.length === 0) {
            return res.status(503).json({
                error: 'Unable to fetch top stocks',
                message: 'No stocks available. Please try refreshing.',
            });
        }

        res.json({
            success: true,
            stocks,
            count: stocks.length,
            updatedAt: stocks[0]?.updatedAt || new Date(),
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
 * Force refresh today's top stocks
 */
router.post('/top-10/refresh', async (req: Request, res: Response) => {
    try {
        console.log('🔄 POST /api/stocks/top-10/refresh');

        const stocks = await getTodayTopStocks(true);

        if (stocks.length === 0) {
            return res.status(503).json({
                error: 'Analysis failed',
                message: 'Unable to analyze stocks at this time. Please try again later.',
            });
        }

        res.json({
            success: true,
            stocks,
            count: stocks.length,
            updatedAt: new Date(),
            message: 'Successfully refreshed top 10 stocks',
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
