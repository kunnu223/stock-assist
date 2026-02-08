/**
 * Bearish Pattern Detectors
 * @module @stock-assist/api/services/patterns/bearish
 */

import type { OHLCData, PatternResult } from '@stock-assist/shared';

/** Detect Bearish Flag */
export const detectBearishFlag = (data: OHLCData[]): PatternResult | null => {
    if (data.length < 15) return null;

    const recent = data.slice(-15);
    const closes = recent.map((d) => d.close);

    // Pole: strong downward move
    const poleStart = closes[0];
    const poleEnd = closes[6];
    const poleChange = ((poleEnd - poleStart) / poleStart) * 100;

    // Flag: slight uptick
    const flagStart = closes[7];
    const flagEnd = closes[closes.length - 1];
    const flagChange = ((flagEnd - flagStart) / flagStart) * 100;

    if (poleChange < -3 && flagChange > -1 && flagChange < 2) {
        const confidence = Math.min(75 + Math.abs(poleChange) * 2, 95);
        return {
            name: 'bearish_flag',
            type: 'bearish',
            confidence: Math.round(confidence),
            description: `Flag after ${Math.abs(poleChange).toFixed(1)}% decline`,
            targetPrice: flagEnd - Math.abs(poleEnd - poleStart),
        };
    }
    return null;
};

/** Detect Descending Triangle */
export const detectDescTriangle = (data: OHLCData[]): PatternResult | null => {
    if (data.length < 15) return null;

    const recent = data.slice(-15);
    const highs = recent.map((d) => d.high);
    const lows = recent.map((d) => d.low);

    const minLow = Math.min(...lows);
    const nearMin = lows.filter((l) => l <= minLow * 1.02);

    const firstHighs = highs.slice(0, 7).reduce((a, b) => a + b, 0) / 7;
    const lastHighs = highs.slice(7).reduce((a, b) => a + b, 0) / (highs.length - 7);

    if (nearMin.length >= 3 && lastHighs < firstHighs * 0.99) {
        return {
            name: 'descending_triangle',
            type: 'bearish',
            confidence: 75,
            description: 'Lower highs with flat support',
            targetPrice: minLow - (Math.max(...highs) - minLow),
        };
    }
    return null;
};

/** Detect Resistance Rejection */
export const detectResistanceRej = (data: OHLCData[]): PatternResult | null => {
    if (data.length < 10) return null;

    const last = data[data.length - 1];
    const prev = data[data.length - 2];
    const resistance = Math.max(...data.slice(-20).map((d) => d.high));

    if (prev.high >= resistance * 0.99 && last.close < prev.close && last.close < last.open) {
        return {
            name: 'resistance_rejection',
            type: 'bearish',
            confidence: 65,
            description: `Rejection from resistance at ₹${resistance.toFixed(0)}`,
            stopLoss: resistance * 1.01,
        };
    }
    return null;
};
