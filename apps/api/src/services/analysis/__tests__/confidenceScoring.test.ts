import { describe, it, expect } from 'vitest';
import { calculateConfidence } from '../confidenceScoring';

/** Build a minimal scoring input with overrides */
function mockScoringInput(overrides: Record<string, any> = {}): any {
    return {
        patterns: {
            primary: 'Bullish Engulfing',
            secondary: [],
            strength: 70,
            direction: 'bullish' as const,
            patterns: ['Bullish Engulfing'],
            trend: 'bullish' as const,
            atBreakout: false,
            atBreakdown: false,
        },
        news: {
            items: [],
            sentiment: 'neutral' as const,
            sentimentScore: 0,
            impactLevel: 'low' as const,
            latestHeadlines: [],
            dataFreshness: 1,
        },
        indicators: {
            rsi: { value: 55, interpretation: 'neutral' as const },
            ma: { sma20: 100, sma50: 95, sma200: 90, ema9: 105, ema21: 100, trend: 'bullish' as const },
            sr: { support: 90, resistance: 110, pivot: 100, r1: 105, r2: 110, s1: 95, s2: 90 },
            volume: { current: 1000000, average: 1000000, ratio: 1.0, trend: 'normal' as const },
            macd: { macd: 2, signal: 1, histogram: 1, trend: 'bullish' as const },
            atr: 3,
            vwap: 102,
        },
        fundamentals: {
            valuation: 'fair' as const,
            growth: 'moderate' as const,
            metrics: { peRatio: 20, pbRatio: 3, marketCap: 100000, dividendYield: 2, eps: 10, bookValue: 50 },
            peRatio: 20,
            pbRatio: 3,
            marketCap: 100000,
            dividendYield: 2,
            eps: 10,
            bookValue: 50,
            sectorComparison: 'inline' as const,
        },
        ...overrides,
    };
}

describe('calculateConfidence', () => {
    it('returns score between 0 and 100', () => {
        const result = calculateConfidence(mockScoringInput());
        expect(result.score).toBeGreaterThanOrEqual(0);
        expect(result.score).toBeLessThanOrEqual(100);
    });

    it('returns all required fields', () => {
        const result = calculateConfidence(mockScoringInput());
        expect(result).toHaveProperty('score');
        expect(result).toHaveProperty('breakdown');
        expect(result).toHaveProperty('factors');
        expect(result).toHaveProperty('recommendation');
        expect(Array.isArray(result.factors)).toBe(true);
    });

    it('breakdown fields are all numbers 0-100', () => {
        const result = calculateConfidence(mockScoringInput());
        const fields = ['patternStrength', 'newsSentiment', 'technicalAlignment', 'volumeConfirmation', 'fundamentalStrength'] as const;
        for (const field of fields) {
            expect(result.breakdown[field]).toBeGreaterThanOrEqual(0);
            expect(result.breakdown[field]).toBeLessThanOrEqual(100);
        }
    });

    it('recommendation is one of valid values', () => {
        const result = calculateConfidence(mockScoringInput());
        expect(['BUY', 'SELL', 'HOLD', 'WAIT']).toContain(result.recommendation);
    });

    it('produces different scores for bullish vs bearish inputs', () => {
        const bullish = calculateConfidence(mockScoringInput({
            patterns: { primary: 'Bullish Engulfing', strength: 85, direction: 'bullish', patterns: ['Bullish Engulfing'], trend: 'bullish', atBreakout: false, atBreakdown: false },
            indicators: {
                ...mockScoringInput().indicators,
                rsi: { value: 45, interpretation: 'neutral' },
                ma: { sma20: 100, sma50: 95, sma200: 90, ema9: 105, ema21: 100, trend: 'bullish' },
            },
        }));

        const bearish = calculateConfidence(mockScoringInput({
            patterns: { primary: 'Bearish Engulfing', strength: 85, direction: 'bearish', patterns: ['Bearish Engulfing'], trend: 'bearish', atBreakout: false, atBreakdown: false },
            indicators: {
                ...mockScoringInput().indicators,
                rsi: { value: 75, interpretation: 'overbought' },
                ma: { sma20: 90, sma50: 95, sma200: 100, ema9: 85, ema21: 90, trend: 'bearish' },
            },
        }));

        // Both should produce valid scores
        expect(bullish.score).toBeGreaterThanOrEqual(0);
        expect(bullish.score).toBeLessThanOrEqual(100);
        expect(bearish.score).toBeGreaterThanOrEqual(0);
        expect(bearish.score).toBeLessThanOrEqual(100);
        // Scores should differ given different inputs
        expect(bullish.breakdown.technicalAlignment).not.toBe(bearish.breakdown.technicalAlignment);
    });

    it('high impact negative news reduces confidence', () => {
        const neutral = calculateConfidence(mockScoringInput());
        const negativeNews = calculateConfidence(mockScoringInput({
            news: {
                items: [{ title: 'Bad earnings', sentiment: -0.8 }],
                sentiment: 'negative',
                sentimentScore: -80,
                impactLevel: 'high',
                latestHeadlines: ['Bad earnings report'],
                dataFreshness: 1,
            },
        }));

        // Negative news should reduce confidence
        expect(negativeNews.breakdown.newsSentiment).toBeLessThan(neutral.breakdown.newsSentiment);
    });
});
