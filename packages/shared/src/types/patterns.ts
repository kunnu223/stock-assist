/**
 * Pattern Types - Chart pattern detection results
 * @module @stock-assist/shared/types/patterns
 */

/** Pattern type enum */
export type PatternType =
    | 'bullish_flag'
    | 'bearish_flag'
    | 'ascending_triangle'
    | 'descending_triangle'
    | 'double_bottom'
    | 'double_top'
    | 'support_bounce'
    | 'resistance_rejection'
    | 'breakout'
    | 'breakdown';

/** Pattern detection result */
export interface PatternResult {
    name: PatternType;
    type: 'bullish' | 'bearish';
    confidence: number;
    description: string;
    targetPrice?: number;
    stopLoss?: number;
}

/** Trend analysis result */
export interface TrendResult {
    direction: 'uptrend' | 'downtrend' | 'sideways';
    strength: number;
    consolidating: boolean;
}

/** Complete pattern analysis */
export interface PatternAnalysis {
    primary: PatternResult | null;
    secondary: PatternResult[];
    trend: TrendResult;
    atBreakout: boolean;
    atBreakdown: boolean;
}
