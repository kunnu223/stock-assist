/**
 * Trend Detection
 * @module @stock-assist/api/services/patterns/trend
 */

import type { OHLCData, TrendResult } from '@stock-assist/shared';

/** Detect overall trend */
export const detectTrend = (data: OHLCData[]): TrendResult => {
    if (data.length < 10) {
        return { direction: 'sideways', strength: 0, consolidating: false };
    }

    const closes = data.map((d) => d.close).slice(-20);
    const n = closes.length;

    // Linear regression slope
    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
    for (let i = 0; i < n; i++) {
        sumX += i;
        sumY += closes[i];
        sumXY += i * closes[i];
        sumX2 += i * i;
    }

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const avgPrice = sumY / n;
    const slopePercent = (slope / avgPrice) * 100;

    let direction: 'uptrend' | 'downtrend' | 'sideways' = 'sideways';
    let strength = Math.min(Math.abs(slopePercent) * 10, 100);

    if (slopePercent > 0.1) direction = 'uptrend';
    else if (slopePercent < -0.1) direction = 'downtrend';

    // Check consolidation
    const maxDev = Math.max(...closes.map((c) => Math.abs(c - avgPrice)));
    const consolidating = (maxDev / avgPrice) * 100 < 2;

    return { direction, strength: Math.round(strength), consolidating };
};

/** Check if at breakout level */
export const isAtBreakout = (data: OHLCData[]): boolean => {
    if (data.length < 20) return false;
    const current = data[data.length - 1].close;
    const max = Math.max(...data.slice(-20).map((d) => d.high));
    return current >= max * 0.99;
};

/** Check if at breakdown level */
export const isAtBreakdown = (data: OHLCData[]): boolean => {
    if (data.length < 20) return false;
    const current = data[data.length - 1].close;
    const min = Math.min(...data.slice(-20).map((d) => d.low));
    return current <= min * 1.01;
};
