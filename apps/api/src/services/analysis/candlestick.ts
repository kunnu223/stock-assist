/**
 * Candlestick Pattern Detector
 * @module @stock-assist/api/services/analysis/candlestick
 */

import type { OHLCData } from '@stock-assist/shared';

export interface CandlestickPattern {
    name: string;
    type: 'bullish' | 'bearish' | 'neutral';
    reliability: 'high' | 'medium' | 'low';
    index: number; // Position in data array
}

/**
 * Detect candlestick patterns in OHLC data
 */
export const detectCandlestickPatterns = (data: OHLCData[]): CandlestickPattern[] => {
    if (data.length < 3) return [];

    const patterns: CandlestickPattern[] = [];
    const len = data.length;

    // Analyze last 5 candles for recent patterns
    for (let i = Math.max(0, len - 5); i < len; i++) {
        const current = data[i];
        const prev = i > 0 ? data[i - 1] : null;
        const prev2 = i > 1 ? data[i - 2] : null;

        const body = Math.abs(current.close - current.open);
        const range = current.high - current.low;
        const upperWick = current.high - Math.max(current.open, current.close);
        const lowerWick = Math.min(current.open, current.close) - current.low;
        const isBullish = current.close > current.open;

        // Doji - small body, long wicks
        if (body < range * 0.1 && range > 0) {
            patterns.push({
                name: 'Doji',
                type: 'neutral',
                reliability: 'medium',
                index: i,
            });
        }

        // Hammer - small body at top, long lower wick (bullish reversal)
        if (lowerWick > body * 2 && upperWick < body * 0.5 && body > 0) {
            patterns.push({
                name: 'Hammer',
                type: 'bullish',
                reliability: 'high',
                index: i,
            });
        }

        // Inverted Hammer / Shooting Star
        if (upperWick > body * 2 && lowerWick < body * 0.5 && body > 0) {
            // Context matters: after downtrend = inverted hammer (bullish), after uptrend = shooting star (bearish)
            const contextBearish = prev && prev.close > current.close;
            patterns.push({
                name: contextBearish ? 'Shooting Star' : 'Inverted Hammer',
                type: contextBearish ? 'bearish' : 'bullish',
                reliability: 'medium',
                index: i,
            });
        }

        // Bullish Engulfing
        if (prev && isBullish && !prevIsBullish(prev) && body > 0) {
            const prevBody = Math.abs(prev.close - prev.open);
            if (current.open < prev.close && current.close > prev.open && body > prevBody) {
                patterns.push({
                    name: 'Bullish Engulfing',
                    type: 'bullish',
                    reliability: 'high',
                    index: i,
                });
            }
        }

        // Bearish Engulfing
        if (prev && !isBullish && prevIsBullish(prev) && body > 0) {
            const prevBody = Math.abs(prev.close - prev.open);
            if (current.open > prev.close && current.close < prev.open && body > prevBody) {
                patterns.push({
                    name: 'Bearish Engulfing',
                    type: 'bearish',
                    reliability: 'high',
                    index: i,
                });
            }
        }

        // Morning Star (3-candle bullish reversal)
        if (prev && prev2 && !prevIsBullish(prev2) && isBullish) {
            const prev2Body = Math.abs(prev2.close - prev2.open);
            const prevBody = Math.abs(prev.close - prev.open);
            if (prev2Body > prevBody * 3 && body > prevBody * 2 && current.close > (prev2.open + prev2.close) / 2) {
                patterns.push({
                    name: 'Morning Star',
                    type: 'bullish',
                    reliability: 'high',
                    index: i,
                });
            }
        }

        // Evening Star (3-candle bearish reversal)
        if (prev && prev2 && prevIsBullish(prev2) && !isBullish) {
            const prev2Body = Math.abs(prev2.close - prev2.open);
            const prevBody = Math.abs(prev.close - prev.open);
            if (prev2Body > prevBody * 3 && body > prevBody * 2 && current.close < (prev2.open + prev2.close) / 2) {
                patterns.push({
                    name: 'Evening Star',
                    type: 'bearish',
                    reliability: 'high',
                    index: i,
                });
            }
        }

        // Marubozu (strong conviction candle)
        if (body > range * 0.9 && range > 0) {
            patterns.push({
                name: isBullish ? 'Bullish Marubozu' : 'Bearish Marubozu',
                type: isBullish ? 'bullish' : 'bearish',
                reliability: 'medium',
                index: i,
            });
        }
    }

    return patterns;
};

/** Helper to check if a candle is bullish */
const prevIsBullish = (candle: OHLCData): boolean => candle.close > candle.open;

/**
 * Get recent candlestick patterns as string array (for AI prompt)
 */
export const getCandlestickPatternNames = (data: OHLCData[]): string[] => {
    const patterns = detectCandlestickPatterns(data);
    // Return unique pattern names from recent candles
    const unique = [...new Set(patterns.map((p) => `${p.name} (${p.type})`))];
    return unique.slice(0, 5); // Limit to 5 most recent
};
