/**
 * Candlestick Pattern Engine v2
 * Detects 22 Japanese candlestick patterns with rich metadata,
 * confidence weighting, and composite bias scoring.
 *
 * v1 → 7 basic patterns, string-only output, no confidence integration
 * v2 → 22 patterns, strength/weight/description, composite score,
 *       volume confirmation boost, trend context boost
 *
 * @module @stock-assist/api/services/analysis/candlestick
 */

import type { OHLCData } from '@stock-assist/shared';

// ═══════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════

export interface CandlestickPattern {
    name: string;
    type: 'bullish' | 'bearish' | 'neutral';
    strength: 'weak' | 'moderate' | 'strong';
    confidenceWeight: number;     // 0.0 – 1.0
    description: string;          // one-line explanation for UI
    candles: number;              // how many candles the pattern uses (1, 2, or 3)
}

export interface CandlestickAnalysis {
    patterns: CandlestickPattern[];   // sorted by confidenceWeight DESC
    bullishCount: number;
    bearishCount: number;
    dominantBias: 'bullish' | 'bearish' | 'neutral';
    compositeScore: number;           // -1.0 (full bearish) to +1.0 (full bullish)
    summary: string;
}

// ═══════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════

const isBullishCandle = (c: OHLCData): boolean => c.close > c.open;
const isBearishCandle = (c: OHLCData): boolean => c.close < c.open;
const bodySize = (c: OHLCData): number => Math.abs(c.close - c.open);
const candleRange = (c: OHLCData): number => c.high - c.low;
const upperShadow = (c: OHLCData): number => c.high - Math.max(c.open, c.close);
const lowerShadow = (c: OHLCData): number => Math.min(c.open, c.close) - c.low;

const clamp = (val: number, min: number, max: number): number =>
    Math.min(Math.max(val, min), max);

/**
 * Check if the last N candles (excluding the very last) are in a downtrend.
 * @param threshold — minimum number of bearish candles required
 */
const isInDowntrend = (candles: OHLCData[], lookback: number, threshold: number): boolean => {
    if (candles.length < lookback + 1) return false;
    const slice = candles.slice(-(lookback + 1), -1);
    return slice.filter(isBearishCandle).length >= threshold;
};

/**
 * Check if the last N candles (excluding the very last) are in an uptrend.
 */
const isInUptrend = (candles: OHLCData[], lookback: number, threshold: number): boolean => {
    if (candles.length < lookback + 1) return false;
    const slice = candles.slice(-(lookback + 1), -1);
    return slice.filter(isBullishCandle).length >= threshold;
};

/**
 * Volume confirmation boost: if the last candle's volume is significantly
 * above the short-term average, the pattern carries more weight.
 */
const getVolumeBoost = (candles: OHLCData[]): number => {
    if (candles.length < 10) return 0;
    const recent = candles.slice(-10, -1); // last 9 candles (excluding current)
    const avgVolume = recent.reduce((sum, c) => sum + (c.volume || 0), 0) / recent.length;
    const currentVolume = candles[candles.length - 1].volume || 0;
    if (avgVolume <= 0) return 0;
    const ratio = currentVolume / avgVolume;
    if (ratio >= 2.0) return 0.15;
    if (ratio >= 1.5) return 0.10;
    if (ratio >= 1.2) return 0.05;
    return 0;
};

// ═══════════════════════════════════════════════════════════════
// SINGLE-CANDLE PATTERN DETECTORS
// ═══════════════════════════════════════════════════════════════

function detectDoji(c: OHLCData, _candles: OHLCData[]): CandlestickPattern | null {
    const range = candleRange(c);
    if (range <= 0) return null;

    const body = bodySize(c);
    const bodyRatio = body / range;
    if (bodyRatio >= 0.1) return null;

    const upper = upperShadow(c);
    const lower = lowerShadow(c);
    const eps = range * 0.01; // 1% tolerance for floating point

    // Gravestone Doji: long upper shadow, tiny lower shadow
    if (lower <= body + eps && upper / range > 0.6) {
        return {
            name: 'Gravestone Doji',
            type: 'bearish',
            strength: 'moderate',
            confidenceWeight: 0.50,
            description: 'Gravestone Doji — buyers pushed up but sellers drove price back to open, bearish warning',
            candles: 1,
        };
    }

    // Dragonfly Doji: long lower shadow, tiny upper shadow
    if (upper <= body + eps && lower / range > 0.6) {
        return {
            name: 'Dragonfly Doji',
            type: 'bullish',
            strength: 'moderate',
            confidenceWeight: 0.50,
            description: 'Dragonfly Doji — sellers pushed down but buyers reclaimed, bullish signal',
            candles: 1,
        };
    }

    // Plain Doji
    return {
        name: 'Doji',
        type: 'neutral',
        strength: 'weak',
        confidenceWeight: 0.00,
        description: 'Indecision candle — market is balanced between buyers and sellers',
        candles: 1,
    };
}

function detectHammer(c: OHLCData, candles: OHLCData[]): CandlestickPattern | null {
    const range = candleRange(c);
    if (range <= 0) return null;

    const body = bodySize(c);
    const lower = lowerShadow(c);
    const upper = upperShadow(c);

    // Shape: small body at top, long lower shadow, minimal upper shadow
    const hasSmallBody = isBullishCandle(c) || body / range < 0.3;
    if (!hasSmallBody) return null;
    if (body <= 0 && lower <= 0) return null; // flat candle, not a hammer
    if (lower < 2 * body) return null;
    if (upper > 0.1 * range) return null;

    // Downtrend context makes it meaningful
    const downtrendConfirmed = isInDowntrend(candles, 3, 2);

    return {
        name: 'Hammer',
        type: 'bullish',
        strength: downtrendConfirmed ? 'strong' : 'moderate',
        confidenceWeight: downtrendConfirmed ? 0.57 : 0.45,
        description: 'Hammer — buyers rejected lower prices, potential reversal signal',
        candles: 1,
    };
}

function detectHangingMan(c: OHLCData, candles: OHLCData[]): CandlestickPattern | null {
    const range = candleRange(c);
    if (range <= 0) return null;

    const body = bodySize(c);
    const lower = lowerShadow(c);
    const upper = upperShadow(c);

    if (body <= 0 && lower <= 0) return null;
    if (lower < 2 * body) return null;
    if (upper > 0.1 * range) return null;

    // Only valid after an uptrend
    if (!isInUptrend(candles, 3, 2)) return null;

    return {
        name: 'Hanging Man',
        type: 'bearish',
        strength: 'moderate',
        confidenceWeight: 0.55,
        description: 'Hanging Man — sellers testing lower prices after uptrend, watch for reversal',
        candles: 1,
    };
}

function detectShootingStar(c: OHLCData, candles: OHLCData[]): CandlestickPattern | null {
    const range = candleRange(c);
    if (range <= 0) return null;

    const body = bodySize(c);
    const upper = upperShadow(c);
    const lower = lowerShadow(c);

    const hasSmallBody = isBearishCandle(c) || body / range < 0.3;
    if (!hasSmallBody) return null;
    if (body <= 0 && upper <= 0) return null;
    if (upper < 2 * body) return null;
    if (lower > 0.1 * range) return null;

    // Only valid after an uptrend
    if (!isInUptrend(candles, 3, 2)) return null;

    return {
        name: 'Shooting Star',
        type: 'bearish',
        strength: 'moderate',
        confidenceWeight: 0.60,
        description: 'Shooting Star — buyers pushed price up but sellers took control by close',
        candles: 1,
    };
}

function detectInvertedHammer(c: OHLCData, candles: OHLCData[]): CandlestickPattern | null {
    const range = candleRange(c);
    if (range <= 0) return null;

    const body = bodySize(c);
    const upper = upperShadow(c);
    const lower = lowerShadow(c);

    if (body <= 0 && upper <= 0) return null;
    if (upper < 2 * body) return null;
    if (lower > 0.1 * range) return null;

    // Only valid after a downtrend
    if (!isInDowntrend(candles, 3, 2)) return null;

    return {
        name: 'Inverted Hammer',
        type: 'bullish',
        strength: 'weak',
        confidenceWeight: 0.45,
        description: 'Inverted Hammer — potential bullish reversal, needs confirmation on next candle',
        candles: 1,
    };
}

function detectBullishMarubozu(c: OHLCData): CandlestickPattern | null {
    const range = candleRange(c);
    if (range <= 0) return null;
    if (!isBullishCandle(c)) return null;

    const body = bodySize(c);
    const upper = upperShadow(c);
    const lower = lowerShadow(c);

    if (upper > 0.02 * range) return null;
    if (lower > 0.02 * range) return null;
    if (body / range < 0.95) return null;

    return {
        name: 'Bullish Marubozu',
        type: 'bullish',
        strength: 'strong',
        confidenceWeight: 0.62,
        description: 'Bullish Marubozu — full bullish candle with no shadows, strong buying pressure',
        candles: 1,
    };
}

function detectBearishMarubozu(c: OHLCData): CandlestickPattern | null {
    const range = candleRange(c);
    if (range <= 0) return null;
    if (!isBearishCandle(c)) return null;

    const body = bodySize(c);
    const upper = upperShadow(c);
    const lower = lowerShadow(c);

    if (upper > 0.02 * range) return null;
    if (lower > 0.02 * range) return null;
    if (body / range < 0.95) return null;

    return {
        name: 'Bearish Marubozu',
        type: 'bearish',
        strength: 'strong',
        confidenceWeight: 0.62,
        description: 'Bearish Marubozu — full bearish candle with no shadows, strong selling pressure',
        candles: 1,
    };
}

function detectSpinningTop(c: OHLCData): CandlestickPattern | null {
    const range = candleRange(c);
    if (range <= 0) return null;

    const body = bodySize(c);
    const upper = upperShadow(c);
    const lower = lowerShadow(c);
    const bodyRatio = body / range;

    if (bodyRatio < 0.1 || bodyRatio > 0.3) return null;
    if (upper <= body || lower <= body) return null;

    return {
        name: 'Spinning Top',
        type: 'neutral',
        strength: 'weak',
        confidenceWeight: 0.00,
        description: 'Spinning Top — indecision, neither buyers nor sellers in control',
        candles: 1,
    };
}

// ═══════════════════════════════════════════════════════════════
// TWO-CANDLE PATTERN DETECTORS
// ═══════════════════════════════════════════════════════════════

function detectBullishEngulfing(prev: OHLCData, curr: OHLCData): CandlestickPattern | null {
    if (!isBearishCandle(prev)) return null;
    if (!isBullishCandle(curr)) return null;
    if (curr.open >= prev.close) return null;  // must open below prev close
    if (curr.close <= prev.open) return null;   // must close above prev open

    return {
        name: 'Bullish Engulfing',
        type: 'bullish',
        strength: 'strong',
        confidenceWeight: 0.58,
        description: 'Bullish Engulfing — buyers fully overwhelmed previous bearish candle',
        candles: 2,
    };
}

function detectBearishEngulfing(prev: OHLCData, curr: OHLCData): CandlestickPattern | null {
    if (!isBullishCandle(prev)) return null;
    if (!isBearishCandle(curr)) return null;
    if (curr.open <= prev.close) return null;  // must open above prev close
    if (curr.close >= prev.open) return null;   // must close below prev open

    return {
        name: 'Bearish Engulfing',
        type: 'bearish',
        strength: 'strong',
        confidenceWeight: 0.58,
        description: 'Bearish Engulfing — sellers fully overwhelmed previous bullish candle',
        candles: 2,
    };
}

function detectPiercingLine(prev: OHLCData, curr: OHLCData): CandlestickPattern | null {
    if (!isBearishCandle(prev)) return null;
    if (!isBullishCandle(curr)) return null;
    if (curr.open >= prev.low) return null;    // gap down open

    const prevMidpoint = (prev.open + prev.close) / 2;
    if (curr.close <= prevMidpoint) return null; // must close above midpoint
    if (curr.close >= prev.open) return null;    // must NOT fully engulf (that's Engulfing)

    return {
        name: 'Piercing Line',
        type: 'bullish',
        strength: 'moderate',
        confidenceWeight: 0.65,
        description: 'Piercing Line — bullish reversal, buyers pushed back above midpoint of prior bearish candle',
        candles: 2,
    };
}

function detectDarkCloudCover(prev: OHLCData, curr: OHLCData): CandlestickPattern | null {
    if (!isBullishCandle(prev)) return null;
    if (!isBearishCandle(curr)) return null;
    if (curr.open <= prev.high) return null;   // gap up open

    const prevMidpoint = (prev.open + prev.close) / 2;
    if (curr.close >= prevMidpoint) return null; // must close below midpoint
    if (curr.close <= prev.open) return null;    // must NOT fully engulf

    return {
        name: 'Dark Cloud Cover',
        type: 'bearish',
        strength: 'moderate',
        confidenceWeight: 0.65,
        description: 'Dark Cloud Cover — bearish reversal, sellers pushed below midpoint of prior bullish candle',
        candles: 2,
    };
}

function detectBullishHarami(prev: OHLCData, curr: OHLCData): CandlestickPattern | null {
    if (!isBearishCandle(prev)) return null;
    if (!isBullishCandle(curr)) return null;

    // Current body must be inside previous body
    if (curr.open <= prev.close) return null;  // must open above prev close (prev is bearish: close < open)
    if (curr.close >= prev.open) return null;  // must close below prev open

    // Current body must be significantly smaller
    if (bodySize(curr) >= bodySize(prev) * 0.5) return null;

    return {
        name: 'Bullish Harami',
        type: 'bullish',
        strength: 'moderate',
        confidenceWeight: 0.60,
        description: 'Bullish Harami — small bullish candle inside prior bearish body, momentum slowing',
        candles: 2,
    };
}

function detectBearishHarami(prev: OHLCData, curr: OHLCData): CandlestickPattern | null {
    if (!isBullishCandle(prev)) return null;
    if (!isBearishCandle(curr)) return null;

    // Current body must be inside previous body
    if (curr.open >= prev.close) return null;  // must open below prev close (prev is bullish: close > open)
    if (curr.close <= prev.open) return null;  // must close above prev open

    // Current body must be significantly smaller
    if (bodySize(curr) >= bodySize(prev) * 0.5) return null;

    return {
        name: 'Bearish Harami',
        type: 'bearish',
        strength: 'moderate',
        confidenceWeight: 0.60,
        description: 'Bearish Harami — small bearish candle inside prior bullish body, upward momentum fading',
        candles: 2,
    };
}

// ═══════════════════════════════════════════════════════════════
// THREE-CANDLE PATTERN DETECTORS
// ═══════════════════════════════════════════════════════════════

function detectMorningStar(c1: OHLCData, c2: OHLCData, c3: OHLCData): CandlestickPattern | null {
    // c1: bearish with large body
    if (!isBearishCandle(c1)) return null;
    if ((c1.open - c1.close) / c1.open <= 0.01) return null; // needs meaningful body

    // c2: small body (doji-like indecision)
    if (Math.abs(c2.close - c2.open) / (c2.open || 1) >= 0.005) return null;

    // Gap or opens lower
    if (c2.high >= c1.close && c2.open >= c1.close) return null;

    // c3: bullish, closes above c1 midpoint
    if (!isBullishCandle(c3)) return null;
    if (c3.close <= (c1.open + c1.close) / 2) return null;

    return {
        name: 'Morning Star',
        type: 'bullish',
        strength: 'strong',
        confidenceWeight: 0.62,
        description: 'Morning Star — 3-candle bullish reversal: bearish candle, indecision, strong bullish recovery',
        candles: 3,
    };
}

function detectEveningStar(c1: OHLCData, c2: OHLCData, c3: OHLCData): CandlestickPattern | null {
    // c1: bullish with large body
    if (!isBullishCandle(c1)) return null;
    if ((c1.close - c1.open) / c1.open <= 0.01) return null;

    // c2: small body (doji-like)
    if (Math.abs(c2.close - c2.open) / (c2.open || 1) >= 0.005) return null;

    // Gap or opens higher
    if (c2.low <= c1.close && c2.open <= c1.close) return null;

    // c3: bearish, closes below c1 midpoint
    if (!isBearishCandle(c3)) return null;
    if (c3.close >= (c1.open + c1.close) / 2) return null;

    return {
        name: 'Evening Star',
        type: 'bearish',
        strength: 'strong',
        confidenceWeight: 0.62,
        description: 'Evening Star — 3-candle bearish reversal: bullish candle, indecision, strong bearish breakdown',
        candles: 3,
    };
}

function detectThreeWhiteSoldiers(c1: OHLCData, c2: OHLCData, c3: OHLCData): CandlestickPattern | null {
    // All 3 must be bullish
    if (!isBullishCandle(c1) || !isBullishCandle(c2) || !isBullishCandle(c3)) return null;

    // Each opens within the previous candle's body
    if (c2.open <= c1.open || c2.open >= c1.close) return null;
    if (c3.open <= c2.open || c3.open >= c2.close) return null;

    // Each closes higher than the previous close
    if (c2.close <= c1.close) return null;
    if (c3.close <= c2.close) return null;

    // Small upper shadows (less than 20% of range)
    const checkSmallUpperShadow = (c: OHLCData): boolean => {
        const range = candleRange(c);
        return range > 0 ? (c.high - c.close) / range < 0.2 : true;
    };
    if (!checkSmallUpperShadow(c1) || !checkSmallUpperShadow(c2) || !checkSmallUpperShadow(c3)) return null;

    return {
        name: 'Three White Soldiers',
        type: 'bullish',
        strength: 'strong',
        confidenceWeight: 0.60,
        description: 'Three White Soldiers — 3 consecutive strong bullish candles, powerful uptrend confirmation',
        candles: 3,
    };
}

function detectThreeBlackCrows(c1: OHLCData, c2: OHLCData, c3: OHLCData): CandlestickPattern | null {
    // All 3 must be bearish
    if (!isBearishCandle(c1) || !isBearishCandle(c2) || !isBearishCandle(c3)) return null;

    // Each opens within the previous candle's body (bearish: open > close)
    if (c2.open >= c1.open || c2.open <= c1.close) return null;
    if (c3.open >= c2.open || c3.open <= c2.close) return null;

    // Each closes lower than the previous close
    if (c2.close >= c1.close) return null;
    if (c3.close >= c2.close) return null;

    // Small lower shadows (less than 20% of range)
    const checkSmallLowerShadow = (c: OHLCData): boolean => {
        const range = candleRange(c);
        return range > 0 ? (c.open - c.high) < 0 ? (Math.min(c.open, c.close) - c.low) / range < 0.2 : true : true;
    };
    if (!checkSmallLowerShadow(c1) || !checkSmallLowerShadow(c2) || !checkSmallLowerShadow(c3)) return null;

    return {
        name: 'Three Black Crows',
        type: 'bearish',
        strength: 'strong',
        confidenceWeight: 0.60,
        description: 'Three Black Crows — 3 consecutive strong bearish candles, powerful downtrend confirmation',
        candles: 3,
    };
}

function detectThreeInsideUp(c1: OHLCData, c2: OHLCData, c3: OHLCData): CandlestickPattern | null {
    // c1: bearish
    if (!isBearishCandle(c1)) return null;

    // c2: bullish and completely inside c1 (Harami condition)
    if (!isBullishCandle(c2)) return null;
    if (c2.open <= c1.close || c2.close >= c1.open) return null; // inside c1 body
    if (bodySize(c2) >= bodySize(c1) * 0.5) return null;

    // c3: bullish and closes above c1's open
    if (!isBullishCandle(c3)) return null;
    if (c3.close <= c1.open) return null;

    return {
        name: 'Three Inside Up',
        type: 'bullish',
        strength: 'moderate',
        confidenceWeight: 0.61,
        description: 'Three Inside Up — Harami confirmed by third bullish candle, reversal validated',
        candles: 3,
    };
}

function detectThreeInsideDown(c1: OHLCData, c2: OHLCData, c3: OHLCData): CandlestickPattern | null {
    // c1: bullish
    if (!isBullishCandle(c1)) return null;

    // c2: bearish and completely inside c1 (Harami condition)
    if (!isBearishCandle(c2)) return null;
    if (c2.open >= c1.close || c2.close <= c1.open) return null;
    if (bodySize(c2) >= bodySize(c1) * 0.5) return null;

    // c3: bearish and closes below c1's open
    if (!isBearishCandle(c3)) return null;
    if (c3.close >= c1.open) return null;

    return {
        name: 'Three Inside Down',
        type: 'bearish',
        strength: 'moderate',
        confidenceWeight: 0.61,
        description: 'Three Inside Down — Harami confirmed by third bearish candle, reversal validated',
        candles: 3,
    };
}

// ═══════════════════════════════════════════════════════════════
// MAIN DETECTION ENGINE
// ═══════════════════════════════════════════════════════════════

/**
 * Detect all candlestick patterns on the most recent candles.
 * Returns a rich CandlestickAnalysis with composite scoring.
 */
export function detectCandlestickPatterns(candles: OHLCData[]): CandlestickAnalysis {
    // Guard: need at least 1 candle
    if (!candles || candles.length < 1) {
        return {
            patterns: [],
            bullishCount: 0,
            bearishCount: 0,
            dominantBias: 'neutral',
            compositeScore: 0,
            summary: 'Insufficient candle data for pattern detection',
        };
    }

    const detected: CandlestickPattern[] = [];
    const n = candles.length;
    const last = candles[n - 1];

    // Volume boost for last candle
    const volBoost = getVolumeBoost(candles);

    // ── Single-candle patterns (last candle only) ──
    // Check Doji FIRST (most specific shape) before Hammer/Hanging Man
    // which have overlapping shape criteria
    const doji = detectDoji(last, candles);
    if (doji) detected.push(doji);

    // Marubozu before Hammer checks (Marubozu is incompatible with wicks)
    const bullMarubozu = detectBullishMarubozu(last);
    if (bullMarubozu) detected.push(bullMarubozu);

    const bearMarubozu = detectBearishMarubozu(last);
    if (bearMarubozu) detected.push(bearMarubozu);

    // Hammer vs Hanging Man (same shape, different context)
    // Skip if already a Doji (Doji takes precedence for tiny-body candles)
    if (!doji) {
        const hangingMan = detectHangingMan(last, candles);
        if (hangingMan) {
            detected.push(hangingMan);
        } else {
            const hammer = detectHammer(last, candles);
            if (hammer) detected.push(hammer);
        }

        // Shooting Star vs Inverted Hammer
        const shootingStar = detectShootingStar(last, candles);
        if (shootingStar) {
            detected.push(shootingStar);
        } else {
            const invertedHammer = detectInvertedHammer(last, candles);
            if (invertedHammer) detected.push(invertedHammer);
        }
    }

    // Spinning Top (only if not already a Doji — Doji is more specific)
    if (!doji) {
        const spinningTop = detectSpinningTop(last);
        if (spinningTop) detected.push(spinningTop);
    }

    // ── Two-candle patterns ──
    if (n >= 2) {
        const prev = candles[n - 2];

        const bullEngulf = detectBullishEngulfing(prev, last);
        if (bullEngulf) detected.push(bullEngulf);

        const bearEngulf = detectBearishEngulfing(prev, last);
        if (bearEngulf) detected.push(bearEngulf);

        // Only check Piercing/Dark Cloud if Engulfing wasn't found
        if (!bullEngulf) {
            const piercing = detectPiercingLine(prev, last);
            if (piercing) detected.push(piercing);
        }

        if (!bearEngulf) {
            const darkCloud = detectDarkCloudCover(prev, last);
            if (darkCloud) detected.push(darkCloud);
        }

        const bullHarami = detectBullishHarami(prev, last);
        if (bullHarami) detected.push(bullHarami);

        const bearHarami = detectBearishHarami(prev, last);
        if (bearHarami) detected.push(bearHarami);
    }

    // ── Three-candle patterns ──
    if (n >= 3) {
        const c1 = candles[n - 3];
        const c2 = candles[n - 2];
        const c3 = candles[n - 1];

        const morningStar = detectMorningStar(c1, c2, c3);
        if (morningStar) detected.push(morningStar);

        const eveningStar = detectEveningStar(c1, c2, c3);
        if (eveningStar) detected.push(eveningStar);

        const threeWhite = detectThreeWhiteSoldiers(c1, c2, c3);
        if (threeWhite) detected.push(threeWhite);

        const threeCrows = detectThreeBlackCrows(c1, c2, c3);
        if (threeCrows) detected.push(threeCrows);

        const threeInsideUp = detectThreeInsideUp(c1, c2, c3);
        if (threeInsideUp) detected.push(threeInsideUp);

        const threeInsideDown = detectThreeInsideDown(c1, c2, c3);
        if (threeInsideDown) detected.push(threeInsideDown);
    }

    // ── Apply volume confirmation boost ──
    if (volBoost > 0) {
        for (const p of detected) {
            p.confidenceWeight = clamp(p.confidenceWeight + volBoost, 0, 1.0);
        }
    }

    // ── Compute composite score ──
    let bullishScore = 0;
    let bearishScore = 0;
    let neutralScore = 0;

    for (const p of detected) {
        if (p.type === 'bullish') bullishScore += p.confidenceWeight;
        else if (p.type === 'bearish') bearishScore += p.confidenceWeight;
        else neutralScore += p.confidenceWeight;
    }

    const total = bullishScore + bearishScore + neutralScore;
    const compositeScore = total === 0 ? 0 : (bullishScore - bearishScore) / total;

    let dominantBias: 'bullish' | 'bearish' | 'neutral';
    if (compositeScore > 0.15) dominantBias = 'bullish';
    else if (compositeScore < -0.15) dominantBias = 'bearish';
    else dominantBias = 'neutral';

    // Sort by confidenceWeight DESC
    detected.sort((a, b) => b.confidenceWeight - a.confidenceWeight);

    const bullishCount = detected.filter(p => p.type === 'bullish').length;
    const bearishCount = detected.filter(p => p.type === 'bearish').length;

    const summary = detected.length === 0
        ? 'No significant candlestick patterns detected'
        : `${detected.length} pattern(s) detected — ${bullishCount} bullish, ${bearishCount} bearish. Dominant bias: ${dominantBias} (${compositeScore >= 0 ? '+' : ''}${compositeScore.toFixed(2)})`;

    return {
        patterns: detected,
        bullishCount,
        bearishCount,
        dominantBias,
        compositeScore,
        summary,
    };
}

// ═══════════════════════════════════════════════════════════════
// BACKWARD-COMPATIBLE WRAPPER
// ═══════════════════════════════════════════════════════════════

/**
 * Get recent candlestick patterns as string array (for AI prompt and legacy display).
 * Backward-compatible with the old API.
 */
export const getCandlestickPatternNames = (data: OHLCData[]): string[] => {
    const result = detectCandlestickPatterns(data);
    const names = result.patterns.map(p => `${p.name} (${p.type})`);
    return names.slice(0, 5);
};
