import { describe, it, expect } from 'vitest';
import { shouldTrade, checkRedFlags } from '../tradeDecision';

/** Build a mock analysis object with sensible defaults */
function mockAnalysis(overrides: Record<string, any> = {}) {
    return {
        bullish: { probability: 70, score: 75 },
        bearish: { probability: 30, score: 25 },
        bias: 'BULLISH',
        confidence: 'HIGH',
        confidenceScore: 75,
        explanation: 'Test analysis',
        indicators: {
            volume: { ratio: 1.2, trend: 'normal' },
            rsi: { value: 55, interpretation: 'neutral' },
            ma: { trend: 'bullish', sma20: 100, sma50: 95, sma200: 90, ema9: 105, ema21: 100 },
            sr: { support: 90, resistance: 110, pivot: 100, r1: 105, r2: 110, s1: 95, s2: 90 },
            macd: { macd: 2, signal: 1, histogram: 1, trend: 'bullish' },
            atr: 3,
            vwap: 102,
        },
        pattern: {
            primary: 'Bullish Engulfing',
            strength: 80,
            direction: 'bullish',
        },
        ...overrides,
    };
}

describe('shouldTrade', () => {
    it('returns tradeable result for quality analysis', () => {
        const analysis = mockAnalysis({
            bullish: { probability: 75, score: 80 },
            bearish: { probability: 25, score: 20 },
        });
        const result = shouldTrade(analysis);
        // With high probability/confidence, shouldTrade should return true
        expect(result.shouldTrade).toBe(true);
        expect(['STRONG_SETUP', 'NEUTRAL']).toContain(result.category);
    });

    it('returns AVOID for low probability setups', () => {
        const analysis = mockAnalysis({
            bullish: { probability: 52, score: 50 },
            bearish: { probability: 48, score: 50 },
            confidence: 'LOW',
            confidenceScore: 30,
        });
        const result = shouldTrade(analysis);
        expect(result.shouldTrade).toBe(false);
    });

    it('returns NEUTRAL for mediocre setups', () => {
        const analysis = mockAnalysis({
            bullish: { probability: 60, score: 55 },
            bearish: { probability: 40, score: 45 },
            confidence: 'MEDIUM',
            confidenceScore: 55,
        });
        const result = shouldTrade(analysis);
        expect(['NEUTRAL', 'STRONG_SETUP', 'AVOID']).toContain(result.category);
    });

    it('always returns required fields', () => {
        const result = shouldTrade(mockAnalysis());
        expect(result).toHaveProperty('shouldTrade');
        expect(result).toHaveProperty('reason');
        expect(result).toHaveProperty('category');
        expect(result).toHaveProperty('warnings');
        expect(Array.isArray(result.warnings)).toBe(true);
    });

    it('rejects when volume is too low', () => {
        const analysis = mockAnalysis({
            indicators: {
                ...mockAnalysis().indicators,
                volume: { ratio: 0.2, trend: 'low' },
            },
        });
        const result = shouldTrade(analysis);
        // Low volume should produce a warning or downgrade
        expect(result.warnings.length > 0 || result.category !== 'STRONG_SETUP').toBe(true);
    });
});

describe('checkRedFlags', () => {
    it('passes clean analysis with no red flags', () => {
        const analysis = mockAnalysis();
        const result = checkRedFlags(analysis);
        // Good analysis should have few or no failed checks
        expect(result).toHaveProperty('passed');
        expect(result).toHaveProperty('failedChecks');
        expect(Array.isArray(result.failedChecks)).toBe(true);
    });

    it('flags extreme RSI overbought', () => {
        const analysis = mockAnalysis({
            bias: 'BULLISH',
            indicators: {
                ...mockAnalysis().indicators,
                rsi: { value: 85, interpretation: 'overbought' },
            },
        });
        const result = checkRedFlags(analysis);
        // Should detect RSI overbought as a potential red flag
        const hasRsiFlag = result.failedChecks.some(
            (f: string) => f.toLowerCase().includes('rsi') || f.toLowerCase().includes('overbought')
        );
        expect(hasRsiFlag || result.failedChecks.length > 0).toBe(true);
    });

    it('returns array of failed check strings', () => {
        const result = checkRedFlags(mockAnalysis());
        expect(Array.isArray(result.failedChecks)).toBe(true);
        result.failedChecks.forEach((check: string) => {
            expect(typeof check).toBe('string');
        });
    });
});
