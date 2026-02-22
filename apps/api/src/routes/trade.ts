/**
 * Trade Routes
 * @module @stock-assist/api/routes/trade
 */

import { Router, Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { Trade } from '../models';
import { validate } from '../middleware/validate';
import { tradeCreateBody, tradeUpdateBody, idParam } from '../middleware/schemas';
import { NotFoundError } from '../middleware/errors';

export const tradeRouter = Router();

// In-memory fallback for Demo Mode
const demoTrades: any[] = [
    {
        _id: 'demo-1',
        symbol: 'RELIANCE',
        direction: 'LONG',
        entryPrice: 1420,
        quantity: 10,
        status: 'OPEN',
        entryDate: new Date(Date.now() - 86400000).toISOString(),
    }
];

/** GET /api/trade - Get all trades (paginated) */
tradeRouter.get('/', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const page = Math.max(1, parseInt(req.query.page as string) || 1);
        const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
        const skip = (page - 1) * limit;

        if (mongoose.connection.readyState !== 1) {
            const paginated = demoTrades.slice(skip, skip + limit);
            return res.json({ success: true, trades: paginated, total: demoTrades.length, page, limit, mode: 'demo' });
        }

        const [trades, total] = await Promise.all([
            Trade.find().sort({ entryDate: -1 }).skip(skip).limit(limit),
            Trade.countDocuments(),
        ]);
        res.json({ success: true, trades, total, page, limit });
    } catch (error) {
        next(error);
    }
});

/** POST /api/trade - Create new trade */
tradeRouter.post('/', validate({ body: tradeCreateBody }), async (req: Request, res: Response, next: NextFunction) => {
    try {
        if (mongoose.connection.readyState !== 1) {
            const newTrade = { ...req.body, _id: `demo-${Date.now()}`, entryDate: new Date() };
            demoTrades.unshift(newTrade);
            if (demoTrades.length > 50) demoTrades.pop();
            return res.json({ success: true, trade: newTrade, mode: 'demo' });
        }
        const trade = new Trade(req.body);
        await trade.save();
        res.json({ success: true, trade });
    } catch (error) {
        next(error);
    }
});

/** PUT /api/trade/:id - Update trade (close) */
tradeRouter.put('/:id', validate({ params: idParam, body: tradeUpdateBody }), async (req: Request, res: Response, next: NextFunction) => {
    try {
        if (mongoose.connection.readyState !== 1) {
            const index = demoTrades.findIndex(t => t._id === req.params.id);
            if (index === -1) throw new NotFoundError('Trade');

            const trade = { ...demoTrades[index], ...req.body };
            if (trade.exitPrice && trade.entryPrice) {
                const pnl = trade.direction === 'LONG'
                    ? (trade.exitPrice - trade.entryPrice) * (trade.quantity || 0)
                    : (trade.entryPrice - trade.exitPrice) * (trade.quantity || 0);
                trade.profitLoss = pnl;
                trade.profitLossPercent = (pnl / ((trade.entryPrice || 1) * (trade.quantity || 1))) * 100;
                trade.status = 'CLOSED';
                trade.exitDate = new Date();
            }
            demoTrades[index] = trade;
            return res.json({ success: true, trade, mode: 'demo' });
        }

        const trade = await Trade.findByIdAndUpdate(req.params.id, req.body, { new: true });
        if (!trade) throw new NotFoundError('Trade');

        if (trade.exitPrice && trade.entryPrice) {
            const pnl = trade.direction === 'LONG'
                ? (trade.exitPrice - trade.entryPrice) * (trade.quantity || 0)
                : (trade.entryPrice - trade.exitPrice) * (trade.quantity || 0);

            trade.profitLoss = pnl;
            trade.profitLossPercent = (pnl / ((trade.entryPrice || 1) * (trade.quantity || 1))) * 100;
            trade.status = 'CLOSED';
            trade.exitDate = new Date();
            await trade.save();
        }

        res.json({ success: true, trade });
    } catch (error) {
        next(error);
    }
});

/** DELETE /api/trade/:id - Delete trade */
tradeRouter.delete('/:id', validate({ params: idParam }), async (req: Request, res: Response, next: NextFunction) => {
    try {
        if (mongoose.connection.readyState !== 1) {
            const index = demoTrades.findIndex(t => t._id === req.params.id);
            if (index !== -1) demoTrades.splice(index, 1);
            return res.json({ success: true, mode: 'demo' });
        }
        await Trade.findByIdAndDelete(req.params.id);
        res.json({ success: true });
    } catch (error) {
        next(error);
    }
});
