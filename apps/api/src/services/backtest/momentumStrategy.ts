/**
 * Momentum Strategy — long-only cross-sectional momentum + Donchian breakout
 *
 * Built from scratch after the SMC-based strategy showed no edge in 6 backtest
 * runs (win rate stuck in 18-32% range across all variants). This strategy
 * uses ONLY documented anomalies:
 *
 *   1. Cross-sectional momentum (Jegadeesh & Titman 1993)
 *      → Stock must be in top 30% of universe by 6-month return
 *   2. Long-term trend filter (Faber 2007)
 *      → Stock must be above its 200-day SMA
 *   3. Donchian breakout entry (Turtle Traders)
 *      → Today's close must exceed 20-day high of prior 20 days
 *   4. Volume confirmation
 *      → Today's volume must be ≥ 1.5× 20-day average
 *   5. Wide ATR stops (your audit said "exits too early")
 *      → Stop at 2× ATR(14), target at 5× ATR(14) → ~2.5R
 *
 * No SMC. No order blocks. No CHoCH. No confidence scoring. Just rules that
 * have decades of academic and live-trading evidence on equity markets.
 *
 * @module @stock-assist/api/services/backtest/momentumStrategy
 */

import type { OHLCData } from '@stock-assist/shared';
import { calcATR } from '../indicators';
import type { BacktestAnalysisResult, BacktestConditions } from './historicalBacktester';

// ═══════════════════════════════════════════════════════════════
// CONSTANTS — all tunable, but defaults are research-backed
// ═══════════════════════════════════════════════════════════════

/** Lookback for cross-sectional momentum ranking (trading days, ~6 months) */
const MOMENTUM_LOOKBACK_DAYS = 126;

/** Top N% of the universe by 6-month return that qualifies as "momentum leader" */
const MOMENTUM_TOP_PERCENTILE = 0.30;

/** Trend filter: stock must be above this many-day SMA */
const TREND_SMA_PERIOD = 200;

/** Donchian breakout window — close must exceed this many days' high */
const BREAKOUT_LOOKBACK = 20;

/** Volume must be at least this multiple of the 20-day average */
const VOLUME_BREAKOUT_MULT = 1.5;

/** Stop loss = entry − (ATR × this) */
const STOP_ATR_MULT = 2.0;

/** Target = entry + (ATR × this). 5/2 = 2.5R */
const TARGET_ATR_MULT = 5.0;

// ═══════════════════════════════════════════════════════════════
// UNIVERSE RANKING — pre-computed once per simulation date
// ═══════════════════════════════════════════════════════════════

/**
 * For each simulation date, the set of symbols in the top momentum percentile.
 * Built once at the start of the backtest, then queried per (symbol, date).
 *
 * Key: ISO date string (YYYY-MM-DD)
 * Value: Set of symbol strings that are in the top N% by 6mo return on that date
 */
export type MomentumUniverseRanking = Map<string, Set<string>>;

/**
 * Build the universe-wide momentum ranking for every trading day in the
 * backtest window. This must be done ONCE up front because each daily
 * decision needs to know how every stock ranked relative to its peers.
 *
 * @param symbolHistories Map of symbol → full daily OHLC history
 * @param tradingDays List of dates we'll be simulating
 * @returns Map of date → set of symbols in the top momentum bucket
 */
export function buildMomentumUniverse(
    symbolHistories: Map<string, OHLCData[]>,
    tradingDays: string[],
): MomentumUniverseRanking {
    const ranking: MomentumUniverseRanking = new Map();

    for (const simDate of tradingDays) {
        // Compute 6-month return for every symbol AS OF simDate (no lookahead)
        const returns: Array<{ symbol: string; ret: number }> = [];

        for (const [symbol, history] of symbolHistories) {
            // Find the most recent bar on or before simDate
            // (filter is fine here — histories are short and built once)
            const eligible = history.filter(b => b.date <= simDate);
            if (eligible.length < MOMENTUM_LOOKBACK_DAYS + 1) continue;

            const recent = eligible[eligible.length - 1];
            const past = eligible[eligible.length - 1 - MOMENTUM_LOOKBACK_DAYS];
            if (!recent || !past || past.close <= 0) continue;

            const ret = (recent.close - past.close) / past.close;
            returns.push({ symbol, ret });
        }

        if (returns.length === 0) {
            ranking.set(simDate, new Set());
            continue;
        }

        // Sort descending by return — top performers first
        returns.sort((a, b) => b.ret - a.ret);

        // Take the top N%
        const cutoff = Math.max(1, Math.floor(returns.length * MOMENTUM_TOP_PERCENTILE));
        const topSet = new Set(returns.slice(0, cutoff).map(r => r.symbol));
        ranking.set(simDate, topSet);
    }

    return ranking;
}

// ═══════════════════════════════════════════════════════════════
// PER-BAR INDICATOR HELPERS (no lookahead — uses only the slice given)
// ═══════════════════════════════════════════════════════════════

function sma(values: number[], period: number): number | null {
    if (values.length < period) return null;
    const slice = values.slice(-period);
    return slice.reduce((a, b) => a + b, 0) / period;
}

function highestHigh(bars: OHLCData[], lookback: number, exclude: number): number | null {
    // Highest high of the last `lookback` bars EXCLUDING the most recent `exclude`
    // i.e. highest of bars[i - lookback - exclude .. i - exclude - 1]
    if (bars.length < lookback + exclude) return null;
    const end = bars.length - exclude;
    const start = end - lookback;
    let max = -Infinity;
    for (let i = start; i < end; i++) {
        if (bars[i].high > max) max = bars[i].high;
    }
    return max === -Infinity ? null : max;
}

function avgVolume(bars: OHLCData[], period: number): number | null {
    if (bars.length < period) return null;
    const slice = bars.slice(-period);
    return slice.reduce((a, b) => a + b.volume, 0) / period;
}

// ═══════════════════════════════════════════════════════════════
// MAIN STRATEGY FUNCTION
// ═══════════════════════════════════════════════════════════════

/**
 * Evaluates whether the momentum strategy fires a signal on the given day.
 * Returns null if any rule fails — clean, deterministic, no scoring.
 *
 * @param symbol           Stock being evaluated
 * @param simDate          ISO date of the simulation day
 * @param dailyData        Stock's OHLC bars filtered to bar.date <= simDate
 * @param universeRanking  Pre-computed momentum ranking from buildMomentumUniverse
 */
export function runMomentumStrategy(
    symbol: string,
    simDate: string,
    dailyData: OHLCData[],
    universeRanking: MomentumUniverseRanking,
): BacktestAnalysisResult | null {
    // Need enough history for all our indicators
    if (dailyData.length < TREND_SMA_PERIOD + 5) return null;

    const lastBar = dailyData[dailyData.length - 1];
    const closePrices = dailyData.map(b => b.close);

    // ── RULE 1: Cross-sectional momentum filter ──
    const topToday = universeRanking.get(simDate);
    if (!topToday || !topToday.has(symbol)) return null;

    // ── RULE 2: 200-day SMA trend filter ──
    const sma200 = sma(closePrices, TREND_SMA_PERIOD);
    if (sma200 === null || lastBar.close <= sma200) return null;

    // ── RULE 3: Donchian 20-day breakout (excluding today) ──
    const priorHigh = highestHigh(dailyData, BREAKOUT_LOOKBACK, 1);
    if (priorHigh === null || lastBar.close <= priorHigh) return null;

    // ── RULE 4: Volume confirmation ──
    const avgVol20 = avgVolume(dailyData.slice(0, -1), BREAKOUT_LOOKBACK);
    if (avgVol20 === null || lastBar.volume < avgVol20 * VOLUME_BREAKOUT_MULT) return null;

    // ── RULE 5: ATR-based stops/targets ──
    const atr = calcATR(dailyData);
    if (atr <= 0) return null;

    const entryPrice = lastBar.close;
    const stopLoss = Number((entryPrice - atr * STOP_ATR_MULT).toFixed(2));
    const targetPrice = Number((entryPrice + atr * TARGET_ATR_MULT).toFixed(2));

    if (stopLoss >= entryPrice || targetPrice <= entryPrice) return null;

    const risk = entryPrice - stopLoss;
    const reward = targetPrice - entryPrice;
    const riskReward = Number((reward / risk).toFixed(2));

    // Build the conditions snapshot — most fields are stubbed because the
    // momentum strategy intentionally doesn't use them. Kept for compatibility
    // with the existing report/audit structures.
    const volumeRatio = avgVol20 > 0 ? lastBar.volume / avgVol20 : 0;
    const conditions: BacktestConditions = {
        regime: 'MOMENTUM',
        isStrongTrend: true,
        isTransition: false,
        weeklyAligned: true,
        allTimeframesAligned: true,
        alignmentScore: 100,
        volumeHigh: volumeRatio >= 1.5,
        volumeConfirmed: true,
        volumeIncreasing: true,
        volumeRatio,
        rsiValue: 0,
        rsiInZone: false,
        macdBullish: true,
        macdAccelerating: false,
        emaCrossover: true,
        maTrend: 'bullish',
        macdTrend: 'bullish',
        macdMomentum: 'flat',
        volumeTrend: 'increasing',
        rsiDivergence: 'none',
        hasStrongPattern: false,
        primaryPattern: 'momentum_breakout',
        patternWeight: 1,
        hasOrderBlock: false,
        hasCHoCH: false,
        hasLiquiditySweep: false,
        smcConfluenceCount: 0,
        noBearishDivergence: true,
        noFTConflict: true,
        adxValue: 0,
        weeklyTrend: 'bullish',
        bollingerSqueeze: false,
    };

    return {
        recommendation: 'BUY',
        confidence: 75, // Fixed — this strategy is deterministic, not scored
        regime: 'MOMENTUM',
        entryPrice: Number(entryPrice.toFixed(2)),
        targetPrice,
        stopLoss,
        riskReward,
        conditions,
    };
}
