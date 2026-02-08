/**
 * Volume & MACD Calculator
 * @module @stock-assist/api/services/indicators/volume
 */

import type { OHLCData, VolumeAnalysis, MACDResult } from '@stock-assist/shared';
import { calcEMA } from './ma';

/** Analyze volume */
export const analyzeVolume = (data: OHLCData[]): VolumeAnalysis => {
    if (data.length < 5) {
        return { current: 0, average: 0, ratio: 1, trend: 'normal' };
    }

    const volumes = data.map((d) => d.volume);
    const current = volumes[volumes.length - 1];
    const average = volumes.reduce((a, b) => a + b, 0) / volumes.length;
    const ratio = Number((current / average).toFixed(2));

    let trend: 'high' | 'normal' | 'low' = 'normal';
    if (ratio > 1.5) trend = 'high';
    else if (ratio < 0.5) trend = 'low';

    return { current, average: Math.round(average), ratio, trend };
};

/** Calculate MACD */
export const calcMACD = (prices: number[]): MACDResult => {
    const ema12 = calcEMA(prices, 12);
    const ema26 = calcEMA(prices, 26);
    const macd = Number((ema12 - ema26).toFixed(2));
    const signal = Number((macd * 0.9).toFixed(2)); // Approximation
    const histogram = Number((macd - signal).toFixed(2));

    let trend: 'bullish' | 'bearish' | 'neutral' = 'neutral';
    if (histogram > 0 && macd > 0) trend = 'bullish';
    else if (histogram < 0 && macd < 0) trend = 'bearish';

    return { macd, signal, histogram, trend };
};

/** Calculate ATR */
export const calcATR = (data: OHLCData[], period: number = 14): number => {
    if (data.length < period + 1) return 0;

    const trs: number[] = [];
    for (let i = 1; i < data.length; i++) {
        const tr = Math.max(
            data[i].high - data[i].low,
            Math.abs(data[i].high - data[i - 1].close),
            Math.abs(data[i].low - data[i - 1].close)
        );
        trs.push(tr);
    }

    const recent = trs.slice(-period);
    return Number((recent.reduce((a, b) => a + b, 0) / period).toFixed(2));
};
