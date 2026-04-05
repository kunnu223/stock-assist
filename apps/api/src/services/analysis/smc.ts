/**
 * Smart Money Concepts (SMC) Engine
 * Detects institutional footprints: Order Blocks, FVGs, BOS, CHoCH, Liquidity Sweeps
 * 
 * This engine is ADDITIVE — it does not modify or interfere with the existing
 * candlestick engine or confidence scoring pipeline.
 * 
 * @module @stock-assist/api/services/analysis/smc
 */

import type { OHLCData } from '@stock-assist/shared';
import type {
    SwingPoint,
    OrderBlock,
    FairValueGap,
    CHoCHEvent,
    BOSEvent,
    LiquiditySweep,
    SMCAnalysis,
} from '@stock-assist/shared';
import { logger } from '../../config/logger';

// ═══════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════

/** Minimum candles required for SMC analysis */
const MIN_CANDLES = 7;

/** Maximum age (in candles) to consider OBs and FVGs valid (tightened from 50) */
const MAX_OB_AGE = 20;

/** Minimum impulse strength as a multiple of ATR to qualify an Order Block (tightened from 1.5) */
const OB_IMPULSE_ATR_MULTIPLIER = 2.0;

/** ATR multiplier for CHoCH confirmation — next candle must close this far beyond (tightened from 0.3) */
const CHOCH_CONFIRM_ATR_MULTIPLIER = 0.7;

/** ATR multiplier for liquidity sweep confirmation */
const SWEEP_CONFIRM_ATR_MULTIPLIER = 0.5;

/** Number of recent swing points to maintain */
const SWING_LOOKBACK_CANDLES = 20;

// ═══════════════════════════════════════════════════════════════
// A) SWING POINT DETECTION
// ═══════════════════════════════════════════════════════════════

/**
 * Find swing highs and swing lows in OHLC data.
 * 
 * Swing high: candle with lower highs on both sides (minimum 3-candle lookback).
 * Swing low: candle with higher lows on both sides.
 * 
 * Only returns swing points within the last `SWING_LOOKBACK_CANDLES` candles
 * of the dataset, but looks back further for context.
 */
export function findSwingPoints(data: OHLCData[], lookback: number = 3): SwingPoint[] {
    if (data.length < MIN_CANDLES) return [];

    const swings: SwingPoint[] = [];

    // Need at least `lookback` candles on each side
    for (let i = lookback; i < data.length - lookback; i++) {
        const candle = data[i];

        // Check swing high: all `lookback` candles on both sides have lower highs
        let isSwingHigh = true;
        for (let j = 1; j <= lookback; j++) {
            if (data[i - j].high >= candle.high || data[i + j].high >= candle.high) {
                isSwingHigh = false;
                break;
            }
        }
        if (isSwingHigh) {
            swings.push({ index: i, price: candle.high, type: 'high' });
        }

        // Check swing low: all `lookback` candles on both sides have higher lows
        let isSwingLow = true;
        for (let j = 1; j <= lookback; j++) {
            if (data[i - j].low <= candle.low || data[i + j].low <= candle.low) {
                isSwingLow = false;
                break;
            }
        }
        if (isSwingLow) {
            swings.push({ index: i, price: candle.low, type: 'low' });
        }
    }

    // Return only swing points within the last SWING_LOOKBACK_CANDLES
    const cutoff = Math.max(0, data.length - SWING_LOOKBACK_CANDLES - lookback);
    return swings.filter(s => s.index >= cutoff);
}

// ═══════════════════════════════════════════════════════════════
// B) ORDER BLOCK DETECTOR
// ═══════════════════════════════════════════════════════════════

/**
 * Detect Order Blocks — zones where institutions placed large orders before an
 * impulse move. Returns all OBs within the age limit (both mitigated and
 * unmitigated), but only UNMITIGATED ones are used for signal generation.
 * 
 * Bullish OB: last bearish candle before a strong bullish impulse (≥ 1.5×ATR)
 * Bearish OB: last bullish candle before a strong bearish impulse (≥ 1.5×ATR)
 */
export function detectOrderBlocks(
    data: OHLCData[],
    swings: SwingPoint[],
    atr: number
): OrderBlock[] {
    if (data.length < MIN_CANDLES || atr <= 0) return [];

    const orderBlocks: OrderBlock[] = [];
    const impulseThreshold = atr * OB_IMPULSE_ATR_MULTIPLIER;
    const lastIndex = data.length - 1;

    // Scan for OB formations — need at least 3 candles (OB candle + 2 impulse candles)
    for (let i = 0; i < data.length - 2; i++) {
        const current = data[i];
        const next1 = data[i + 1];
        const next2 = data[i + 2];
        const age = lastIndex - i;

        // Skip if too old
        if (age > MAX_OB_AGE) continue;

        const isBearishCandle = current.close < current.open;
        const isBullishCandle = current.close > current.open;

        // === Bullish Order Block ===
        // Current candle is bearish, then 2 candles move bullishly ≥ impulseThreshold
        if (isBearishCandle) {
            const impulseMove = next2.close - current.low;
            if (impulseMove >= impulseThreshold) {
                // Verify both subsequent candles close higher
                if (next1.close > current.close && next2.close > next1.close) {
                    const zone = { high: current.high, low: current.low };
                    const isMitigated = checkMitigation(data, i, zone, 'bullish');
                    const boost = getSwingBoost(swings, i, current.low, 'low');

                    orderBlocks.push({
                        zone,
                        type: 'bullish',
                        status: isMitigated ? 'mitigated' : 'unmitigated',
                        age,
                        strengthBoost: boost,
                        formationIndex: i,
                    });
                }
            }
        }

        // === Bearish Order Block ===
        // Current candle is bullish, then 2 candles move bearishly ≥ impulseThreshold
        if (isBullishCandle) {
            const impulseMove = current.high - next2.close;
            if (impulseMove >= impulseThreshold) {
                if (next1.close < current.close && next2.close < next1.close) {
                    const zone = { high: current.high, low: current.low };
                    const isMitigated = checkMitigation(data, i, zone, 'bearish');
                    const boost = getSwingBoost(swings, i, current.high, 'high');

                    orderBlocks.push({
                        zone,
                        type: 'bearish',
                        status: isMitigated ? 'mitigated' : 'unmitigated',
                        age,
                        strengthBoost: boost,
                        formationIndex: i,
                    });
                }
            }
        }
    }

    return orderBlocks;
}

/**
 * Check if an Order Block has been mitigated (price has traded through the zone).
 */
function checkMitigation(
    data: OHLCData[],
    formationIndex: number,
    zone: { high: number; low: number },
    type: 'bullish' | 'bearish'
): boolean {
    // Check all candles after formation
    for (let j = formationIndex + 3; j < data.length; j++) {
        if (type === 'bullish') {
            // Bullish OB is mitigated when price trades below the OB low
            if (data[j].low < zone.low) return true;
        } else {
            // Bearish OB is mitigated when price trades above the OB high
            if (data[j].high > zone.high) return true;
        }
    }
    return false;
}

/**
 * Boost strength if OB coincides with a swing point.
 */
function getSwingBoost(
    swings: SwingPoint[],
    obIndex: number,
    obPrice: number,
    swingType: 'high' | 'low'
): number {
    const tolerance = obPrice * 0.005; // 0.5% tolerance
    const match = swings.find(
        s => s.type === swingType &&
            Math.abs(s.index - obIndex) <= 2 &&
            Math.abs(s.price - obPrice) <= tolerance
    );
    return match ? 0.15 : 0;
}

// ═══════════════════════════════════════════════════════════════
// C) FAIR VALUE GAP DETECTOR
// ═══════════════════════════════════════════════════════════════

/**
 * Detect Fair Value Gaps — price imbalances left by strong impulse moves.
 * 
 * Bullish FVG: candle[i+2].low > candle[i].high (gap between candle 1 high and candle 3 low)
 * Bearish FVG: candle[i+2].high < candle[i].low (gap between candle 1 low and candle 3 high)
 */
export function detectFVGs(data: OHLCData[]): FairValueGap[] {
    if (data.length < 3) return [];

    const fvgs: FairValueGap[] = [];
    const lastIndex = data.length - 1;

    for (let i = 0; i < data.length - 2; i++) {
        const age = lastIndex - i;
        if (age > MAX_OB_AGE) continue;

        const candle1 = data[i];
        const candle3 = data[i + 2];

        // === Bullish FVG ===
        if (candle3.low > candle1.high) {
            const zone = { high: candle3.low, low: candle1.high };
            const filled = checkFVGFilled(data, i + 2, zone, 'bullish');

            fvgs.push({
                zone,
                type: 'bullish',
                filled,
                createdAtIndex: i + 1, // Middle candle is the gap candle
            });
        }

        // === Bearish FVG ===
        if (candle3.high < candle1.low) {
            const zone = { high: candle1.low, low: candle3.high };
            const filled = checkFVGFilled(data, i + 2, zone, 'bearish');

            fvgs.push({
                zone,
                type: 'bearish',
                filled,
                createdAtIndex: i + 1,
            });
        }
    }

    return fvgs;
}

/**
 * Check if a Fair Value Gap has been filled by subsequent price action.
 */
function checkFVGFilled(
    data: OHLCData[],
    afterIndex: number,
    zone: { high: number; low: number },
    type: 'bullish' | 'bearish'
): boolean {
    for (let j = afterIndex + 1; j < data.length; j++) {
        if (type === 'bullish') {
            // Bullish FVG filled when price drops into the gap zone
            if (data[j].low <= zone.low) return true;
        } else {
            // Bearish FVG filled when price rises into the gap zone
            if (data[j].high >= zone.high) return true;
        }
    }
    return false;
}

// ═══════════════════════════════════════════════════════════════
// D) BREAK OF STRUCTURE + CHANGE OF CHARACTER
// ═══════════════════════════════════════════════════════════════

/**
 * Detect BOS (trend continuation) and CHoCH (reversal) events.
 * 
 * BOS: price closes beyond the most recent swing point IN the direction of the trend.
 * CHoCH: price closes beyond a swing point AGAINST the current trend for the FIRST time.
 * 
 * CHoCH is confirmed when the next candle closes ≥ 0.3×ATR beyond the CHoCH level.
 * 
 * Returns: { bosEvents, chochEvents, trendState }
 */
export function detectStructureBreaks(
    data: OHLCData[],
    swings: SwingPoint[],
    atr: number
): { bosEvents: BOSEvent[]; chochEvents: CHoCHEvent[]; trendState: 'uptrend' | 'downtrend' | 'ranging' } {
    if (swings.length < 2 || data.length < MIN_CANDLES) {
        return { bosEvents: [], chochEvents: [], trendState: 'ranging' };
    }

    const bosEvents: BOSEvent[] = [];
    const chochEvents: CHoCHEvent[] = [];

    // Determine initial trend from early swing points
    let trendState: 'uptrend' | 'downtrend' | 'ranging' = determineTrend(swings);
    let chochFired = false; // Only fire CHoCH once per reversal

    // Get the most recent swing high and swing low
    const swingHighs = swings.filter(s => s.type === 'high').sort((a, b) => b.index - a.index);
    const swingLows = swings.filter(s => s.type === 'low').sort((a, b) => b.index - a.index);

    if (swingHighs.length === 0 || swingLows.length === 0) {
        return { bosEvents: [], chochEvents: [], trendState: 'ranging' };
    }

    // Scan recent candles for structure breaks (only look at data after the earliest swing)
    const scanStart = Math.min(swingHighs[0]?.index || 0, swingLows[0]?.index || 0);
    const confirmThreshold = atr * CHOCH_CONFIRM_ATR_MULTIPLIER;

    for (let i = Math.max(scanStart, 1); i < data.length; i++) {
        const candle = data[i];

        // Find the most recent swing high/low that formed BEFORE this candle
        const recentHigh = swingHighs.find(s => s.index < i);
        const recentLow = swingLows.find(s => s.index < i);

        if (!recentHigh || !recentLow) continue;

        // === BOS BULLISH (uptrend continuation) ===
        if (trendState === 'uptrend' && candle.close > recentHigh.price) {
            bosEvents.push({
                type: 'bullish',
                index: i,
                priceAtEvent: candle.close,
            });
        }

        // === BOS BEARISH (downtrend continuation) ===
        if (trendState === 'downtrend' && candle.close < recentLow.price) {
            bosEvents.push({
                type: 'bearish',
                index: i,
                priceAtEvent: candle.close,
            });
        }

        // === CHoCH BULLISH (potential reversal from downtrend → uptrend) ===
        if (trendState === 'downtrend' && !chochFired && candle.close > recentHigh.price) {
            const confirmed = checkCHoCHConfirmation(data, i, recentHigh.price, 'bullish', confirmThreshold);
            chochEvents.push({
                type: 'bullish',
                index: i,
                priceAtEvent: candle.close,
                confirmed,
            });
            if (confirmed) {
                trendState = 'uptrend';
                chochFired = true;
            }
        }

        // === CHoCH BEARISH (potential reversal from uptrend → downtrend) ===
        if (trendState === 'uptrend' && !chochFired && candle.close < recentLow.price) {
            const confirmed = checkCHoCHConfirmation(data, i, recentLow.price, 'bearish', confirmThreshold);
            chochEvents.push({
                type: 'bearish',
                index: i,
                priceAtEvent: candle.close,
                confirmed,
            });
            if (confirmed) {
                trendState = 'downtrend';
                chochFired = true;
            }
        }
    }

    return { bosEvents, chochEvents, trendState };
}

/**
 * Determine initial trend direction from swing points.
 * If recent swing highs and swing lows are making higher highs/higher lows → uptrend.
 * If making lower highs/lower lows → downtrend.
 * Otherwise → ranging.
 */
function determineTrend(swings: SwingPoint[]): 'uptrend' | 'downtrend' | 'ranging' {
    const highs = swings.filter(s => s.type === 'high').sort((a, b) => a.index - b.index);
    const lows = swings.filter(s => s.type === 'low').sort((a, b) => a.index - b.index);

    if (highs.length < 2 || lows.length < 2) return 'ranging';

    const lastTwoHighs = highs.slice(-2);
    const lastTwoLows = lows.slice(-2);

    const higherHighs = lastTwoHighs[1].price > lastTwoHighs[0].price;
    const higherLows = lastTwoLows[1].price > lastTwoLows[0].price;
    const lowerHighs = lastTwoHighs[1].price < lastTwoHighs[0].price;
    const lowerLows = lastTwoLows[1].price < lastTwoLows[0].price;

    if (higherHighs && higherLows) return 'uptrend';
    if (lowerHighs && lowerLows) return 'downtrend';
    return 'ranging';
}

/**
 * Confirm a CHoCH event.
 * Rule: next candle must close ≥ 0.3×ATR beyond the CHoCH level in the breakout direction.
 */
function checkCHoCHConfirmation(
    data: OHLCData[],
    chochIndex: number,
    chochLevel: number,
    type: 'bullish' | 'bearish',
    confirmThreshold: number
): boolean {
    const nextIndex = chochIndex + 1;
    if (nextIndex >= data.length) return false;

    const nextCandle = data[nextIndex];

    if (type === 'bullish') {
        return nextCandle.close >= chochLevel + confirmThreshold;
    } else {
        return nextCandle.close <= chochLevel - confirmThreshold;
    }
}

// ═══════════════════════════════════════════════════════════════
// E) LIQUIDITY SWEEP DETECTOR
// ═══════════════════════════════════════════════════════════════

/**
 * Detect Liquidity Sweeps — institutional stop-hunts followed by reversals.
 * 
 * Bullish sweep: candle wicks below recent swing low but closes above it.
 * Bearish sweep: candle wicks above recent swing high but closes below it.
 * 
 * Confirmation: next candle moves ≥ 0.5×ATR in the reversal direction.
 * Conviction boost: +0.15 if sweep occurs at an Order Block zone.
 */
export function detectLiquiditySweeps(
    data: OHLCData[],
    swings: SwingPoint[],
    atr: number,
    orderBlocks: OrderBlock[] = []
): LiquiditySweep[] {
    if (data.length < MIN_CANDLES || atr <= 0) return [];

    const sweeps: LiquiditySweep[] = [];
    const confirmThreshold = atr * SWEEP_CONFIRM_ATR_MULTIPLIER;

    // Only scan recent candles (last 20% of data or last 20 bars, whichever is smaller)
    const scanStart = Math.max(0, data.length - Math.min(20, Math.ceil(data.length * 0.2)));

    for (let i = scanStart; i < data.length - 1; i++) {
        const candle = data[i];

        // Find swing lows that formed before this candle (for bullish sweeps)
        const recentSwingLows = swings
            .filter(s => s.type === 'low' && s.index < i)
            .sort((a, b) => b.index - a.index);

        // Find swing highs that formed before this candle (for bearish sweeps)
        const recentSwingHighs = swings
            .filter(s => s.type === 'high' && s.index < i)
            .sort((a, b) => b.index - a.index);

        // === Bullish Liquidity Sweep ===
        for (const swingLow of recentSwingLows.slice(0, 3)) { // Check 3 most recent swing lows
            if (candle.low < swingLow.price && candle.close > swingLow.price) {
                // Swept below swing low but closed above — bullish sweep
                const confirmed = checkSweepConfirmation(data, i, 'bullish', confirmThreshold);
                const boost = getSweepOBBoost(orderBlocks, candle.low, 'bullish');

                sweeps.push({
                    type: 'bullish',
                    sweepExtreme: candle.low,
                    closePrice: candle.close,
                    confirmed,
                    convictionBoost: boost,
                    index: i,
                });
                break; // Only one sweep per candle
            }
        }

        // === Bearish Liquidity Sweep ===
        for (const swingHigh of recentSwingHighs.slice(0, 3)) {
            if (candle.high > swingHigh.price && candle.close < swingHigh.price) {
                // Swept above swing high but closed below — bearish sweep
                const confirmed = checkSweepConfirmation(data, i, 'bearish', confirmThreshold);
                const boost = getSweepOBBoost(orderBlocks, candle.high, 'bearish');

                sweeps.push({
                    type: 'bearish',
                    sweepExtreme: candle.high,
                    closePrice: candle.close,
                    confirmed,
                    convictionBoost: boost,
                    index: i,
                });
                break;
            }
        }
    }

    return sweeps;
}

/**
 * Confirm a liquidity sweep — next candle moves ≥ 0.5×ATR in reversal direction.
 */
function checkSweepConfirmation(
    data: OHLCData[],
    sweepIndex: number,
    type: 'bullish' | 'bearish',
    confirmThreshold: number
): boolean {
    const nextIndex = sweepIndex + 1;
    if (nextIndex >= data.length) return false;

    const sweepCandle = data[sweepIndex];
    const nextCandle = data[nextIndex];

    if (type === 'bullish') {
        return (nextCandle.close - sweepCandle.close) >= confirmThreshold;
    } else {
        return (sweepCandle.close - nextCandle.close) >= confirmThreshold;
    }
}

/**
 * Check if a liquidity sweep occurred at an Order Block zone.
 */
function getSweepOBBoost(
    orderBlocks: OrderBlock[],
    sweepPrice: number,
    type: 'bullish' | 'bearish'
): number {
    const relevantOBs = orderBlocks.filter(
        ob => ob.type === type && ob.status === 'unmitigated'
    );

    for (const ob of relevantOBs) {
        if (sweepPrice >= ob.zone.low && sweepPrice <= ob.zone.high) {
            return 0.15;
        }
        // Allow small tolerance outside the zone (0.3% of zone width)
        const zoneWidth = ob.zone.high - ob.zone.low;
        const tolerance = zoneWidth * 0.3;
        if (type === 'bullish' && sweepPrice >= ob.zone.low - tolerance && sweepPrice <= ob.zone.high) {
            return 0.15;
        }
        if (type === 'bearish' && sweepPrice <= ob.zone.high + tolerance && sweepPrice >= ob.zone.low) {
            return 0.15;
        }
    }
    return 0;
}

// ═══════════════════════════════════════════════════════════════
// MAIN ORCHESTRATOR
// ═══════════════════════════════════════════════════════════════

/**
 * Run the complete Smart Money Concepts analysis on daily OHLC data.
 * 
 * This is the main entry point — call this from `technicalAnalysis.ts`.
 * Returns a complete SMCAnalysis object with all detectors' results.
 * 
 * @param daily - Daily OHLC candle data (minimum 7 candles)
 * @param atr - Current Average True Range value
 * @returns Complete SMC analysis
 */
export function analyzeSMC(daily: OHLCData[], atr: number): SMCAnalysis {
    // Guard: insufficient data
    if (daily.length < MIN_CANDLES) {
        logger.debug({ bars: daily.length }, 'SMC: insufficient data, skipping');
        return emptyAnalysis();
    }

    // Step 1: Find swing points (foundation for everything else)
    const swings = findSwingPoints(daily, 3);
    logger.debug({ count: swings.length, highs: swings.filter(s => s.type === 'high').length, lows: swings.filter(s => s.type === 'low').length }, 'SMC: swing points detected');

    // Step 2: Detect Order Blocks
    const orderBlocks = detectOrderBlocks(daily, swings, atr);
    const unmitigatedOBs = orderBlocks.filter(ob => ob.status === 'unmitigated');
    logger.debug({ total: orderBlocks.length, unmitigated: unmitigatedOBs.length }, 'SMC: order blocks detected');

    // Step 3: Detect Fair Value Gaps
    const fvgs = detectFVGs(daily);
    const unfilledFVGs = fvgs.filter(f => !f.filled);
    logger.debug({ total: fvgs.length, unfilled: unfilledFVGs.length }, 'SMC: FVGs detected');

    // Step 4: Detect BOS and CHoCH
    const { bosEvents, chochEvents, trendState } = detectStructureBreaks(daily, swings, atr);
    logger.debug({ bos: bosEvents.length, choch: chochEvents.length, trend: trendState }, 'SMC: structure breaks detected');

    // Step 5: Detect Liquidity Sweeps
    const sweeps = detectLiquiditySweeps(daily, swings, atr, orderBlocks);
    logger.debug({ count: sweeps.length, confirmed: sweeps.filter(s => s.confirmed).length }, 'SMC: liquidity sweeps detected');

    return {
        orderBlocks,
        fairValueGaps: fvgs,
        bosEvents,
        chochEvents,
        liquiditySweeps: sweeps,
        swingPoints: swings,
        trendState,
    };
}

/**
 * Returns an empty SMC analysis for when data is insufficient.
 */
function emptyAnalysis(): SMCAnalysis {
    return {
        orderBlocks: [],
        fairValueGaps: [],
        bosEvents: [],
        chochEvents: [],
        liquiditySweeps: [],
        swingPoints: [],
        trendState: 'ranging',
    };
}
