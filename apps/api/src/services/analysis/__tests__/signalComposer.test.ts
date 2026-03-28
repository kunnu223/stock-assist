import { describe, it, expect } from 'vitest';
import { composeSignal } from '../signalComposer';
import type { SMCAnalysis } from '@stock-assist/shared';

/** Build an empty SMC analysis */
function emptySMC(): SMCAnalysis {
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

/** Build a high-conviction bullish SMC analysis */
function fullBullishSMC(): SMCAnalysis {
    return {
        orderBlocks: [{
            zone: { high: 105, low: 100 },
            type: 'bullish',
            status: 'unmitigated',
            age: 5,
            strengthBoost: 0.15,
            formationIndex: 10,
        }],
        fairValueGaps: [{
            zone: { high: 120, low: 115 },
            type: 'bullish',
            filled: false,
            createdAtIndex: 12,
        }],
        bosEvents: [{
            type: 'bullish',
            index: 14,
            priceAtEvent: 112,
        }],
        chochEvents: [{
            type: 'bullish',
            index: 11,
            priceAtEvent: 108,
            confirmed: true,
        }],
        liquiditySweeps: [{
            type: 'bullish',
            sweepExtreme: 95,
            closePrice: 103,
            confirmed: true,
            convictionBoost: 0.15,
            index: 9,
        }],
        swingPoints: [
            { index: 5, price: 110, type: 'high' },
            { index: 8, price: 95, type: 'low' },
        ],
        trendState: 'uptrend',
    };
}

describe('composeSignal', () => {
    it('returns NO_SETUP when no signals exist', () => {
        const result = composeSignal({
            ticker: 'RELIANCE',
            smc: emptySMC(),
            currentPrice: 100,
            atr: 3,
            adxValue: 25,
            volumeRatio: 1.0,
            weeklyTrend: 'neutral',
            monthlyTrend: 'neutral',
            dailyTrend: 'neutral',
        });
        expect(result.status).toBe('NO_SETUP');
        expect(result.direction).toBe('none');
        expect(result.convictionScore).toBeLessThan(55);
    });

    it('generates high conviction with full bullish confluence', () => {
        const result = composeSignal({
            ticker: 'TATASTEEL',
            smc: fullBullishSMC(),
            currentPrice: 103,
            atr: 3,
            adxValue: 30, // Trending market
            volumeRatio: 2.0,
            weeklyTrend: 'bullish',
            monthlyTrend: 'bullish',
            dailyTrend: 'bullish',
            candlestickAnalysis: {
                patterns: [{ name: 'Bullish Engulfing', type: 'bullish', strength: 'strong', confidenceWeight: 0.8, description: 'test', candles: 2 }],
                bullishCount: 1,
                bearishCount: 0,
                dominantBias: 'bullish',
                compositeScore: 0.8,
                summary: 'Bullish',
            },
        });
        expect(result.direction).toBe('bullish');
        expect(result.convictionScore).toBeGreaterThanOrEqual(55);
        expect(result.explanation.length).toBeGreaterThan(0);
        // Should be WAITING_FOR_ENTRY or SETUP_ACTIVE depending on entry zone validity
        expect(['SETUP_ACTIVE', 'WAITING_FOR_ENTRY', 'NO_SETUP']).toContain(result.status);
    });

    it('applies ADX ranging dampener when ADX < 20', () => {
        const trending = composeSignal({
            ticker: 'TEST',
            smc: fullBullishSMC(),
            currentPrice: 103,
            atr: 3,
            adxValue: 30,
            volumeRatio: 2.0,
            weeklyTrend: 'bullish',
            monthlyTrend: 'bullish',
            dailyTrend: 'bullish',
        });

        const ranging = composeSignal({
            ticker: 'TEST',
            smc: fullBullishSMC(),
            currentPrice: 103,
            atr: 3,
            adxValue: 15, // Below 20 → dampener
            volumeRatio: 2.0,
            weeklyTrend: 'bullish',
            monthlyTrend: 'bullish',
            dailyTrend: 'bullish',
        });

        // Ranging conviction should be 15 points lower
        expect(ranging.convictionScore).toBe(trending.convictionScore - 15);
    });

    it('returns correct MTF alignment data', () => {
        const result = composeSignal({
            ticker: 'TEST',
            smc: fullBullishSMC(),
            currentPrice: 103,
            atr: 3,
            adxValue: 25,
            volumeRatio: 1.5,
            weeklyTrend: 'bullish',
            monthlyTrend: 'bearish',
            dailyTrend: 'bullish',
        });

        expect(result.mtfAlignment.weeklyTrend).toBe('bullish');
        expect(result.mtfAlignment.dailySetup).toBe('bullish'); // CHoCH detected
        expect(result.mtfAlignment.alignmentScore).toBeGreaterThan(0);
    });

    it('populates smcSummary correctly', () => {
        const result = composeSignal({
            ticker: 'TEST',
            smc: fullBullishSMC(),
            currentPrice: 103,
            atr: 3,
            adxValue: 25,
            volumeRatio: 1.5,
            weeklyTrend: 'bullish',
            monthlyTrend: 'bullish',
            dailyTrend: 'bullish',
        });

        expect(result.smcSummary.chochDetected).toBe(true);
        expect(result.smcSummary.sweepDetected).toBe(true);
        expect(result.smcSummary.unmitigatedOBCount).toBe(1);
        expect(result.smcSummary.unfilledFVGCount).toBe(1);
    });

    it('generates volume partial credit', () => {
        const low = composeSignal({
            ticker: 'TEST',
            smc: fullBullishSMC(),
            currentPrice: 103,
            atr: 3,
            adxValue: 25,
            volumeRatio: 0.5,
            weeklyTrend: 'bullish',
            monthlyTrend: 'bullish',
            dailyTrend: 'bullish',
        });

        const high = composeSignal({
            ticker: 'TEST',
            smc: fullBullishSMC(),
            currentPrice: 103,
            atr: 3,
            adxValue: 25,
            volumeRatio: 2.0,
            weeklyTrend: 'bullish',
            monthlyTrend: 'bullish',
            dailyTrend: 'bullish',
        });

        // High volume should have higher conviction
        expect(high.convictionScore).toBeGreaterThan(low.convictionScore);
    });

    it('conviction never exceeds 100 or goes below 0', () => {
        const result = composeSignal({
            ticker: 'TEST',
            smc: fullBullishSMC(),
            currentPrice: 103,
            atr: 3,
            adxValue: 30,
            volumeRatio: 5.0,
            weeklyTrend: 'bullish',
            monthlyTrend: 'bullish',
            dailyTrend: 'bullish',
            candlestickAnalysis: {
                patterns: [{ name: 'Bullish Engulfing', type: 'bullish', strength: 'strong', confidenceWeight: 1, description: 'test', candles: 2 }],
                bullishCount: 1,
                bearishCount: 0,
                dominantBias: 'bullish',
                compositeScore: 1.0,
                summary: 'Test',
            },
        });

        expect(result.convictionScore).toBeGreaterThanOrEqual(0);
        expect(result.convictionScore).toBeLessThanOrEqual(100);
    });
});
