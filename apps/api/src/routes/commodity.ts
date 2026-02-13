/**
 * Commodity Analysis Route
 * POST /api/analyze/commodity — Analyze a single commodity with multi-horizon plans
 * GET  /api/analyze/commodity/supported — List supported commodities
 * GET  /api/analyze/commodity/exchanges/:symbol — List supported exchanges for a commodity
 * @module @stock-assist/api/routes/commodity
 */

import { Router, Request, Response } from 'express';
import { analyzeCommodity, COMMODITY_SYMBOLS } from '../services/commodity';
import { type Exchange, getSupportedExchanges } from '../services/commodity/exchange';

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

/** POST /commodity — Analyze a commodity on a specific exchange */
commodityRouter.post('/', async (req: Request, res: Response) => {
    const startTime = Date.now();
    const { symbol, exchange: rawExchange, language } = req.body;

    if (!symbol) {
        return res.status(400).json({
            success: false,
            error: 'Missing required field: symbol',
            supported: Object.keys(COMMODITY_SYMBOLS),
        });
    }

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
        console.log(`\n[API] ═══════════════════════════════════════`);
        console.log(`[API] 🪙 POST /api/analyze/commodity — ${key} on ${exchange} (${language || 'en'})`);
        console.log(`[API] ═══════════════════════════════════════\n`);

        const result = await analyzeCommodity(key, exchange, language);

        const elapsed = Date.now() - startTime;
        console.log(`[API] ✅ Commodity analysis complete: ${key} (${exchange}) in ${(elapsed / 1000).toFixed(1)}s`);
        console.log(`[API] → Confidence: ${result.confidence}% | Direction: ${result.direction} | Crash Risk: ${result.crashDetection.overallRisk}\n`);

        return res.json({
            success: true,
            data: result,
        });
    } catch (error) {
        const elapsed = Date.now() - startTime;
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';

        console.error(`[API] ❌ Commodity analysis failed: ${key} (${exchange}) after ${(elapsed / 1000).toFixed(1)}s — ${errorMsg}`);

        return res.status(500).json({
            success: false,
            error: `Commodity analysis failed: ${errorMsg}`,
            symbol: key,
            exchange,
            elapsed,
        });
    }
});
