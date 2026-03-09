import { describe, it, expect } from 'vitest';
import { generateFallbackAnalysis, formatPatternsWithStars, buildDefaultBullishScenario, buildDefaultBearishScenario } from '../responseBuilder';

// ═══════════════════════════════════════════════════════════════
// MOCKS
// ═══════════════════════════════════════════════════════════════

function mockStock(): any {
    return {
        symbol: 'RELIANCE',
        quote: { price: 2500, changePercent: 1.5 },
        history: [],
        timeframes: {}
    };
}

function mockConfidence(): any {
    return {
        score: 72,
        recommendation: 'BUY',
        breakdown: {
            patternStrength: 70,
            newsSentiment: 55,
            technicalAlignment: 80,
            volumeConfirmation: 65,
            fundamentalStrength: 60,
        },
        factors: ['Bullish MA crossover', 'Price above support', 'Bearish divergence'],
        direction: { direction: 'BULLISH', conviction: 75 },
        strength: { strength: 'MODERATE', regime: 'TRENDING_WEAK' }
    };
}

function mockTechnicalAnalysis(): any {
    return {
        indicators: {
            daily: {
                sr: { support: 2400, resistance: 2600, r1: 2700, s1: 2300 }
            }
        },
        multiTimeframe: { alignment: 'ALIGNED' }
    };
}

function mockFundamentals(): any {
    return {
        valuation: 'fair',
        growth: 'moderate',
        metrics: { peRatio: 25, pbRatio: 3, marketCap: 1700000, dividendYield: 1.2, eps: 100, bookValue: 800 },
        peRatio: 25, pbRatio: 3, marketCap: 1700000, dividendYield: 1.2, eps: 100, bookValue: 800,
        sectorComparison: 'inline'
    };
}

// ═══════════════════════════════════════════════════════════════
// TESTS
// ═══════════════════════════════════════════════════════════════

describe('responseBuilder', () => {
    describe('generateFallbackAnalysis', () => {
        it('returns all required fields', () => {
            const result = generateFallbackAnalysis(
                mockStock(),
                mockConfidence(),
                mockTechnicalAnalysis(),
                mockFundamentals()
            );

            expect(result).toHaveProperty('symbol', 'RELIANCE');
            expect(result).toHaveProperty('currentPrice', 2500);
            expect(result).toHaveProperty('recommendation', 'BUY');
            expect(result).toHaveProperty('confidenceScore', 72);
            expect(result).toHaveProperty('bias', 'BULLISH');
            expect(result).toHaveProperty('priceTargets');
            expect(result).toHaveProperty('bullish');
            expect(result).toHaveProperty('bearish');
            expect(result).toHaveProperty('risks');
            expect(result).toHaveProperty('reasoning');
        });

        it('sets BEARISH bias for SELL recommendation', () => {
            const conf = mockConfidence();
            conf.recommendation = 'SELL';
            const result = generateFallbackAnalysis(mockStock(), conf, mockTechnicalAnalysis(), mockFundamentals());
            expect(result.bias).toBe('BEARISH');
        });

        it('sets NEUTRAL bias for HOLD recommendation', () => {
            const conf = mockConfidence();
            conf.recommendation = 'HOLD';
            const result = generateFallbackAnalysis(mockStock(), conf, mockTechnicalAnalysis(), mockFundamentals());
            expect(result.bias).toBe('NEUTRAL');
        });

        it('categorizes by confidence score', () => {
            const high = { ...mockConfidence(), score: 75 };
            const low = { ...mockConfidence(), score: 30 };

            const resultHigh = generateFallbackAnalysis(mockStock(), high, mockTechnicalAnalysis(), mockFundamentals());
            const resultLow = generateFallbackAnalysis(mockStock(), low, mockTechnicalAnalysis(), mockFundamentals());

            expect(resultHigh.category).toBe('STRONG_SETUP');
            expect(resultLow.category).toBe('AVOID');
        });

        it('filters bullish factors into bullish scenario', () => {
            const result = generateFallbackAnalysis(mockStock(), mockConfidence(), mockTechnicalAnalysis(), mockFundamentals());
            expect(result.bullish.factors).toContain('Bullish MA crossover');
            expect(result.bullish.factors).not.toContain('Bearish divergence');
        });
    });

    describe('formatPatternsWithStars', () => {
        it('returns "No significant patterns" for undefined input', () => {
            expect(formatPatternsWithStars(undefined)).toEqual(['No significant patterns']);
        });

        it('returns "No significant patterns" for empty patterns', () => {
            expect(formatPatternsWithStars({ patterns: [], strength: 50 })).toEqual(['No significant patterns']);
        });

        it('adds stars based on strength', () => {
            const result = formatPatternsWithStars({ patterns: ['Bullish Engulfing'], strength: 85 });
            expect(result[0]).toContain('⭐⭐⭐');
        });

        it('adds fewer stars for lower strength', () => {
            const result = formatPatternsWithStars({ patterns: ['Doji'], strength: 45 });
            expect(result[0]).toContain('⭐');
            expect(result[0]).not.toContain('⭐⭐');
        });

        it('adds no stars for very low strength', () => {
            const result = formatPatternsWithStars({ patterns: ['Hammer'], strength: 30 });
            expect(result[0]).toBe('Hammer');
        });
    });

    describe('buildDefaultBullishScenario', () => {
        it('returns expected structure', () => {
            const sr = { support: 2400, resistance: 2600 };
            const result = buildDefaultBullishScenario(mockStock(), sr, 65, 80);

            expect(result.probability).toBe(65);
            expect(result.score).toBe(80);
            expect(result.trigger).toContain('2600');
            expect(result.tradePlan.action).toBe('BUY');
            expect(result.timeHorizon).toBe('3-7 days');
        });
    });

    describe('buildDefaultBearishScenario', () => {
        it('returns expected structure', () => {
            const sr = { support: 2400, resistance: 2600 };
            const result = buildDefaultBearishScenario(mockStock(), sr, 35, 80);

            expect(result.probability).toBe(35);
            expect(result.score).toBe(20); // 100 - 80
            expect(result.trigger).toContain('2400');
            expect(result.tradePlan.action).toBe('AVOID');
            expect(result.timeHorizon).toBe('1-5 days');
        });
    });
});
