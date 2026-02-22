/**
 * Commodity Analysis Route
 * @module @stock-assist/api/routes/commodity
 */

import { Router, Request, Response, NextFunction } from 'express';
import { analyzeCommodity, COMMODITY_SYMBOLS } from '../services/commodity';
import { type Exchange, getSupportedExchanges } from '../services/commodity/exchange';
import { CommodityPrediction } from '../models';
import { validate } from '../middleware/validate';
import { commodityAnalyzeBody } from '../middleware/schemas';
import { analysisLimiter } from '../middleware/rateLimiter';
import { logger } from '../config/logger';

export const commodityRouter = Router();

const VALID_EXCHANGES: Exchange[] = ['COMEX', 'MCX', 'SPOT'];

/** GET /commodity/supported — List all supported commodities */
commodityRouter.get('/supported', (_req: Request, res: Response) => {
    const commodities = Object.entries(COMMODITY_SYMBOLS).map(([key, cfg]) => ({
        symbol: key,
        name: cfg.name,
        category: cfg.category,
        yahooSymbol: cfg.yahoo,
        exchanges: getSupportedExchanges(key),
    }));

    res.json({
        success: true,
        count: commodities.length,
        commodities,
    });
});

/** GET /commodity/exchanges/:symbol — Get supported exchanges for a commodity */
commodityRouter.get('/exchanges/:symbol', (req: Request, res: Response) => {
    const key = req.params.symbol.toUpperCase().replace(/\s+/g, '');

    if (!COMMODITY_SYMBOLS[key]) {
        return res.status(400).json({
            success: false,
            error: `Unsupported commodity: "${req.params.symbol}"`,
            supported: Object.keys(COMMODITY_SYMBOLS),
        });
    }

    const exchanges = getSupportedExchanges(key);

    return res.json({
        success: true,
        commodity: key,
        name: COMMODITY_SYMBOLS[key].name,
        exchanges,
    });
});

/** GET /commodity/accuracy — Get backtesting accuracy stats */
commodityRouter.get('/accuracy', async (_req: Request, res: Response, next: NextFunction) => {
    try {
        const total = await CommodityPrediction.countDocuments({ status: { $ne: 'PENDING' } });
        const wins = await CommodityPrediction.countDocuments({ status: 'TARGET_HIT' });
        const losses = await CommodityPrediction.countDocuments({ status: 'STOP_HIT' });
        const open = await CommodityPrediction.countDocuments({ status: 'PENDING' });

        const winRate = total > 0 ? Math.round((wins / total) * 100) : 0;

        const byCommodity = await CommodityPrediction.aggregate([
            { $match: { status: { $ne: 'PENDING' } } },
            {
                $group: {
                    _id: '$symbol',
                    total: { $sum: 1 },
                    wins: { $sum: { $cond: [{ $eq: ['$status', 'TARGET_HIT'] }, 1, 0] } },
                    avgPnl: { $avg: '$pnlPercent' }
                }
            },
            { $limit: 10 }
        ]);

        res.json({
            success: true,
            stats: {
                total,
                wins,
                losses,
                open,
                winRate,
                byCommodity: byCommodity.map(c => ({
                    symbol: c._id,
                    total: c.total,
                    wins: c.wins,
                    winRate: Math.round((c.wins / c.total) * 100),
                    avgPnl: Math.round((c.avgPnl || 0) * 100) / 100,
                }))
            }
        });
    } catch (error) {
        // Graceful degradation if no DB
        res.json({ success: true, stats: { total: 0, wins: 0, winRate: 0, open: 0, byCommodity: [] } });
    }
});

/** POST /commodity — Analyze a commodity on a specific exchange */
commodityRouter.post('/', analysisLimiter, validate({ body: commodityAnalyzeBody }), async (req: Request, res: Response, next: NextFunction) => {
    const startTime = Date.now();
    const { symbol, exchange: rawExchange, language } = req.body;

    const key = symbol.toUpperCase().replace(/\s+/g, '');
    const exchange: Exchange = VALID_EXCHANGES.includes(rawExchange?.toUpperCase())
        ? rawExchange.toUpperCase() as Exchange
        : 'COMEX';

    if (!COMMODITY_SYMBOLS[key]) {
        return res.status(400).json({
            success: false,
            error: `Unsupported commodity: "${symbol}"`,
            supported: Object.keys(COMMODITY_SYMBOLS),
            hint: 'Use one of the supported commodity symbols',
        });
    }

    try {
        logger.info({ symbol: key, exchange, language }, 'Commodity analysis started');

        const result = await analyzeCommodity(key, exchange, language);

        const elapsed = Date.now() - startTime;
        logger.info(
            { symbol: key, exchange, elapsed, confidence: result.confidence, direction: result.direction },
            'Commodity analysis complete'
        );

        return res.json({
            success: true,
            data: result,
        });
    } catch (error) {
        const elapsed = Date.now() - startTime;
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';

        logger.error({ symbol: key, exchange, elapsed, err: error }, 'Commodity analysis failed');

        return res.status(500).json({
            success: false,
            error: `Commodity analysis failed: ${errorMsg}`,
            symbol: key,
            exchange,
            elapsed,
        });
    }
});
