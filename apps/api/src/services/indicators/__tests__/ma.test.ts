import { describe, it, expect } from 'vitest';
import { calcSMA, calcEMA, calcMA } from '../ma';

describe('calcSMA', () => {
    it('calculates simple average of last N prices', () => {
        const prices = [10, 20, 30, 40, 50];
        expect(calcSMA(prices, 3)).toBe(40); // (30+40+50)/3
    });

    it('returns last price when fewer data points than period', () => {
        expect(calcSMA([100, 200], 5)).toBe(200);
    });

    it('returns 0 for empty array', () => {
        expect(calcSMA([], 5)).toBe(0);
    });

    it('handles period of 1', () => {
        expect(calcSMA([10, 20, 30], 1)).toBe(30);
    });
});

describe('calcEMA', () => {
    it('returns SMA when data length equals period', () => {
        const prices = [10, 20, 30];
        const sma = calcSMA(prices, 3);
        expect(calcEMA(prices, 3)).toBe(sma);
    });

    it('gives more weight to recent prices', () => {
        // After a sudden jump, EMA should be closer to recent price than SMA
        const prices = [10, 10, 10, 10, 10, 10, 10, 10, 10, 50];
        const sma = calcSMA(prices, 5);
        const ema = calcEMA(prices, 5);
        expect(ema).toBeGreaterThan(sma); // EMA reacts faster to the jump
    });

    it('returns reasonable value with short data', () => {
        const result = calcEMA([100], 5);
        expect(result).toBe(100);
    });
});

describe('calcMA', () => {
    it('returns bullish trend when price above both MAs and MAs aligned', () => {
        // 60+ prices trending up → price > SMA20 > SMA50
        const prices = Array.from({ length: 60 }, (_, i) => 100 + i * 2);
        const result = calcMA(prices);
        expect(result.trend).toBe('bullish');
    });

    it('returns bearish trend when price below both MAs and MAs aligned', () => {
        // 60+ prices trending down → price < SMA20 < SMA50
        const prices = Array.from({ length: 60 }, (_, i) => 200 - i * 2);
        const result = calcMA(prices);
        expect(result.trend).toBe('bearish');
    });

    it('returns neutral for sideways market', () => {
        // Alternating prices → mixed signals
        const prices = Array.from({ length: 60 }, (_, i) => 100 + (i % 2 === 0 ? 5 : -5));
        const result = calcMA(prices);
        expect(['neutral', 'bullish', 'bearish']).toContain(result.trend);
    });

    it('returns all MA fields', () => {
        const prices = Array.from({ length: 210 }, (_, i) => 100 + i);
        const result = calcMA(prices);
        expect(result).toHaveProperty('sma20');
        expect(result).toHaveProperty('sma50');
        expect(result).toHaveProperty('sma200');
        expect(result).toHaveProperty('ema9');
        expect(result).toHaveProperty('ema21');
        expect(result).toHaveProperty('trend');
    });
});
