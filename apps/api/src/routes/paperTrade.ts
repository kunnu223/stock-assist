/**
 * Paper Trade Routes — auto paper trading portfolio
 * @module @stock-assist/api/routes/paperTrade
 */

import { Router, Request, Response, NextFunction } from 'express';
import { PaperTrade, PaperTradeStatus } from '../models/PaperTrade';
import { syncPaperTrades, getPortfolioSummary, updateUnrealizedPnl } from '../services/paperTrading';

export const paperTradeRouter = Router();

/**
 * GET /api/paper-trade — List paper trades with optional filters
 * Query: ?status=OPEN&symbol=RELIANCE&limit=50
 */
paperTradeRouter.get('/', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { status, symbol, limit = '50' } = req.query;
        const filter: Record<string, any> = {};

        if (status) filter.status = status;
        if (symbol) filter.symbol = (symbol as string).toUpperCase();

        const trades = await PaperTrade.find(filter)
            .sort({ createdAt: -1 })
            .limit(Math.min(Number(limit), 200))
            .lean();

        res.json({ success: true, count: trades.length, trades });
    } catch (error) {
        next(error);
    }
});

/**
 * GET /api/paper-trade/portfolio — Portfolio summary (total P&L, win rate, etc.)
 */
paperTradeRouter.get('/portfolio', async (_req: Request, res: Response, next: NextFunction) => {
    try {
        const summary = await getPortfolioSummary();
        res.json({ success: true, portfolio: summary });
    } catch (error) {
        next(error);
    }
});

/**
 * GET /api/paper-trade/pnl-curve — Daily P&L curve for charting
 */
paperTradeRouter.get('/pnl-curve', async (_req: Request, res: Response, next: NextFunction) => {
    try {
        const closedTrades = await PaperTrade.find({
            status: { $ne: PaperTradeStatus.OPEN },
            exitDate: { $exists: true },
        })
            .sort({ exitDate: 1 })
            .lean();

        let cumPnl = 0;
        const curve = closedTrades.map(t => {
            cumPnl += t.realizedPnl || 0;
            return {
                date: t.exitDate,
                symbol: t.symbol,
                pnl: t.realizedPnl || 0,
                cumulativePnl: Number(cumPnl.toFixed(2)),
                direction: t.direction,
                status: t.status,
            };
        });

        res.json({ success: true, count: curve.length, curve });
    } catch (error) {
        next(error);
    }
});

/**
 * POST /api/paper-trade/sync — Sync paper trades with resolved signals
 */
paperTradeRouter.post('/sync', async (_req: Request, res: Response, next: NextFunction) => {
    try {
        const result = await syncPaperTrades();
        res.json({ success: true, ...result });
    } catch (error) {
        next(error);
    }
});

/**
 * POST /api/paper-trade/update-prices — Update unrealized P&L with current prices
 * Body: { prices: { "RELIANCE": 1450.5, "TCS": 3200 } }
 */
paperTradeRouter.post('/update-prices', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { prices } = req.body;
        if (!prices || typeof prices !== 'object') {
            res.status(400).json({ success: false, error: 'prices object is required' });
            return;
        }
        const updated = await updateUnrealizedPnl(prices);
        res.json({ success: true, updated });
    } catch (error) {
        next(error);
    }
});
