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

/** Calculate all moving averages */
export const calcMA = (prices: number[]): MAResult => {
    const current = prices.length > 0 ? prices[prices.length - 1] : 0;
    const sma20 = calcSMA(prices, 20);
    const sma50 = calcSMA(prices, 50);
    const sma200 = calcSMA(prices, 200);

    const above20 = current > sma20;
    const above50 = current > sma50;
    let trend: 'bullish' | 'bearish' | 'neutral' = 'neutral';

    if (above20 && above50 && sma20 > sma50) trend = 'bullish';
    else if (!above20 && !above50 && sma20 < sma50) trend = 'bearish';

    return {
        sma20,
        sma50,
        sma200,
        ema9: calcEMA(prices, 9),
        ema21: calcEMA(prices, 21),
        trend,
    };
};
