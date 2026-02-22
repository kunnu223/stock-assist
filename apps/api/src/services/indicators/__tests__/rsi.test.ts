import { describe, it, expect } from 'vitest';
import { calcRSI } from '../rsi';

describe('calcRSI', () => {
    it('returns neutral 50 when insufficient data', () => {
        const result = calcRSI([100, 101, 102]);
        expect(result.value).toBe(50);
        expect(result.interpretation).toBe('neutral');
    });

    it('returns 100 (overbought) when price only goes up', () => {
        // 15 ascending prices → all gains, zero losses → RSI = 100
        const prices = Array.from({ length: 20 }, (_, i) => 100 + i);
        const result = calcRSI(prices);
        expect(result.value).toBe(100);
        expect(result.interpretation).toBe('overbought');
    });

    it('returns overbought when RSI >= 70', () => {
        // Strong uptrend with minor dips
        const prices = [
            100, 102, 104, 103, 106, 108, 107, 110,
            112, 114, 113, 116, 118, 120, 122, 124
        ];
        const result = calcRSI(prices);
        expect(result.value).toBeGreaterThanOrEqual(70);
        expect(result.interpretation).toBe('overbought');
    });

    it('returns oversold when RSI <= 30', () => {
        // Strong downtrend
        const prices = [
            200, 198, 196, 197, 194, 192, 193, 190,
            188, 186, 187, 184, 182, 180, 178, 176
        ];
        const result = calcRSI(prices);
        expect(result.value).toBeLessThanOrEqual(30);
        expect(result.interpretation).toBe('oversold');
    });

    it('returns neutral for sideways prices', () => {
        // Alternating up/down → ~50 RSI
        const prices = [
            100, 101, 100, 101, 100, 101, 100, 101,
            100, 101, 100, 101, 100, 101, 100, 101
        ];
        const result = calcRSI(prices);
        expect(result.value).toBeGreaterThan(30);
        expect(result.value).toBeLessThan(70);
        expect(result.interpretation).toBe('neutral');
    });

    it('returns a value between 0 and 100', () => {
        const prices = [100, 105, 103, 108, 106, 110, 109, 112, 108, 115, 113, 118, 116, 120, 119, 122];
        const result = calcRSI(prices);
        expect(result.value).toBeGreaterThanOrEqual(0);
        expect(result.value).toBeLessThanOrEqual(100);
    });

    it('respects custom period', () => {
        const prices = Array.from({ length: 30 }, (_, i) => 100 + i);
        const r7 = calcRSI(prices, 7);
        const r14 = calcRSI(prices, 14);
        // Both should be overbought for monotonic uptrend
        expect(r7.value).toBe(100);
        expect(r14.value).toBe(100);
    });
});
