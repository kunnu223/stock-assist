/**
 * Backtest Routes
 * @module @stock-assist/api/routes/backtest
 * 
 * Provides endpoints to track and validate AI prediction accuracy.
 * This is critical for probability calibration and system improvement.
 */

import { Router, Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { Prediction, PredictionStatus } from '../models';
import { SignalRecord, SignalStatus } from '../models/SignalRecord';
import { BacktestResult, BacktestStatus } from '../models/BacktestResult';
import { runWalkForwardBacktest, type BacktestConfig } from '../services/backtest/walkForwardEngine';
import { generateReport, findConditionStacks } from '../services/backtest/backtestReporter';
import { NIFTY_100 } from '@stock-assist/shared';
import {
    savePrediction,
    checkPredictions,
    getAccuracyStats,
    getCalibrationData,
    getPromptAdjustments,
    getCalibrationSummary
} from '../services/backtest';
import { validate } from '../middleware/validate';
import { backtestPredictionBody } from '../middleware/schemas';
import { logger } from '../config/logger';

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
backtestRouter.post('/predictions', validate({ body: backtestPredictionBody }), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { analysis } = req.body;

        const prediction = await savePrediction(analysis);

        if (!prediction) {
            return res.json({
                success: true,
                message: 'Prediction not saved (neutral bias or missing data)',
                saved: false
            });
        }

        logger.info({ symbol: prediction.symbol, bias: prediction.bias }, 'Saved prediction');

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
        next(error);
    }
});

/**
 * POST /api/backtest/check
 * Check all pending predictions against current market data
 */
backtestRouter.post('/check', async (_req: Request, res: Response, next: NextFunction) => {
    try {
        logger.info('Checking pending predictions');
        const result = await checkPredictions();

        logger.info({ total: result.total, updated: result.updated }, 'Prediction check complete');

        res.json({
            success: true,
            checked: result.total,
            updated: result.updated,
            message: `Checked ${result.total} pending predictions, ${result.updated} outcomes determined`
        });
    } catch (error) {
        next(error);
    }
});

/**
 * GET /api/backtest/stats
 * Get accuracy statistics from tracked predictions
 */
backtestRouter.get('/stats', async (_req: Request, res: Response, next: NextFunction) => {
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

        const recentPredictions = await Prediction.find()
            .sort({ date: -1 })
            .limit(10)
            .lean();

        const insights: string[] = [];

        if (stats.totalClosed >= 30) {
            if (stats.winRate >= 55) {
                insights.push(`Win rate ${stats.winRate.toFixed(1)}% exceeds 55% target`);
            } else {
                insights.push(`Win rate ${stats.winRate.toFixed(1)}% below 55% target - review AI prompts`);
            }

            if (stats.netPnL > 0) {
                insights.push(`Net P&L positive (${stats.netPnL.toFixed(2)}%)`);
            } else {
                insights.push(`Net P&L negative (${stats.netPnL.toFixed(2)}%) - adjust thresholds`);
            }
        } else {
            insights.push(`Need ${30 - stats.totalClosed} more closed predictions for reliable stats`);
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
        next(error);
    }
});

/**
 * GET /api/backtest/pending
 * Get all pending predictions
 */
backtestRouter.get('/pending', async (_req: Request, res: Response, next: NextFunction) => {
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
        next(error);
    }
});

/**
 * GET /api/backtest/history
 * Get prediction history with filters
 */
backtestRouter.get('/history', async (req: Request, res: Response, next: NextFunction) => {
    try {
        if (mongoose.connection.readyState !== 1) {
            return res.json({ success: true, count: 0, predictions: [] });
        }
        const { status, symbol, limit = '50' } = req.query;

        const query: any = {};
        if (status) query.status = status;
        if (symbol) query.symbol = (symbol as string).toUpperCase();

        const parsedLimit = Math.min(parseInt(limit as string) || 50, 200);

        const predictions = await Prediction.find(query)
            .sort({ date: -1 })
            .limit(parsedLimit)
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
        next(error);
    }
});

/**
 * GET /api/backtest/calibration
 * Get probability calibration data (predicted vs actual win rates)
 */
backtestRouter.get('/calibration', async (_req: Request, res: Response, next: NextFunction) => {
    try {
        if (mongoose.connection.readyState !== 1) {
            return res.json({ success: true, ready: false, message: 'Demo Mode: DB not connected' });
        }
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
        next(error);
    }
});

/**
 * GET /api/backtest/calibration/detailed
 * Get detailed calibration data using the calibration service
 */
backtestRouter.get('/calibration/detailed', async (_req: Request, res: Response, next: NextFunction) => {
    try {
        const calibration = await getCalibrationData();
        const summary = await getCalibrationSummary();

        logger.info({ summary }, 'Calibration data fetched');

        res.json({
            success: true,
            ...calibration,
            summary
        });
    } catch (error) {
        next(error);
    }
});

/**
 * GET /api/backtest/prompt-adjustments
 * Get recommended AI prompt adjustments based on calibration
 */
backtestRouter.get('/prompt-adjustments', async (_req: Request, res: Response, next: NextFunction) => {
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
        next(error);
    }
});

/**
 * GET /api/backtest/summary
 * Get a quick calibration summary for logging/display
 */
backtestRouter.get('/summary', async (_req: Request, res: Response, next: NextFunction) => {
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
        next(error);
    }
});

// ═══════════════════════════════════════════════════════════════
// PHASE 3: SMC A/B COMPARISON + COMPONENT EFFECTIVENESS
// ═══════════════════════════════════════════════════════════════

/**
 * GET /api/backtest/smc-comparison
 * Compare win rate of signals WITH vs WITHOUT SMC confluence.
 * After 200+ resolved signals, answers: "Does SMC actually help on NSE?"
 */
backtestRouter.get('/smc-comparison', requireDB, async (_req: Request, res: Response, next: NextFunction) => {
    try {
        const withSMC = await SignalRecord.aggregate([
            {
                $match: {
                    status: { $ne: SignalStatus.PENDING },
                    $or: [
                        { 'attribution.hasOB': true },
                        { 'attribution.hasCHoCH': true },
                        { 'attribution.hasLiquiditySweep': true },
                    ]
                }
            },
            {
                $group: {
                    _id: null,
                    total: { $sum: 1 },
                    wins: { $sum: { $cond: [{ $eq: ['$status', SignalStatus.TARGET_HIT] }, 1, 0] } },
                    avgPnl: { $avg: '$pnlPercent' },
                    avgMfe: { $avg: '$mfe' },
                    avgMae: { $avg: '$mae' },
                    avgDaysToOutcome: { $avg: '$daysToOutcome' },
                }
            }
        ]);

        const withoutSMC = await SignalRecord.aggregate([
            {
                $match: {
                    status: { $ne: SignalStatus.PENDING },
                    'attribution.hasOB': { $ne: true },
                    'attribution.hasCHoCH': { $ne: true },
                    'attribution.hasLiquiditySweep': { $ne: true },
                }
            },
            {
                $group: {
                    _id: null,
                    total: { $sum: 1 },
                    wins: { $sum: { $cond: [{ $eq: ['$status', SignalStatus.TARGET_HIT] }, 1, 0] } },
                    avgPnl: { $avg: '$pnlPercent' },
                    avgMfe: { $avg: '$mfe' },
                    avgMae: { $avg: '$mae' },
                    avgDaysToOutcome: { $avg: '$daysToOutcome' },
                }
            }
        ]);

        const byComponent = await SignalRecord.aggregate([
            { $match: { status: { $ne: SignalStatus.PENDING }, attribution: { $exists: true } } },
            {
                $facet: {
                    orderBlock: [
                        { $match: { 'attribution.hasOB': true } },
                        { $group: { _id: null, total: { $sum: 1 }, wins: { $sum: { $cond: [{ $eq: ['$status', SignalStatus.TARGET_HIT] }, 1, 0] } }, avgPnl: { $avg: '$pnlPercent' } } }
                    ],
                    choch: [
                        { $match: { 'attribution.hasCHoCH': true } },
                        { $group: { _id: null, total: { $sum: 1 }, wins: { $sum: { $cond: [{ $eq: ['$status', SignalStatus.TARGET_HIT] }, 1, 0] } }, avgPnl: { $avg: '$pnlPercent' } } }
                    ],
                    sweep: [
                        { $match: { 'attribution.hasLiquiditySweep': true } },
                        { $group: { _id: null, total: { $sum: 1 }, wins: { $sum: { $cond: [{ $eq: ['$status', SignalStatus.TARGET_HIT] }, 1, 0] } }, avgPnl: { $avg: '$pnlPercent' } } }
                    ],
                    fvg: [
                        { $match: { 'attribution.hasFVG': true } },
                        { $group: { _id: null, total: { $sum: 1 }, wins: { $sum: { $cond: [{ $eq: ['$status', SignalStatus.TARGET_HIT] }, 1, 0] } }, avgPnl: { $avg: '$pnlPercent' } } }
                    ],
                }
            }
        ]);

        const fmt = (g: any[]) => {
            if (!g.length || !g[0]) return { total: 0, wins: 0, winRate: 0, avgPnl: 0 };
            const d = g[0];
            return {
                total: d.total, wins: d.wins,
                winRate: d.total > 0 ? Math.round((d.wins / d.total) * 1000) / 10 : 0,
                avgPnl: Math.round((d.avgPnl || 0) * 100) / 100,
                avgMfe: d.avgMfe != null ? Math.round(d.avgMfe * 100) / 100 : undefined,
                avgMae: d.avgMae != null ? Math.round(d.avgMae * 100) / 100 : undefined,
                avgDays: d.avgDaysToOutcome != null ? Math.round(d.avgDaysToOutcome * 10) / 10 : undefined,
            };
        };

        const smcG = fmt(withSMC);
        const noSmcG = fmt(withoutSMC);
        const totalResolved = smcG.total + noSmcG.total;
        const ready = totalResolved >= 200;
        const comp = byComponent[0] || {};
        const edge = smcG.winRate - noSmcG.winRate;

        res.json({
            success: true, ready, totalResolved, minRequired: 200,
            comparison: { withSMC: smcG, withoutSMC: noSmcG, smcEdge: edge },
            byComponent: {
                orderBlock: fmt(comp.orderBlock || []),
                choch: fmt(comp.choch || []),
                liquiditySweep: fmt(comp.sweep || []),
                fvg: fmt(comp.fvg || []),
            },
            verdict: !ready
                ? `Need ${200 - totalResolved} more resolved signals for reliable comparison`
                : edge > 3 ? `SMC adds +${edge.toFixed(1)}% edge — keep it`
                : edge < -3 ? `SMC reduces win rate by ${(-edge).toFixed(1)}% — consider removing`
                : `SMC has no significant edge (${edge.toFixed(1)}% diff) — neutral`,
        });
    } catch (error) {
        next(error);
    }
});

/**
 * GET /api/backtest/component-effectiveness
 * Component effectiveness dashboard — win rate by confidence, regime, pattern, SMC.
 * Actionable after 300+ resolved signals.
 */
backtestRouter.get('/component-effectiveness', requireDB, async (_req: Request, res: Response, next: NextFunction) => {
    try {
        const totalResolved = await SignalRecord.countDocuments({ status: { $ne: SignalStatus.PENDING } });
        const ready = totalResolved >= 300;

        const byConfidence = await SignalRecord.aggregate([
            { $match: { status: { $ne: SignalStatus.PENDING } } },
            {
                $bucket: {
                    groupBy: '$confidence',
                    boundaries: [0, 30, 40, 50, 55, 60, 65, 70, 75, 80, 85, 90, 100],
                    default: 'other',
                    output: {
                        total: { $sum: 1 },
                        wins: { $sum: { $cond: [{ $eq: ['$status', SignalStatus.TARGET_HIT] }, 1, 0] } },
                        avgPnl: { $avg: '$pnlPercent' },
                    }
                }
            }
        ]);

        const byRegime = await SignalRecord.aggregate([
            { $match: { status: { $ne: SignalStatus.PENDING } } },
            {
                $group: {
                    _id: '$regime', total: { $sum: 1 },
                    wins: { $sum: { $cond: [{ $eq: ['$status', SignalStatus.TARGET_HIT] }, 1, 0] } },
                    avgPnl: { $avg: '$pnlPercent' },
                    avgMfe: { $avg: '$mfe' }, avgMae: { $avg: '$mae' },
                }
            },
            { $sort: { total: -1 } }
        ]);

        const byPattern = await SignalRecord.aggregate([
            { $match: { status: { $ne: SignalStatus.PENDING }, patternType: { $ne: null } } },
            {
                $group: {
                    _id: '$patternType', total: { $sum: 1 },
                    wins: { $sum: { $cond: [{ $eq: ['$status', SignalStatus.TARGET_HIT] }, 1, 0] } },
                    avgPnl: { $avg: '$pnlPercent' },
                }
            },
            { $sort: { total: -1 } }, { $limit: 20 }
        ]);

        const byExitReason = await SignalRecord.aggregate([
            { $match: { status: { $ne: SignalStatus.PENDING }, exitReason: { $exists: true } } },
            {
                $group: {
                    _id: '$exitReason', total: { $sum: 1 },
                    avgPnl: { $avg: '$pnlPercent' }, avgDays: { $avg: '$daysToOutcome' },
                }
            },
            { $sort: { total: -1 } }
        ]);

        const bySMCCount = await SignalRecord.aggregate([
            { $match: { status: { $ne: SignalStatus.PENDING }, 'attribution.smcConfluenceCount': { $exists: true } } },
            {
                $group: {
                    _id: '$attribution.smcConfluenceCount', total: { $sum: 1 },
                    wins: { $sum: { $cond: [{ $eq: ['$status', SignalStatus.TARGET_HIT] }, 1, 0] } },
                    avgPnl: { $avg: '$pnlPercent' },
                }
            },
            { $sort: { _id: 1 } }
        ]);

        const fmtBucket = (b: any) => ({
            bucket: String(b._id),
            total: b.total,
            winRate: b.total > 0 ? Math.round((b.wins / b.total) * 1000) / 10 : 0,
            avgPnl: Math.round((b.avgPnl || 0) * 100) / 100,
        });

        const confBuckets = byConfidence.map(fmtBucket).filter(b => b.total >= 10);
        const optimalThreshold = confBuckets.length > 0
            ? confBuckets.reduce((best, b) => b.winRate > best.winRate ? b : best)
            : null;

        const patternKillList = byPattern.map(fmtBucket).filter(p => p.total >= 10 && p.winRate < 52);

        res.json({
            success: true, ready, totalResolved, minRequired: 300,
            byConfidence: byConfidence.map(fmtBucket),
            byRegime: byRegime.map(r => ({
                regime: r._id, total: r.total,
                winRate: r.total > 0 ? Math.round((r.wins / r.total) * 1000) / 10 : 0,
                avgPnl: Math.round((r.avgPnl || 0) * 100) / 100,
                avgMfe: Math.round((r.avgMfe || 0) * 100) / 100,
                avgMae: Math.round((r.avgMae || 0) * 100) / 100,
            })),
            byPattern: byPattern.map(fmtBucket),
            byExitReason: byExitReason.map(r => ({
                reason: r._id, total: r.total,
                avgPnl: Math.round((r.avgPnl || 0) * 100) / 100,
                avgDays: Math.round((r.avgDays || 0) * 10) / 10,
            })),
            bySMCConfluence: bySMCCount.map(fmtBucket),
            insights: {
                optimalThreshold: optimalThreshold
                    ? `Best at confidence ${optimalThreshold.bucket}: ${optimalThreshold.winRate}% win rate`
                    : 'Insufficient data for threshold optimization',
                patternKillList: patternKillList.length > 0
                    ? patternKillList.map(p => `${p.bucket}: ${p.winRate}% (${p.total} trades)`)
                    : ['No underperforming patterns yet'],
            },
        });
    } catch (error) {
        next(error);
    }
});

/**
 * GET /api/backtest/post-mortem/:signalId
 * Phase 4.3: Trade Post-Mortem View
 * After a signal resolves, returns full analysis: entry/exit, indicator accuracy, learning insight.
 */
backtestRouter.get('/post-mortem/:signalId', requireDB, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { signalId } = req.params;
        if (!mongoose.Types.ObjectId.isValid(signalId)) {
            res.status(400).json({ success: false, error: 'Invalid signal ID' });
            return;
        }

        const signal = await SignalRecord.findById(signalId).lean();
        if (!signal) {
            res.status(404).json({ success: false, error: 'Signal not found' });
            return;
        }

        const isResolved = signal.status !== SignalStatus.PENDING;
        const attr = signal.attribution;

        // Determine which indicators were right vs wrong
        const indicatorAccuracy: Array<{ name: string; signal: string; correct: boolean | null; detail: string }> = [];

        if (attr && isResolved) {
            const won = signal.status === SignalStatus.TARGET_HIT ||
                (signal.pnlPercent !== undefined && signal.pnlPercent > 0);
            const isBuy = signal.direction === 'BUY';

            // MA Trend
            const maTrendAligned = isBuy ? attr.maTrend === 'bullish' : attr.maTrend === 'bearish';
            indicatorAccuracy.push({
                name: 'MA Trend',
                signal: attr.maTrend || 'unknown',
                correct: maTrendAligned === won,
                detail: `EMA9: ${attr.ema9?.toFixed(2)}, EMA21: ${attr.ema21?.toFixed(2)}`,
            });

            // MACD
            const macdAligned = isBuy ? (attr.macdHistogram || 0) > 0 : (attr.macdHistogram || 0) < 0;
            indicatorAccuracy.push({
                name: 'MACD',
                signal: `${attr.macdTrend || 'unknown'} (hist: ${attr.macdHistogram?.toFixed(2)})`,
                correct: macdAligned === won,
                detail: `MACD momentum: ${attr.macdMomentum || 'unknown'}`,
            });

            // RSI
            const rsiOverbought = signal.rsiValue > 70;
            const rsiOversold = signal.rsiValue < 30;
            indicatorAccuracy.push({
                name: 'RSI',
                signal: `${signal.rsiValue.toFixed(1)} (${rsiOverbought ? 'overbought' : rsiOversold ? 'oversold' : 'neutral'})`,
                correct: isBuy ? !rsiOverbought === won : !rsiOversold === won,
                detail: `Divergence: ${attr.rsiDivergence || 'none'}`,
            });

            // Volume
            indicatorAccuracy.push({
                name: 'Volume',
                signal: signal.volumeConfirmed ? 'confirmed' : 'unconfirmed',
                correct: signal.volumeConfirmed === won,
                detail: `Ratio: ${signal.volumeRatio.toFixed(2)}, Trend: ${attr.volumeTrend || 'unknown'}`,
            });

            // Bollinger
            if (attr.bollingerPercentB !== undefined) {
                const bbSignal = attr.bollingerPercentB > 1 ? 'above upper' : attr.bollingerPercentB < 0 ? 'below lower' : 'inside bands';
                indicatorAccuracy.push({
                    name: 'Bollinger Bands',
                    signal: `%B: ${attr.bollingerPercentB.toFixed(2)} (${bbSignal})`,
                    correct: null, // context-dependent
                    detail: bbSignal,
                });
            }

            // SMC components
            if (attr.hasOB || attr.hasFVG || attr.hasCHoCH || attr.hasLiquiditySweep) {
                const smcParts = [];
                if (attr.hasOB) smcParts.push('Order Block');
                if (attr.hasCHoCH) smcParts.push('CHoCH');
                if (attr.hasLiquiditySweep) smcParts.push('Liquidity Sweep');
                if (attr.hasFVG) smcParts.push('FVG');
                indicatorAccuracy.push({
                    name: 'SMC',
                    signal: smcParts.join(' + '),
                    correct: attr.smcConfluenceCount! >= 2 ? won : null,
                    detail: `Confluence: ${attr.smcConfluenceCount}, Trigger: ${attr.entryTrigger}`,
                });
            }
        }

        // Build learning insight
        let learningInsight = '';
        if (isResolved && attr) {
            const correctCount = indicatorAccuracy.filter(i => i.correct === true).length;
            const totalChecked = indicatorAccuracy.filter(i => i.correct !== null).length;

            if (signal.status === SignalStatus.TARGET_HIT) {
                learningInsight = `✅ Target hit in ${signal.daysToOutcome} day(s). ${correctCount}/${totalChecked} indicators aligned correctly.`;
                if (signal.mfe && signal.mae) {
                    learningInsight += ` MFE: ${signal.mfe.toFixed(1)}%, MAE: ${signal.mae.toFixed(1)}%.`;
                }
            } else if (signal.status === SignalStatus.STOP_HIT) {
                const wrongIndicators = indicatorAccuracy.filter(i => i.correct === false).map(i => i.name);
                learningInsight = `❌ Stop hit after ${signal.daysToOutcome} day(s). Misleading indicators: ${wrongIndicators.join(', ') || 'none identified'}.`;
                if (signal.mae) {
                    learningInsight += ` Max drawdown (MAE): ${signal.mae.toFixed(1)}%.`;
                }
            } else if (signal.status === SignalStatus.EXPIRED) {
                learningInsight = `⏰ Signal expired after ${signal.daysToOutcome} day(s) without hitting target or stop. Consider tighter targets or shorter expiry.`;
            }

            // Confidence calibration note
            if (signal.confidence >= 80 && signal.status === SignalStatus.STOP_HIT) {
                learningInsight += ' ⚠️ High confidence signal failed — check for overconfidence in this regime.';
            }
            if (signal.confidence < 65 && signal.status === SignalStatus.TARGET_HIT) {
                learningInsight += ' 💡 Low confidence signal succeeded — system may be too conservative here.';
            }
        }

        // Score breakdown
        const scoreBreakdown = attr ? {
            technical: attr.technicalScore,
            pattern: attr.patternScore,
            volume: attr.volumeScore,
            news: attr.newsScore,
            fundamental: attr.fundamentalScore,
        } : null;

        res.json({
            success: true,
            postMortem: {
                // Signal identity
                signalId: signal._id,
                symbol: signal.symbol,
                direction: signal.direction,
                date: signal.date,

                // Scores
                confidence: signal.confidence,
                baseConfidence: signal.baseConfidence,
                scoreBreakdown,
                regime: signal.regime,

                // Price action
                entryPrice: signal.entryPrice,
                targetPrice: signal.targetPrice,
                stopLoss: signal.stopLoss,
                exitPrice: signal.outcomePrice,
                exitDate: signal.outcomeDate,

                // Outcome
                status: signal.status,
                pnlPercent: signal.pnlPercent,
                daysToOutcome: signal.daysToOutcome,
                exitReason: signal.exitReason,
                mfe: signal.mfe,
                mae: signal.mae,

                // Modifiers applied
                modifiers: signal.modifiers,

                // Indicator accuracy
                indicatorAccuracy,

                // Learning
                learningInsight,

                // Chart data points (entry/exit markers for frontend)
                chartMarkers: {
                    entry: { date: signal.date, price: signal.entryPrice, type: signal.direction },
                    exit: signal.outcomeDate ? { date: signal.outcomeDate, price: signal.outcomePrice, type: signal.status } : null,
                    stopLoss: signal.stopLoss,
                    target: signal.targetPrice,
                    partialExit: signal.partialExitPrice ? { date: signal.partialExitDate, price: signal.partialExitPrice } : null,
                },

                // Condition context
                conditions: {
                    adxValue: signal.adxValue,
                    adxRegime: signal.adxRegime,
                    volumeRatio: signal.volumeRatio,
                    volumeConfirmed: signal.volumeConfirmed,
                    alignmentScore: signal.alignmentScore,
                    patternType: signal.patternType,
                    rsiValue: signal.rsiValue,
                    fundamentalConflict: signal.fundamentalConflict,
                },
            },
        });
    } catch (error) {
        next(error);
    }
});

/**
 * GET /api/backtest/post-mortem — List recent resolved signals for post-mortem
 * Query: ?symbol=RELIANCE&limit=20
 */
backtestRouter.get('/post-mortem', requireDB, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { symbol, limit = '20' } = req.query;
        const filter: Record<string, any> = {
            status: { $in: [SignalStatus.TARGET_HIT, SignalStatus.STOP_HIT, SignalStatus.EXPIRED] },
        };
        if (symbol) filter.symbol = (symbol as string).toUpperCase();

        const signals = await SignalRecord.find(filter)
            .sort({ outcomeDate: -1 })
            .limit(Math.min(Number(limit), 100))
            .select('symbol direction confidence status pnlPercent daysToOutcome exitReason entryPrice outcomePrice date outcomeDate regime')
            .lean();

        const summary = signals.map(s => ({
            signalId: s._id,
            symbol: s.symbol,
            direction: s.direction,
            confidence: s.confidence,
            status: s.status,
            pnlPercent: s.pnlPercent,
            daysToOutcome: s.daysToOutcome,
            exitReason: s.exitReason,
            entryPrice: s.entryPrice,
            exitPrice: s.outcomePrice,
            date: s.date,
            exitDate: s.outcomeDate,
            regime: s.regime,
        }));

        res.json({ success: true, count: summary.length, signals: summary });
    } catch (error) {
        next(error);
    }
});

// ═══════════════════════════════════════════════════════════════
// HISTORICAL WALK-FORWARD BACKTEST (Phase 5)
// ═══════════════════════════════════════════════════════════════

/**
 * POST /api/backtest/historical
 * Start a walk-forward backtest. Returns immediately with job ID.
 * Body: { startDate?, endDate?, symbols?, minConfidence?, signalExpiry?, partialTargetR?, fullTargetR? }
 */
backtestRouter.post('/historical', requireDB, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const {
            startDate = '2025-04-01',
            endDate = '2026-03-31',
            symbols,
            minConfidence = 65,
            signalExpiry = 7,
            partialTargetR = 1.5,
            fullTargetR = 2.5,
        } = req.body;

        // Default to NIFTY 100 if no symbols provided
        const stockList: string[] = symbols && symbols.length > 0 ? symbols : NIFTY_100;

        const config: BacktestConfig = {
            startDate,
            endDate,
            symbols: stockList,
            minConfidence,
            signalExpiry,
            partialTargetR,
            fullTargetR,
        };

        // Create result doc with RUNNING status
        const backtestDoc = await BacktestResult.create({
            config: {
                startDate,
                endDate,
                symbolCount: stockList.length,
                symbols: stockList,
                minConfidence,
                signalExpiry,
                partialTargetR,
                fullTargetR,
            },
            status: BacktestStatus.RUNNING,
            progress: `0/${stockList.length} stocks processed`,
        });

        const backtestId = backtestDoc._id.toString();

        logger.info({ backtestId, symbols: stockList.length, startDate, endDate }, '[Backtest] Historical run started');

        // Fire and forget — run in background
        const startTime = Date.now();

        runWalkForwardBacktest(config, (progress) => {
            // Update progress in DB (fire-and-forget)
            BacktestResult.updateOne(
                { _id: backtestId },
                { progress: `${progress.completedSymbols}/${progress.totalSymbols} stocks | ${progress.totalSignals} signals | ${progress.errors} errors` },
            ).catch(() => { /* swallow */ });
        })
            .then(async (signals) => {
                const report = generateReport(signals);
                const { topStacks, worstStacks } = findConditionStacks(signals);

                await BacktestResult.updateOne(
                    { _id: backtestId },
                    {
                        status: BacktestStatus.COMPLETED,
                        report,
                        signals,
                        topStacks,
                        worstStacks,
                        duration: Date.now() - startTime,
                        progress: `${config.symbols.length}/${config.symbols.length} stocks | ${signals.length} signals`,
                    },
                );

                logger.info({ backtestId, signals: signals.length, duration: Date.now() - startTime }, '[Backtest] Historical run completed');
            })
            .catch(async (err) => {
                await BacktestResult.updateOne(
                    { _id: backtestId },
                    {
                        status: BacktestStatus.FAILED,
                        error: err instanceof Error ? err.message : String(err),
                        duration: Date.now() - startTime,
                    },
                );
                logger.error({ err, backtestId }, '[Backtest] Historical run failed');
            });

        res.json({
            success: true,
            backtestId,
            status: 'RUNNING',
            message: `Backtest started for ${stockList.length} stocks from ${startDate} to ${endDate}. Poll GET /api/backtest/historical/${backtestId} for results.`,
        });
    } catch (error) {
        next(error);
    }
});

/**
 * GET /api/backtest/historical/:id
 * Poll backtest status and results
 */
backtestRouter.get('/historical/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;
        if (!mongoose.Types.ObjectId.isValid(id)) {
            res.status(400).json({ success: false, error: 'Invalid backtest ID' });
            return;
        }

        const result = await BacktestResult.findById(id).lean();
        if (!result) {
            res.status(404).json({ success: false, error: 'Backtest not found' });
            return;
        }

        // If still running, return just progress
        if (result.status === BacktestStatus.RUNNING) {
            res.json({
                success: true,
                status: result.status,
                progress: result.progress,
                config: result.config,
            });
            return;
        }

        // If failed, return error
        if (result.status === BacktestStatus.FAILED) {
            res.json({
                success: true,
                status: result.status,
                error: result.error,
                duration: result.duration,
                config: result.config,
            });
            return;
        }

        // Completed — return full results
        res.json({
            success: true,
            status: result.status,
            duration: result.duration,
            config: result.config,
            report: result.report,
            topStacks: result.topStacks,
            worstStacks: result.worstStacks,
            signalCount: result.signals?.length ?? 0,
            // Don't send full signals array by default (can be huge)
            // Use ?includeSignals=true to get them
            signals: req.query.includeSignals === 'true' ? result.signals : undefined,
        });
    } catch (error) {
        next(error);
    }
});

/**
 * GET /api/backtest/historical
 * List all backtest runs
 */
backtestRouter.get('/historical', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const limit = Math.min(Number(req.query.limit) || 20, 100);

        const results = await BacktestResult.find()
            .sort({ createdAt: -1 })
            .limit(limit)
            .select('config status progress duration error createdAt')
            .lean();

        res.json({
            success: true,
            count: results.length,
            results: results.map(r => ({
                id: r._id,
                config: r.config,
                status: r.status,
                progress: r.progress,
                duration: r.duration,
                error: r.error,
                createdAt: (r as any).createdAt,
            })),
        });
    } catch (error) {
        next(error);
    }
});
