/**
 * Analyze Routes — Thin HTTP handlers
 * Business logic delegated to orchestrators
 * @module @stock-assist/api/routes/analyze
 */

import { Router, Request, Response, NextFunction } from 'express';
import { DEFAULT_WATCHLIST } from '@stock-assist/shared';
import { validate } from '../middleware/validate';
import { analyzeSingleBody, analyzeHistoryQuery } from '../middleware/schemas';
import { analysisLimiter, screeningLimiter } from '../middleware/rateLimiter';
import { logger } from '../config/logger';
import { cache as analysisCache, TTL } from '../services/cache';
import { DailyAnalysis } from '../models';
import { analyzeSingleStock } from '../services/analysis/singleAnalysisOrchestrator';
import { screenStocks } from '../services/analysis/batchAnalysisOrchestrator';
import { getSignalStats } from '../services/backtest/signalTracker';
import { getRegimeLearningStatus } from '../services/analysis/regimeClassifier';
import { getDerivedModifiers } from '../services/analysis/dataDerivedModifiers';
import { getMarketBreadth } from '../services/analysis/breadth';

export const analyzeRouter = Router();

// ═══════════════════════════════════════════════════════════════
// GET /api/analyze/stocks — Morning screening
// ═══════════════════════════════════════════════════════════════

analyzeRouter.get('/stocks', screeningLimiter, async (_req: Request, res: Response, next: NextFunction) => {
    try {
        const result = await screenStocks(DEFAULT_WATCHLIST);
        res.json(result);
    } catch (error) {
        next(error);
    }
});

// ═══════════════════════════════════════════════════════════════
// POST /api/analyze/single — Enhanced single stock analysis
// ═══════════════════════════════════════════════════════════════

analyzeRouter.post('/single', analysisLimiter, validate({ body: analyzeSingleBody }), async (req: Request, res: Response, next: NextFunction) => {
    const { symbol, language } = req.body;
    const start = Date.now();
    logger.info({ symbol, language: language || 'en' }, 'Enhanced analysis started');

    // Check cache
    const cacheKey = `analysis:${symbol.toUpperCase()}:${language || 'en'}`;
    const cached = analysisCache.get<Record<string, unknown>>(cacheKey);
    if (cached) {
        logger.info({ symbol, ms: Date.now() - start }, 'Analysis cache hit');
        return res.json({ ...cached, cached: true });
    }

    try {
        const response = await analyzeSingleStock(symbol, language);

        // Cache the result
        analysisCache.set(cacheKey, response, TTL.ANALYSIS);
        res.json(response);
    } catch (error) {
        next(error);
    }
});

// ═══════════════════════════════════════════════════════════════
// GET /api/analyze/history — Fetch historical analysis with filters
// ═══════════════════════════════════════════════════════════════

analyzeRouter.get('/history', validate({ query: analyzeHistoryQuery }), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { symbol, startDate, endDate, minConfidence, minBullish, minBearish } = req.query;

        const query: Record<string, unknown> = {};

        if (symbol) {
            const escaped = (symbol as string).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            query.symbol = { $regex: new RegExp(escaped, 'i') };
        }

        if (startDate || endDate) {
            const dateQuery: Record<string, Date> = {};
            if (startDate) dateQuery.$gte = new Date(startDate as string);
            if (endDate) dateQuery.$lte = new Date(endDate as string);
            query.date = dateQuery;
        }

        if (minConfidence) query.confidenceScore = { $gte: Number(minConfidence) };
        if (minBullish) query.bullishProb = { $gte: Number(minBullish) };
        if (minBearish) query.bearishProb = { $gte: Number(minBearish) };

        const history = await DailyAnalysis.find(query)
            .sort({ date: -1, symbol: 1 })
            .limit(100);

        res.json({
            success: true,
            count: history.length,
            data: history
        });
    } catch (error) {
        next(error);
    }
});

// ═══════════════════════════════════════════════════════════════
// GET /api/analyze/signal-stats — Signal tracking statistics
// ═══════════════════════════════════════════════════════════════

analyzeRouter.get('/signal-stats', async (_req: Request, res: Response, next: NextFunction) => {
    try {
        const stats = await getSignalStats();

        const [regimeLearning, calibrationResult] = await Promise.all([
            getRegimeLearningStatus(),
            import('../services/analysis/calibration').then(m => m.getConfidenceCalibration()),
        ]);

        res.json({
            success: true,
            ...stats,
            regimeLearning: regimeLearning.regimes,
            confidenceCalibration: {
                ready: calibrationResult.ready,
                totalResolved: calibrationResult.totalResolved,
                quality: calibrationResult.calibrationQuality,
                overallAccuracy: calibrationResult.overallAccuracy,
                buckets: calibrationResult.buckets,
                recommendations: calibrationResult.recommendations,
            },
            derivedModifiers: await getDerivedModifiers().then(r => ({
                ready: r.ready,
                modifiers: r.modifiers,
                totalSignals: r.totalSignals,
                message: r.message,
            })),
            marketBreadth: await getMarketBreadth().then(b => ({
                breadth: b.breadth,
                zone: b.zone,
                aboveCount: b.aboveCount,
                totalEvaluated: b.totalEvaluated,
                cachedAt: b.cachedAt,
            })).catch(() => ({ breadth: null, zone: 'UNKNOWN', message: 'Failed to fetch breadth' })),
            message: stats.ready
                ? `Statistical engine ready with ${stats.resolved} resolved signals`
                : `Need ${300 - stats.resolved} more resolved signals for statistical engine (currently ${stats.resolved}/300)`
        });
    } catch (error) {
        next(error);
    }
});
