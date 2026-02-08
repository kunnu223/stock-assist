/**
 * Bollinger Bands Calculator
 * @module @stock-assist/api/services/indicators/bollinger
 */

import { calcSMA } from './ma';

export interface BollingerBands {
    upper: number;
    middle: number;
    lower: number;
    bandwidth: number;
    position: 'above_upper' | 'upper_half' | 'middle' | 'lower_half' | 'below_lower';
    percentB: number; // %B indicator (0-1, can exceed)
}

/**
 * Calculate Bollinger Bands
 * @param prices - Array of closing prices
 * @param period - Period for SMA (default 20)
 * @param stdDev - Standard deviation multiplier (default 2)
 */
export const calcBollingerBands = (
    prices: number[],
    period: number = 20,
    stdDev: number = 2
): BollingerBands => {
    if (prices.length < period) {
        const current = prices[prices.length - 1] || 0;
        return {
            upper: current,
            middle: current,
            lower: current,
            bandwidth: 0,
            position: 'middle',
            percentB: 0.5,
        };
    }

    const slice = prices.slice(-period);
    const middle = calcSMA(prices, period);

    // Calculate standard deviation
    const squaredDiffs = slice.map((p) => Math.pow(p - middle, 2));
    const variance = squaredDiffs.reduce((a, b) => a + b, 0) / period;
    const sd = Math.sqrt(variance);

    const upper = Number((middle + stdDev * sd).toFixed(2));
    const lower = Number((middle - stdDev * sd).toFixed(2));
    const bandwidth = Number(((upper - lower) / middle * 100).toFixed(2));

    const current = prices[prices.length - 1];
    const percentB = upper !== lower ? (current - lower) / (upper - lower) : 0.5;

    let position: BollingerBands['position'];
    if (current > upper) {
        position = 'above_upper';
    } else if (current > middle + (upper - middle) / 2) {
        position = 'upper_half';
    } else if (current < lower) {
        position = 'below_lower';
    } else if (current < middle - (middle - lower) / 2) {
        position = 'lower_half';
    } else {
        position = 'middle';
    }

    return {
        upper,
        middle: Number(middle.toFixed(2)),
        lower,
        bandwidth,
        position,
        percentB: Number(percentB.toFixed(3)),
    };
};

/**
 * Calculate Fibonacci Retracement Levels
 * Based on recent high/low
 */
export const calcFibonacciLevels = (prices: number[]): {
    high: number;
    low: number;
    levels: { level: string; price: number }[];
} => {
    if (prices.length < 5) {
        const p = prices[prices.length - 1] || 0;
        return { high: p, low: p, levels: [] };
    }

    const high = Math.max(...prices);
    const low = Math.min(...prices);
    const diff = high - low;

    const fibLevels = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1];
    const levels = fibLevels.map((fib) => ({
        level: `${(fib * 100).toFixed(1)}%`,
        price: Number((high - diff * fib).toFixed(2)),
    }));

    return { high, low, levels };
};
