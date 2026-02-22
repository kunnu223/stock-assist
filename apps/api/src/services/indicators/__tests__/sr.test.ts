import { describe, it, expect } from 'vitest';
import { calcSR } from '../sr';
import type { OHLCData } from '@stock-assist/shared';

function makeOHLC(count: number): OHLCData[] {
    return Array.from({ length: count }, (_, i) => ({
        date: new Date(2024, 0, i + 1).toISOString(),
        open: 100 + i,
        high: 105 + i,
        low: 95 + i,
        close: 102 + i,
        volume: 1000000,
    }));
}

describe('calcSR', () => {
    it('returns fallback levels for very short data', () => {
        const data = makeOHLC(3);
        const result = calcSR(data);
        expect(result.support).toBeLessThan(result.resistance);
        expect(result.pivot).toBeGreaterThan(0);
    });

    it('calculates pivot from last candle', () => {
        const data = makeOHLC(20);
        const last = data[data.length - 1];
        const expectedPivot = (last.high + last.low + last.close) / 3;
        expect(result(data).pivot).toBeCloseTo(expectedPivot, 1);
    });

    it('resistance >= support', () => {
        const data = makeOHLC(30);
        const result = calcSR(data);
        expect(result.resistance).toBeGreaterThanOrEqual(result.support);
    });

    it('R1 > pivot > S1', () => {
        const data = makeOHLC(30);
        const result = calcSR(data);
        expect(result.r1).toBeGreaterThan(result.pivot);
        expect(result.pivot).toBeGreaterThan(result.s1);
    });

    it('R2 > R1 and S2 < S1', () => {
        const data = makeOHLC(30);
        const result = calcSR(data);
        expect(result.r2).toBeGreaterThan(result.r1);
        expect(result.s2).toBeLessThan(result.s1);
    });

    it('all values are finite numbers', () => {
        const data = makeOHLC(30);
        const result = calcSR(data);
        for (const key of ['support', 'resistance', 'pivot', 'r1', 'r2', 's1', 's2'] as const) {
            expect(Number.isFinite(result[key])).toBe(true);
        }
    });
});

// Helper to call calcSR with inline usage
function result(data: OHLCData[]) {
    return calcSR(data);
}
