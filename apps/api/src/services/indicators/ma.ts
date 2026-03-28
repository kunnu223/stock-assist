/**
 * Moving Averages Calculator
 * @module @stock-assist/api/services/indicators/ma
 */

import type { MAResult } from '@stock-assist/shared';

/** Calculate Simple Moving Average */
export const calcSMA = (prices: number[], period: number): number => {
    if (prices.length < period) {
        return prices.length > 0 ? prices[prices.length - 1] : 0;
    }
    const slice = prices.slice(-period);
    return Number((slice.reduce((a, b) => a + b, 0) / period).toFixed(2));
};

/** Calculate Exponential Moving Average */
export const calcEMA = (prices: number[], period: number): number => {
    if (prices.length < period) {
        return calcSMA(prices, prices.length);
    }
    const mult = 2 / (period + 1);
    let ema = calcSMA(prices.slice(0, period), period);

    for (let i = period; i < prices.length; i++) {
        ema = (prices[i] - ema) * mult + ema;
    }
    return Number(ema.toFixed(2));
};

/** Calculate full EMA array (returns EMA value at each point from period onwards) */
export const calcEMAArray = (prices: number[], period: number): number[] => {
    if (prices.length < period) return [];
    const mult = 2 / (period + 1);
    let ema = calcSMA(prices.slice(0, period), period);
    const result: number[] = [ema];

    for (let i = period; i < prices.length; i++) {
        ema = (prices[i] - ema) * mult + ema;
        result.push(ema);
    }
    return result;
};

/** Calculate all moving averages */
export const calcMA = (prices: number[]): MAResult => {
    const current = prices.length > 0 ? prices[prices.length - 1] : 0;
    const sma20 = calcSMA(prices, 20);
    const sma50 = calcSMA(prices, 50);
    const sma200 = calcSMA(prices, 200);

    // Percentage distance from MAs (0.5% buffer to avoid false signals at exact crossing)
    const pctAbove20 = sma20 > 0 ? ((current - sma20) / sma20) * 100 : 0;
    const pctAbove50 = sma50 > 0 ? ((current - sma50) / sma50) * 100 : 0;

    const above20 = pctAbove20 > 0.5;
    const above50 = pctAbove50 > 0.5;
    const below20 = pctAbove20 < -0.5;
    const below50 = pctAbove50 < -0.5;

    let trend: 'bullish' | 'bearish' | 'neutral' = 'neutral';

    if (above20 && above50 && sma20 > sma50) trend = 'bullish';
    else if (below20 && below50 && sma20 < sma50) trend = 'bearish';
    else if (below20 && !above50 && sma20 > sma50) trend = 'bearish';
    else if (!below20 && above50 && sma20 < sma50) trend = 'bullish';

    return {
        sma20,
        sma50,
        sma200,
        ema9: calcEMA(prices, 9),
        ema21: calcEMA(prices, 21),
        trend,
    };
};
