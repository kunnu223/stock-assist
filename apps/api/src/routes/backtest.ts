/**
 * Backtest Routes
 * @module @stock-assist/api/routes/backtest
 * 
 * Provides endpoints to track and validate AI prediction accuracy.
 * This is critical for probability calibration and system improvement.
 */

import { Router, Request, Response } from 'express';
import mongoose from 'mongoose';
import { Prediction, PredictionStatus } from '../models';
import {
    savePrediction,
    checkPredictions,
    getAccuracyStats,
    getCalibrationData,
    getPromptAdjustments,
    getCalibrationSummary
} from '../services/backtest';

export const backtestRouter = Router();

// Middleware to check DB connection
const requireDB = (req: Request, res: Response, next: any) => {
    if (mongoose.connection.readyState !== 1) {
        return res.json({
            success: true,
            warning: 'Demo Mode: Database not connected',
            predictions: [],
            stats: { totalClosed: 0, winRate: 0, netPnL: 0 },
            calibration: [],
            ready: false
        });
    }
    next();
};

/**
 * POST /api/backtest/predictions
 * Save a new prediction from analysis for tracking
 */
backtestRouter.post('/predictions', async (req: Request, res: Response) => {
    try {
        const { analysis } = req.body;

        if (!analysis) {
            return res.status(400).json({
                success: false,
                error: 'Analysis object required'
            });
        }

        const prediction = await savePrediction(analysis);

        if (!prediction) {
            return res.json({
                success: true,
                message: 'Prediction not saved (neutral bias or missing data)',
                saved: false
            });
        }

        console.log(`[Backtest] ✅ Saved prediction for ${prediction.symbol} (${prediction.bias})`);

        res.json({
            success: true,
            saved: true,
            prediction: {
                id: prediction._id,
                symbol: prediction.symbol,
                bias: prediction.bias,
                entryPrice: prediction.entryPrice,
                targetPrice: prediction.targetPrice,
                stopLoss: prediction.stopLoss,
                status: prediction.status
            }
        });
    } catch (error) {
        console.error('[Backtest] ❌ Error saving prediction:', error);
        res.status(500).json({
            success: false,
            error: String(error)
        });
    }
});

/**
 * POST /api/backtest/check
 * Check all pending predictions against current market data
 */
backtestRouter.post('/check', async (_req: Request, res: Response) => {
    try {
        console.log('[Backtest] Checking pending predictions...');
        const result = await checkPredictions();

        console.log(`[Backtest] ✅ Checked ${result.total} predictions, updated ${result.updated}`);

        res.json({
            success: true,
            checked: result.total,
            updated: result.updated,
            message: `Checked ${result.total} pending predictions, ${result.updated} outcomes determined`
        });
    } catch (error) {
        console.error('[Backtest] ❌ Error checking predictions:', error);
        res.status(500).json({
            success: false,
            error: String(error)
        });
    }
});

/**
 * GET /api/backtest/stats
 * Get accuracy statistics from tracked predictions
 */
backtestRouter.get('/stats', async (_req: Request, res: Response) => {
    try {
        if (mongoose.connection.readyState !== 1) {
            return res.json({
                success: true,
                stats: { totalClosed: 0, winRate: 0, netPnL: 0 },
                insights: ['Demo Mode: Database not connected'],
                recentPredictions: [],
                calibrationReady: false
            });
        }
        const stats = await getAccuracyStats();

        // Get recent predictions for context
        const recentPredictions = await Prediction.find()
            .sort({ date: -1 })
            .limit(10)
            .lean();

        // Calculate additional insights
        const insights: string[] = [];

        if (stats.totalClosed >= 30) {
            if (stats.winRate >= 55) {
                insights.push(`🏆 Win rate ${stats.winRate.toFixed(1)}% exceeds 55% target`);
            } else {
                insights.push(`⚠️ Win rate ${stats.winRate.toFixed(1)}% below 55% target - review AI prompts`);
            }

            if (stats.netPnL > 0) {
                insights.push(`📈 Net P&L positive (${stats.netPnL.toFixed(2)}%)`);
            } else {
                insights.push(`📉 Net P&L negative (${stats.netPnL.toFixed(2)}%) - adjust thresholds`);
            }
        } else {
            insights.push(`📊 Need ${30 - stats.totalClosed} more closed predictions for reliable stats`);
        }

        res.json({
            success: true,
            stats: {
                totalClosed: stats.totalClosed,
                targetHits: stats.targetHits,
                stopHits: stats.stopHits,
                winRate: stats.winRate.toFixed(1),
                netPnL: stats.netPnL.toFixed(2)
            },
            insights,
            recentPredictions: recentPredictions.map(p => ({
                symbol: p.symbol,
                date: p.date,
                bias: p.bias,
                status: p.status,
                pnlPercent: p.pnlPercent?.toFixed(2)
            })),
            calibrationReady: stats.totalClosed >= 30
        });
    } catch (error) {
        console.error('[Backtest] ❌ Error getting stats:', error);
        res.status(500).json({
            success: false,
            error: String(error)
        });
    }
});

/**
 * GET /api/backtest/pending
 * Get all pending predictions
 */
backtestRouter.get('/pending', async (_req: Request, res: Response) => {
    try {
        if (mongoose.connection.readyState !== 1) {
            return res.json({ success: true, count: 0, predictions: [] });
        }
        const pending = await Prediction.find({ status: PredictionStatus.PENDING })
            .sort({ date: -1 })
            .lean();

        res.json({
            success: true,
            count: pending.length,
            predictions: pending.map(p => ({
                id: p._id,
                symbol: p.symbol,
                date: p.date,
                bias: p.bias,
                confidence: p.confidence,
                entryPrice: p.entryPrice,
                targetPrice: p.targetPrice,
                stopLoss: p.stopLoss,
                timeHorizon: p.timeHorizon
            }))
        });
    } catch (error) {
        console.error('[Backtest] ❌ Error getting pending:', error);
        res.status(500).json({
            success: false,
            error: String(error)
        });
    }
});

/**
 * GET /api/backtest/history
 * Get prediction history with filters
 */
backtestRouter.get('/history', async (req: Request, res: Response) => {
    try {
        if (mongoose.connection.readyState !== 1) {
            return res.json({ success: true, count: 0, predictions: [] });
        }
        const { status, symbol, limit = '50' } = req.query;

        const query: any = {};
        if (status) query.status = status;
        if (symbol) query.symbol = (symbol as string).toUpperCase();

        const predictions = await Prediction.find(query)
            .sort({ date: -1 })
            .limit(parseInt(limit as string))
            .lean();

        res.json({
            success: true,
            count: predictions.length,
            predictions: predictions.map(p => ({
                id: p._id,
                symbol: p.symbol,
                date: p.date,
                bias: p.bias,
                confidence: p.confidence,
                confidenceScore: p.confidenceScore,
                entryPrice: p.entryPrice,
                targetPrice: p.targetPrice,
                stopLoss: p.stopLoss,
                status: p.status,
                outcomeDate: p.outcomeDate,
                outcomePrice: p.outcomePrice,
                pnlPercent: p.pnlPercent?.toFixed(2),
                accuracyScore: p.accuracyScore
            }))
        });
    } catch (error) {
        console.error('[Backtest] ❌ Error getting history:', error);
        res.status(500).json({
            success: false,
            error: String(error)
        });
    }
});

/**
 * GET /api/backtest/calibration
 * Get probability calibration data (predicted vs actual win rates)
 */
backtestRouter.get('/calibration', async (_req: Request, res: Response) => {
    try {
        if (mongoose.connection.readyState !== 1) {
            return res.json({ success: true, ready: false, message: 'Demo Mode: DB not connected' });
        }
        // Get all closed predictions grouped by consistency score ranges
        const closed = await Prediction.find({
            status: { $ne: PredictionStatus.PENDING }
        }).lean();

        if (closed.length < 30) {
            return res.json({
                success: true,
                ready: false,
                message: `Need ${30 - closed.length} more closed predictions for calibration`,
                currentCount: closed.length
            });
        }

        // Group by confidence score ranges
        const ranges: Record<string, { predictions: any[], wins: number, total: number }> = {
            '50-60': { predictions: [], wins: 0, total: 0 },
            '60-70': { predictions: [], wins: 0, total: 0 },
            '70-80': { predictions: [], wins: 0, total: 0 },
            '80-90': { predictions: [], wins: 0, total: 0 },
            '90-100': { predictions: [], wins: 0, total: 0 }
        };

        for (const pred of closed) {
            const score = pred.confidenceScore || 50;
            let range = '50-60';

            if (score >= 90) range = '90-100';
            else if (score >= 80) range = '80-90';
            else if (score >= 70) range = '70-80';
            else if (score >= 60) range = '60-70';

            ranges[range].predictions.push(pred);
            ranges[range].total++;
            if (pred.status === PredictionStatus.TARGET_HIT) {
                ranges[range].wins++;
            }
        }

        // Calculate calibration data
        const calibration = Object.entries(ranges).map(([range, data]) => {
            const midpoint = parseInt(range.split('-')[0]) + 5;
            const actualWinRate = data.total > 0 ? (data.wins / data.total) * 100 : 0;
            const deviation = actualWinRate - midpoint;

            return {
                range,
                predicted: midpoint,
                actual: Math.round(actualWinRate * 10) / 10,
                sampleSize: data.total,
                deviation: Math.round(deviation * 10) / 10,
                status: Math.abs(deviation) <= 10 ? 'CALIBRATED' :
                    deviation > 10 ? 'OVERCONFIDENT' : 'UNDERCONFIDENT'
            };
        }).filter(c => c.sampleSize > 0);

        // Generate recommendations
        const recommendations: string[] = [];
        for (const cal of calibration) {
            if (cal.status === 'OVERCONFIDENT') {
                recommendations.push(`Reduce confidence for ${cal.range}% predictions (actual: ${cal.actual}%)`);
            } else if (cal.status === 'UNDERCONFIDENT') {
                recommendations.push(`Increase confidence for ${cal.range}% predictions (actual: ${cal.actual}%)`);
            }
        }

        res.json({
            success: true,
            ready: true,
            totalSamples: closed.length,
            calibration,
            recommendations,
            summary: {
                wellCalibrated: calibration.filter(c => c.status === 'CALIBRATED').length,
                overconfident: calibration.filter(c => c.status === 'OVERCONFIDENT').length,
                underconfident: calibration.filter(c => c.status === 'UNDERCONFIDENT').length
            }
        });
    } catch (error) {
        console.error('[Backtest] ❌ Error getting calibration:', error);
        res.status(500).json({
            success: false,
            error: String(error)
        });
    }
});

/**
 * GET /api/backtest/calibration/detailed
 * Get detailed calibration data using the calibration service
 */
backtestRouter.get('/calibration/detailed', async (_req: Request, res: Response) => {
    try {
        const calibration = await getCalibrationData();
        const summary = await getCalibrationSummary();

        console.log(`[Backtest] 📊 ${summary}`);

        res.json({
            success: true,
            ...calibration,
            summary
        });
    } catch (error) {
        console.error('[Backtest] ❌ Error getting detailed calibration:', error);
        res.status(500).json({
            success: false,
            error: String(error)
        });
    }
});

/**
 * GET /api/backtest/prompt-adjustments
 * Get recommended AI prompt adjustments based on calibration
 */
backtestRouter.get('/prompt-adjustments', async (_req: Request, res: Response) => {
    try {
        const adjustments = await getPromptAdjustments();
        const calibration = await getCalibrationData();

        res.json({
            success: true,
            ...adjustments,
            calibrationReady: calibration.ready,
            overallAccuracy: calibration.overallAccuracy,
            totalSamples: calibration.totalSamples
        });
    } catch (error) {
        console.error('[Backtest] ❌ Error getting prompt adjustments:', error);
        res.status(500).json({
            success: false,
            error: String(error)
        });
    }
});

/**
 * GET /api/backtest/summary
 * Get a quick calibration summary for logging/display
 */
backtestRouter.get('/summary', async (_req: Request, res: Response) => {
    try {
        const summary = await getCalibrationSummary();
        const stats = await getAccuracyStats();

        res.json({
            success: true,
            summary,
            quickStats: {
                winRate: stats.winRate.toFixed(1) + '%',
                totalClosed: stats.totalClosed,
                netPnL: stats.netPnL.toFixed(2) + '%'
            }
        });
    } catch (error) {
        console.error('[Backtest] ❌ Error getting summary:', error);
        res.status(500).json({
            success: false,
            error: String(error)
        });
    }
});
