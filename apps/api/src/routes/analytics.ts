/**
 * Analytics Routes
 * @module @stock-assist/api/routes/analytics
 */

import { Router, Request, Response } from 'express';
import { Trade } from '../models';
import { calcWinRate, calcProfitFactor } from '@stock-assist/shared';
import { getAccuracyStats, savePrediction, checkPredictions } from '../services/backtest';

export const analyticsRouter = Router();

/** GET /api/analytics - Get performance stats */
analyticsRouter.get('/', async (_req: Request, res: Response) => {
    try {
        const trades = await Trade.find({ status: 'CLOSED' });
        const aiStats = await getAccuracyStats();

        const wins = trades.filter((t: any) => (t.profitLoss || 0) > 0);
        const losses = trades.filter((t: any) => (t.profitLoss || 0) < 0);
        const totalPnL = trades.reduce((sum: number, t: any) => sum + (t.profitLoss || 0), 0);
        const grossWins = wins.reduce((sum: number, t: any) => sum + (t.profitLoss || 0), 0);
        const grossLosses = Math.abs(losses.reduce((sum: number, t: any) => sum + (t.profitLoss || 0), 0));

        // existing logic for pattern stats...
        const patternMap = new Map<string, { wins: number; losses: number; pnl: number }>();
        trades.forEach((t: any) => {
            const p = t.pattern || 'unknown';
            const stats = patternMap.get(p) || { wins: 0, losses: 0, pnl: 0 };
            if ((t.profitLoss || 0) > 0) stats.wins++; else stats.losses++;
            stats.pnl += t.profitLoss || 0;
            patternMap.set(p, stats);
        });

        const patternStats = Array.from(patternMap.entries()).map(([pattern, s]) => ({
            pattern,
            trades: s.wins + s.losses,
            wins: s.wins, losses: s.losses,
            winRate: calcWinRate(s.wins, s.wins + s.losses),
            totalPnL: Math.round(s.pnl),
        }));

        res.json({
            success: true,
            performance: {
                totalTrades: trades.length,
                wins: wins.length,
                losses: losses.length,
                winRate: calcWinRate(wins.length, trades.length),
                totalPnL: Math.round(totalPnL),
                profitFactor: calcProfitFactor(grossWins, grossLosses),
                patternStats,
                aiAccuracy: aiStats
            },
        });
    } catch (error) {
        res.status(500).json({ success: false, error: String(error) });
    }
});

/** POST /api/analytics/track - Save prediction for tracking */
analyticsRouter.post('/track', async (req: Request, res: Response) => {
    try {
        const prediction = await savePrediction(req.body);
        if (!prediction) {
            return res.status(400).json({ success: false, message: 'Invalid prediction data or NEUTRAL bias' });
        }
        res.json({ success: true, message: 'Prediction saved for tracking', id: prediction._id });
    } catch (error) {
        res.status(500).json({ success: false, error: String(error) });
    }
});

/** POST /api/analytics/check - Trigger accuracy check (Manual backtest) */
analyticsRouter.post('/check', async (_req: Request, res: Response) => {
    try {
        const result = await checkPredictions();
        res.json({ success: true, message: `Checked ${result.total} predictions`, updated: result.updated });
    } catch (error) {
        res.status(500).json({ success: false, error: String(error) });
    }
});
