/**
 * Market Breadth Service — Phase E #10
 * 
 * Breadth = % of NIFTY 100 constituents trading above their 50-day DMA
 * 
 * | Breadth | Effect                    |
 * |:-------:|---------------------------|
 * | < 40%   | Penalize bullish signals  |
 * | 40-65%  | Neutral                   |
 * | > 65%   | Amplify bullish signals   |
 * 
 * This provides macro context — even if an individual stock looks bullish,
 * if 70% of the market is below its 50DMA, bullish bets are riskier.
 * 
 * Implementation notes:
 * - Fetches 60-day daily data for all NIFTY 100 stocks
 * - Calculates 50-day SMA for each
 * - Counts how many are trading above
 * - Caches result for 4 hours (breadth changes slowly intraday)
 * - Fetches in batches with delays to avoid Yahoo rate limits
 * 
 * @module @stock-assist/api/services/analysis/breadth
 */

import { NIFTY_100 } from '@stock-assist/shared';
import { fetchHistory } from '../data';
import { logger } from '../../config/logger';

// ═══════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════

export interface BreadthResult {
    breadth: number;              // 0-100% of NIFTY 100 above 50DMA
    aboveCount: number;           // Count above 50DMA
    belowCount: number;           // Count below 50DMA
    totalEvaluated: number;       // Successfully evaluated stocks
    totalFailed: number;          // Stocks that failed to fetch
    modifier: number;             // Bullish signal modifier (-5 to +5)
    zone: 'WEAK' | 'NEUTRAL' | 'STRONG';
    description: string;
    cachedAt: string;             // ISO timestamp of when this was calculated
}

// ═══════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════

/** Breadth thresholds */
const WEAK_THRESHOLD = 40;      // Below this → penalize bullish
const STRONG_THRESHOLD = 65;    // Above this → amplify bullish

/** Modifiers for bullish signals based on breadth */
const BREADTH_MODIFIERS = {
    WEAK: -5,       // Penalize bullish signals in weak markets
    NEUTRAL: 0,     // No modification
    STRONG: 5,      // Amplify bullish signals in strong markets
};

/** Batch size for fetching (avoid Yahoo rate limits) */
const FETCH_BATCH_SIZE = 10;

/** Delay between batches in ms */
const BATCH_DELAY_MS = 500;

/** Cache TTL — breadth changes slowly, 4 hours is fine */
const CACHE_TTL_MS = 4 * 60 * 60 * 1000;

/** Minimum stocks needed for a meaningful breadth reading */
const MIN_STOCKS_EVALUATED = 50;

// ═══════════════════════════════════════════════════════════════
// CACHE
// ═══════════════════════════════════════════════════════════════

let breadthCache: { result: BreadthResult; lastUpdated: number } | null = null;

// ═══════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════

function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Calculate 50-day SMA for a set of daily OHLC data.
 * Returns the SMA value, or null if not enough data.
 */
function calc50DMA(closes: number[]): number | null {
    if (closes.length < 50) return null;
    const last50 = closes.slice(-50);
    const sum = last50.reduce((a, b) => a + b, 0);
    return sum / 50;
}

// ═══════════════════════════════════════════════════════════════
// CORE FUNCTION
// ═══════════════════════════════════════════════════════════════

/**
 * Calculate market breadth for NIFTY 100.
 * Uses cached result if available and fresh.
 */
export async function getMarketBreadth(): Promise<BreadthResult> {
    // Check cache
    if (breadthCache && Date.now() - breadthCache.lastUpdated < CACHE_TTL_MS) {
        return breadthCache.result;
    }

    logger.info(`[Breadth] 📊 Calculating market breadth for NIFTY 100 (${NIFTY_100.length} stocks)...`);

    let aboveCount = 0;
    let belowCount = 0;
    let failedCount = 0;

    // Process in batches to avoid rate limiting
    for (let i = 0; i < NIFTY_100.length; i += FETCH_BATCH_SIZE) {
        const batch = NIFTY_100.slice(i, i + FETCH_BATCH_SIZE);

        const results = await Promise.allSettled(
            batch.map(async (symbol) => {
                const history = await fetchHistory(symbol, '3mo', '1d');
                if (history.length < 50) return null; // Not enough data

                const closes = history.map(h => h.close);
                const sma50 = calc50DMA(closes);
                if (sma50 === null) return null;

                const currentPrice = closes[closes.length - 1];
                return currentPrice > sma50 ? 'above' : 'below';
            })
        );

        for (const result of results) {
            if (result.status === 'fulfilled' && result.value === 'above') {
                aboveCount++;
            } else if (result.status === 'fulfilled' && result.value === 'below') {
                belowCount++;
            } else {
                failedCount++;
            }
        }

        // Rate limit delay between batches
        if (i + FETCH_BATCH_SIZE < NIFTY_100.length) {
            await sleep(BATCH_DELAY_MS);
        }
    }

    const totalEvaluated = aboveCount + belowCount;
    const breadth = totalEvaluated > 0 ? Math.round((aboveCount / totalEvaluated) * 100) : 50;

    // Determine zone and modifier
    let zone: BreadthResult['zone'];
    let modifier: number;
    let description: string;

    if (totalEvaluated < MIN_STOCKS_EVALUATED) {
        // Not enough data — neutral
        zone = 'NEUTRAL';
        modifier = 0;
        description = `Insufficient data: only ${totalEvaluated}/${MIN_STOCKS_EVALUATED} stocks evaluated`;
    } else if (breadth < WEAK_THRESHOLD) {
        zone = 'WEAK';
        modifier = BREADTH_MODIFIERS.WEAK;
        description = `Weak market: only ${breadth}% of NIFTY 100 above 50DMA (${aboveCount}/${totalEvaluated})`;
    } else if (breadth > STRONG_THRESHOLD) {
        zone = 'STRONG';
        modifier = BREADTH_MODIFIERS.STRONG;
        description = `Strong market: ${breadth}% of NIFTY 100 above 50DMA (${aboveCount}/${totalEvaluated})`;
    } else {
        zone = 'NEUTRAL';
        modifier = BREADTH_MODIFIERS.NEUTRAL;
        description = `Neutral breadth: ${breadth}% of NIFTY 100 above 50DMA (${aboveCount}/${totalEvaluated})`;
    }

    logger.info(`[Breadth] ${zone === 'WEAK' ? '🔴' : zone === 'STRONG' ? '🟢' : '🟡'} ${description} | Failed: ${failedCount}`);

    const result: BreadthResult = {
        breadth,
        aboveCount,
        belowCount,
        totalEvaluated,
        totalFailed: failedCount,
        modifier,
        zone,
        description,
        cachedAt: new Date().toISOString(),
    };

    // Cache the result
    breadthCache = { result, lastUpdated: Date.now() };

    return result;
}

/**
 * Get the breadth modifier for bullish signals.
 * Quick accessor that returns only the modifier value.
 * Negative in weak markets, positive in strong markets.
 */
export async function getBreadthModifier(): Promise<{
    modifier: number;
    zone: string;
    breadth: number;
}> {
    const result = await getMarketBreadth();
    return {
        modifier: result.modifier,
        zone: result.zone,
        breadth: result.breadth,
    };
}
