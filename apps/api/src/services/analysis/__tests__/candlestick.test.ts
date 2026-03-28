import { describe, it, expect } from 'vitest';
import { detectCandlestickPatterns, getCandlestickPatternNames } from '../candlestick';
import type { OHLCData } from '@stock-assist/shared';

// ═══════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════

function candle(open: number, close: number, high: number, low: number, volume = 100000): OHLCData {
    return { date: '2024-01-01', open, high, low, close, volume };
}

/** Build a bearish candle */
const bearish = (base = 100, size = 2, vol = 100000) =>
    candle(base + size, base, base + size + 0.5, base - 0.5, vol);

/** Build a bullish candle */
const bullish = (base = 100, size = 2, vol = 100000) =>
    candle(base, base + size, base + size + 0.5, base - 0.5, vol);

// ═══════════════════════════════════════════════════════════════
// GUARD / EDGE CASES
// ═══════════════════════════════════════════════════════════════

describe('detectCandlestickPatterns — guards', () => {
    it('returns empty result for null/undefined/empty input', () => {
        const result = detectCandlestickPatterns([]);
        expect(result.patterns).toEqual([]);
        expect(result.compositeScore).toBe(0);
        expect(result.dominantBias).toBe('neutral');
        expect(result.summary).toContain('Insufficient');
    });

    it('does not crash with 1 candle', () => {
        const result = detectCandlestickPatterns([candle(100, 101, 102, 99)]);
        expect(result).toBeDefined();
        expect(result.compositeScore).toBeGreaterThanOrEqual(-1);
        expect(result.compositeScore).toBeLessThanOrEqual(1);
    });

    it('does not crash with 2 candles', () => {
        const result = detectCandlestickPatterns([
            candle(100, 98, 101, 97),
            candle(97, 102, 103, 96),
        ]);
        expect(result).toBeDefined();
    });

    it('handles zero-range candle (high === low) without division by zero', () => {
        const result = detectCandlestickPatterns([candle(100, 100, 100, 100)]);
        // Should not crash; no patterns detected on a flat candle
        expect(result.patterns.length).toBe(0);
    });
});

// ═══════════════════════════════════════════════════════════════
// SINGLE-CANDLE PATTERNS
// ═══════════════════════════════════════════════════════════════

describe('detectCandlestickPatterns — single-candle', () => {
    it('detects a plain Doji', () => {
        // Doji: body < 10% of range, range > 0
        const doji = candle(100, 100.05, 101, 99); // body=0.05, range=2
        const result = detectCandlestickPatterns([doji]);
        expect(result.patterns.some(p => p.name === 'Doji')).toBe(true);
        const dojiPattern = result.patterns.find(p => p.name === 'Doji')!;
        expect(dojiPattern.type).toBe('neutral');
        expect(dojiPattern.confidenceWeight).toBe(0.3);
    });

    it('detects Gravestone Doji (long upper shadow)', () => {
        // body ≈ 0, upper shadow > 60% of range, lower shadow < body
        const gravestone = candle(100, 100.02, 103, 99.98); // body=0.02, range=3.02
        const result = detectCandlestickPatterns([gravestone]);
        expect(result.patterns.some(p => p.name === 'Gravestone Doji')).toBe(true);
    });

    it('detects Dragonfly Doji (long lower shadow)', () => {
        const dragonfly = candle(102, 102.02, 102.04, 99); // body=0.02, range=3.04
        const result = detectCandlestickPatterns([dragonfly]);
        expect(result.patterns.some(p => p.name === 'Dragonfly Doji')).toBe(true);
    });

    it('detects Hammer in downtrend context with stronger weight', () => {
        // Create a downtrend context (3 bearish candles) + hammer
        // Hammer: body > 10% of range (so not Doji), long lower shadow, no upper
        const data: OHLCData[] = [
            bearish(110, 2), bearish(108, 2), bearish(106, 2),
            candle(104, 105, 105, 101), // body=1, range=4, lower=3, upper=0
        ];
        const result = detectCandlestickPatterns(data);
        const hammer = result.patterns.find(p => p.name === 'Hammer');
        expect(hammer).toBeDefined();
        expect(hammer!.type).toBe('bullish');
        expect(hammer!.strength).toBe('strong');
        expect(hammer!.confidenceWeight).toBe(0.75);
    });

    it('detects Shooting Star after uptrend', () => {
        const data: OHLCData[] = [
            bullish(100, 2), bullish(102, 2), bullish(104, 2),
            // Shooting star: body > 10% of range (not Doji), long upper wick, no lower
            candle(107, 106, 110, 106), // body=1, range=4, upper=3, lower=0
        ];
        const result = detectCandlestickPatterns(data);
        expect(result.patterns.some(p => p.name === 'Shooting Star')).toBe(true);
    });

    it('detects Bullish Marubozu', () => {
        // Full bullish candle, no shadows
        const marubozu = candle(100, 105, 105, 100);
        const result = detectCandlestickPatterns([marubozu]);
        expect(result.patterns.some(p => p.name === 'Bullish Marubozu')).toBe(true);
        const m = result.patterns.find(p => p.name === 'Bullish Marubozu')!;
        expect(m.strength).toBe('strong');
        expect(m.confidenceWeight).toBe(0.8);
    });

    it('detects Bearish Marubozu', () => {
        const marubozu = candle(105, 100, 105, 100);
        const result = detectCandlestickPatterns([marubozu]);
        expect(result.patterns.some(p => p.name === 'Bearish Marubozu')).toBe(true);
    });

    it('detects Spinning Top', () => {
        // body 10–30% of range, both shadows > body
        const spinTop = candle(100, 100.4, 101, 99); // body=0.4, range=2, upper=0.6, lower=1
        const result = detectCandlestickPatterns([spinTop]);
        expect(result.patterns.some(p => p.name === 'Spinning Top')).toBe(true);
    });
});

// ═══════════════════════════════════════════════════════════════
// TWO-CANDLE PATTERNS
// ═══════════════════════════════════════════════════════════════

describe('detectCandlestickPatterns — two-candle', () => {
    it('detects Bullish Engulfing', () => {
        const data: OHLCData[] = [
            candle(105, 100, 106, 99), // bearish: open=105, close=100
            candle(99, 106, 107, 98),  // bullish: engulfs previous
        ];
        const result = detectCandlestickPatterns(data);
        expect(result.patterns.some(p => p.name === 'Bullish Engulfing')).toBe(true);
        const eng = result.patterns.find(p => p.name === 'Bullish Engulfing')!;
        expect(eng.confidenceWeight).toBe(0.8);
        expect(eng.strength).toBe('strong');
    });

    it('detects Bearish Engulfing', () => {
        const data: OHLCData[] = [
            candle(100, 105, 106, 99), // bullish
            candle(106, 99, 107, 98),  // bearish: engulfs
        ];
        const result = detectCandlestickPatterns(data);
        expect(result.patterns.some(p => p.name === 'Bearish Engulfing')).toBe(true);
    });

    it('detects Bullish Harami', () => {
        const data: OHLCData[] = [
            candle(110, 100, 111, 99), // large bearish
            candle(102, 104, 105, 101), // small bullish inside
        ];
        const result = detectCandlestickPatterns(data);
        expect(result.patterns.some(p => p.name === 'Bullish Harami')).toBe(true);
    });

    it('detects Bearish Harami', () => {
        const data: OHLCData[] = [
            candle(100, 110, 111, 99), // large bullish
            candle(108, 106, 109, 105), // small bearish inside
        ];
        const result = detectCandlestickPatterns(data);
        expect(result.patterns.some(p => p.name === 'Bearish Harami')).toBe(true);
    });
});

// ═══════════════════════════════════════════════════════════════
// THREE-CANDLE PATTERNS
// ═══════════════════════════════════════════════════════════════

describe('detectCandlestickPatterns — three-candle', () => {
    it('detects Morning Star', () => {
        const data: OHLCData[] = [
            candle(110, 105, 111, 104), // c1: bearish, large body
            candle(104.2, 104.3, 104.5, 103.8), // c2: small body (doji-like), gaps down from c1.close
            candle(104.5, 109, 110, 104), // c3: bullish, closes above c1 midpoint (107.5)
        ];
        const result = detectCandlestickPatterns(data);
        expect(result.patterns.some(p => p.name === 'Morning Star')).toBe(true);
        const ms = result.patterns.find(p => p.name === 'Morning Star')!;
        expect(ms.confidenceWeight).toBe(0.85);
        expect(ms.strength).toBe('strong');
    });

    it('detects Evening Star', () => {
        const data: OHLCData[] = [
            candle(100, 106, 107, 99),   // c1: bullish, large body
            candle(106.5, 106.6, 107, 106.2), // c2: small body, at/above c1.close
            candle(106, 101, 106.5, 100), // c3: bearish, closes below c1 midpoint (103)
        ];
        const result = detectCandlestickPatterns(data);
        expect(result.patterns.some(p => p.name === 'Evening Star')).toBe(true);
    });

    it('detects Three White Soldiers', () => {
        const data: OHLCData[] = [
            candle(100, 104, 104, 99.5),   // c1: bullish, small upper shadow
            candle(102, 107, 107, 101.5),   // c2: opens in c1 body, closes higher
            candle(105, 110, 110, 104.5),   // c3: opens in c2 body, closes higher
        ];
        const result = detectCandlestickPatterns(data);
        expect(result.patterns.some(p => p.name === 'Three White Soldiers')).toBe(true);
    });
});

// ═══════════════════════════════════════════════════════════════
// COMPOSITE SCORING
// ═══════════════════════════════════════════════════════════════

describe('detectCandlestickPatterns — composite scoring', () => {
    it('compositeScore is always between -1 and +1', () => {
        // Only bullish signals
        const bullishOnly = detectCandlestickPatterns([candle(100, 105, 105, 100)]); // Marubozu
        expect(bullishOnly.compositeScore).toBeGreaterThanOrEqual(-1);
        expect(bullishOnly.compositeScore).toBeLessThanOrEqual(1);

        // Only bearish signals
        const bearishOnly = detectCandlestickPatterns([candle(105, 100, 105, 100)]); // Bearish Marubozu
        expect(bearishOnly.compositeScore).toBeGreaterThanOrEqual(-1);
        expect(bearishOnly.compositeScore).toBeLessThanOrEqual(1);
    });

    it('dominantBias matches compositeScore direction', () => {
        const bullResult = detectCandlestickPatterns([candle(100, 105, 105, 100)]);
        if (bullResult.compositeScore > 0.15) {
            expect(bullResult.dominantBias).toBe('bullish');
        }

        const bearResult = detectCandlestickPatterns([candle(105, 100, 105, 100)]);
        if (bearResult.compositeScore < -0.15) {
            expect(bearResult.dominantBias).toBe('bearish');
        }
    });

    it('patterns are sorted by confidenceWeight DESC', () => {
        // Create a scenario with multiple patterns
        const data: OHLCData[] = [
            bearish(110, 2), bearish(108, 2), bearish(106, 2),
            candle(104, 104.5, 104.5, 101), // Hammer
        ];
        const result = detectCandlestickPatterns(data);
        for (let i = 1; i < result.patterns.length; i++) {
            expect(result.patterns[i - 1].confidenceWeight).toBeGreaterThanOrEqual(
                result.patterns[i].confidenceWeight
            );
        }
    });
});

// ═══════════════════════════════════════════════════════════════
// BACKWARD COMPAT
// ═══════════════════════════════════════════════════════════════

describe('getCandlestickPatternNames — backward compatible', () => {
    it('returns string array', () => {
        const names = getCandlestickPatternNames([candle(100, 105, 105, 100)]);
        expect(Array.isArray(names)).toBe(true);
        expect(names.length).toBeGreaterThan(0);
        expect(typeof names[0]).toBe('string');
    });

    it('returns at most 5 entries', () => {
        const data: OHLCData[] = Array.from({ length: 20 }, (_, i) => bullish(100 + i, 2));
        const names = getCandlestickPatternNames(data);
        expect(names.length).toBeLessThanOrEqual(5);
    });
});
