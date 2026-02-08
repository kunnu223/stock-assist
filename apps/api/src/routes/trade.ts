/**
 * Trade Routes
 * @module @stock-assist/api/routes/trade
 */

import { Router, Request, Response } from 'express';
import mongoose from 'mongoose';
import { Trade } from '../models';

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

/** GET /api/trade - Get all trades */
tradeRouter.get('/', async (_req: Request, res: Response) => {
    try {
        if (mongoose.connection.readyState !== 1) {
            return res.json({ success: true, trades: demoTrades, mode: 'demo' });
        }
        const trades = await Trade.find().sort({ entryDate: -1 }).limit(100);
        res.json({ success: true, trades });
    } catch (error) {
        res.status(500).json({ success: false, error: String(error) });
    }
});

/** POST /api/trade - Create new trade */
tradeRouter.post('/', async (req: Request, res: Response) => {
    try {
        if (mongoose.connection.readyState !== 1) {
            const newTrade = { ...req.body, _id: `demo-${Date.now()}`, entryDate: new Date() };
            demoTrades.unshift(newTrade);
            if (demoTrades.length > 50) demoTrades.pop(); // Prevent memory issues
            return res.json({ success: true, trade: newTrade, mode: 'demo' });
        }
        const trade = new Trade(req.body);
        await trade.save();
        res.json({ success: true, trade });
    } catch (error) {
        res.status(500).json({ success: false, error: String(error) });
    }
});

/** PUT /api/trade/:id - Update trade (close) */
tradeRouter.put('/:id', async (req: Request, res: Response) => {
    try {
        if (mongoose.connection.readyState !== 1) {
            const index = demoTrades.findIndex(t => t._id === req.params.id);
            if (index === -1) return res.status(404).json({ success: false, error: 'Trade not found' });

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
        if (!trade) return res.status(404).json({ success: false, error: 'Trade not found' });

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
        res.status(500).json({ success: false, error: String(error) });
    }
});

/** DELETE /api/trade/:id - Delete trade */
tradeRouter.delete('/:id', async (req: Request, res: Response) => {
    try {
        if (mongoose.connection.readyState !== 1) {
            const index = demoTrades.findIndex(t => t._id === req.params.id);
            if (index !== -1) demoTrades.splice(index, 1);
            return res.json({ success: true, mode: 'demo' });
        }
        await Trade.findByIdAndDelete(req.params.id);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, error: String(error) });
    }
});
