/**
 * Bullish Pattern Detectors
 * @module @stock-assist/api/services/patterns/bullish
 */

import type { OHLCData, PatternResult } from '@stock-assist/shared';

/** Detect Bullish Flag */
export const detectBullishFlag = (data: OHLCData[]): PatternResult | null => {
    if (data.length < 15) return null;

    const recent = data.slice(-15);
    const closes = recent.map((d) => d.close);

    // Pole: strong upward move (first 7 candles)
    const poleStart = closes[0];
    const poleEnd = closes[6];
    const poleChange = ((poleEnd - poleStart) / poleStart) * 100;

    // Flag: consolidation (last 8 candles)
    const flagStart = closes[7];
    const flagEnd = closes[closes.length - 1];
    const flagChange = ((flagEnd - flagStart) / flagStart) * 100;

    if (poleChange > 3 && flagChange > -2 && flagChange < 1) {
        const confidence = Math.min(75 + poleChange * 2, 95);
        return {
            name: 'bullish_flag',
            type: 'bullish',
            confidence: Math.round(confidence),
            description: `Flag after ${poleChange.toFixed(1)}% rally`,
            targetPrice: flagEnd + (poleEnd - poleStart),
        };
    }
    return null;
};

/** Detect Ascending Triangle */
export const detectAscTriangle = (data: OHLCData[]): PatternResult | null => {
    if (data.length < 15) return null;

    const recent = data.slice(-15);
    const highs = recent.map((d) => d.high);
    const lows = recent.map((d) => d.low);

    const maxHigh = Math.max(...highs);
    const nearMax = highs.filter((h) => h >= maxHigh * 0.98);

    const firstLows = lows.slice(0, 7).reduce((a, b) => a + b, 0) / 7;
    const lastLows = lows.slice(7).reduce((a, b) => a + b, 0) / (lows.length - 7);

    if (nearMax.length >= 3 && lastLows > firstLows * 1.01) {
        return {
            name: 'ascending_triangle',
            type: 'bullish',
            confidence: 75,
            description: 'Higher lows with flat resistance',
            targetPrice: maxHigh + (maxHigh - Math.min(...lows)),
        };
    }
    return null;
};

/** Detect Support Bounce */
export const detectSupportBounce = (data: OHLCData[]): PatternResult | null => {
    if (data.length < 10) return null;

    const last = data[data.length - 1];
    const prev = data[data.length - 2];
    const support = Math.min(...data.slice(-20).map((d) => d.low));

    if (prev.low <= support * 1.01 && last.close > prev.close && last.close > last.open) {
        return {
            name: 'support_bounce',
            type: 'bullish',
            confidence: 65,
            description: `Bounce from support at ₹${support.toFixed(0)}`,
            stopLoss: support * 0.99,
        };
    }
    return null;
};
