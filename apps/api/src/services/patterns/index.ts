/**
 * Pattern Service - Main export
 * @module @stock-assist/api/services/patterns
 */

import type { OHLCData, PatternAnalysis, PatternResult } from '@stock-assist/shared';
import { detectBullishFlag, detectAscTriangle, detectSupportBounce } from './bullish';
import { detectBearishFlag, detectDescTriangle, detectResistanceRej } from './bearish';
import { detectTrend, isAtBreakout, isAtBreakdown } from './trend';

/** Analyze all patterns */
export const analyzePatterns = (data: OHLCData[]): PatternAnalysis => {
    const patterns: PatternResult[] = [];

    // Bullish patterns
    const bullFlag = detectBullishFlag(data);
    if (bullFlag) patterns.push(bullFlag);

    const ascTri = detectAscTriangle(data);
    if (ascTri) patterns.push(ascTri);

    const supBounce = detectSupportBounce(data);
    if (supBounce) patterns.push(supBounce);

    // Bearish patterns
    const bearFlag = detectBearishFlag(data);
    if (bearFlag) patterns.push(bearFlag);

    const descTri = detectDescTriangle(data);
    if (descTri) patterns.push(descTri);

    const resRej = detectResistanceRej(data);
    if (resRej) patterns.push(resRej);

    // Sort by confidence
    patterns.sort((a, b) => b.confidence - a.confidence);

    return {
        primary: patterns[0] || null,
        secondary: patterns.slice(1),
        trend: detectTrend(data),
        atBreakout: isAtBreakout(data),
        atBreakdown: isAtBreakdown(data),
    };
};

export * from './bullish';
export * from './bearish';
export * from './trend';
