import { describe, it, expect } from 'vitest';
import { analyzeVolume, calcMACD, calcATR, calcVWAP } from '../volume';
import type { OHLCData } from '@stock-assist/shared';

/** Generate test OHLC data */
function makeOHLC(count: number, opts?: { volumeMultiplier?: number; trend?: 'up' | 'down' | 'flat' }): OHLCData[] {
    const vm = opts?.volumeMultiplier || 1;
    const trend = opts?.trend || 'flat';
    return Array.from({ length: count }, (_, i) => {
        const base = trend === 'up' ? 100 + i * 2 : trend === 'down' ? 200 - i * 2 : 100;
        return {
            date: new Date(2024, 0, i + 1).toISOString(),
            open: base - 1,
            high: base + 3,
            low: base - 3,
            close: base,
            volume: 1000000 * vm,
        };
    });
}

describe('analyzeVolume', () => {
    it('returns normal volume for consistent data', () => {
        const data = makeOHLC(20);
        const result = analyzeVolume(data);
        expect(result.ratio).toBe(1);
        expect(result.trend).toBe('normal');
    });

    it('returns default values for insufficient data', () => {
        const data = makeOHLC(2);
        const result = analyzeVolume(data);
        expect(result.current).toBe(0);
        expect(result.trend).toBe('normal');
    });

    it('detects high volume', () => {
        const data = makeOHLC(20);
        // Spike last candle volume
        data[data.length - 1].volume = 5000000;
        const result = analyzeVolume(data);
        expect(result.ratio).toBeGreaterThan(1.5);
        expect(result.trend).toBe('high');
    });
});

describe('calcMACD', () => {
    it('returns zeroes for insufficient data', () => {
        const prices = Array.from({ length: 10 }, (_, i) => 100 + i);
        const result = calcMACD(prices);
        expect(result.macd).toBe(0);
        expect(result.signal).toBe(0);
        expect(result.trend).toBe('neutral');
    });

    it('returns positive MACD for strong uptrend', () => {
        const prices = Array.from({ length: 50 }, (_, i) => 100 + i * 3);
        const result = calcMACD(prices);
        expect(result.macd).toBeGreaterThan(0);
        // Trend may or may not be 'bullish' based on histogram sign
        expect(['bullish', 'neutral']).toContain(result.trend);
    });

    it('returns negative MACD for strong downtrend', () => {
        const prices = Array.from({ length: 50 }, (_, i) => 300 - i * 3);
        const result = calcMACD(prices);
        expect(result.macd).toBeLessThan(0);
        expect(['bearish', 'neutral']).toContain(result.trend);
    });

    it('returns all required fields', () => {
        const prices = Array.from({ length: 50 }, (_, i) => 100 + i);
        const result = calcMACD(prices);
        expect(result).toHaveProperty('macd');
        expect(result).toHaveProperty('signal');
        expect(result).toHaveProperty('histogram');
        expect(result).toHaveProperty('trend');
    });
});

describe('calcATR', () => {
    it('returns 0 for insufficient data', () => {
        const data = makeOHLC(5);
        expect(calcATR(data)).toBe(0);
    });

    it('calculates positive ATR for valid data', () => {
        const data = makeOHLC(30, { trend: 'up' });
        const atr = calcATR(data);
        expect(atr).toBeGreaterThan(0);
    });

    it('ATR reflects volatility (wider range = higher ATR)', () => {
        const narrow = makeOHLC(30);
        const wide = makeOHLC(30);
        wide.forEach(d => {
            d.high = d.close + 20;
            d.low = d.close - 20;
        });
        expect(calcATR(wide)).toBeGreaterThan(calcATR(narrow));
    });
});

describe('calcVWAP', () => {
    it('returns 0 for insufficient data', () => {
        expect(calcVWAP(makeOHLC(2), 5)).toBe(0);
    });

    it('returns weighted average price for valid data', () => {
        const data = makeOHLC(10);
        const vwap = calcVWAP(data, 5);
        expect(vwap).toBeGreaterThan(0);
    });

    it('handles zero volume gracefully', () => {
        const data = makeOHLC(10);
        data.forEach(d => d.volume = 0);
        expect(calcVWAP(data, 5)).toBe(0);
    });
});
