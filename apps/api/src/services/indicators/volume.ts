/**
 * Volume & MACD Calculator
 * @module @stock-assist/api/services/indicators/volume
 */

import type { OHLCData, VolumeAnalysis, MACDResult } from '@stock-assist/shared';
import { calcEMA, calcEMAArray } from './ma';

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

/**
 * Calculate MACD with proper EMA9 signal line
 * MACD Line = EMA12 - EMA26
 * Signal Line = EMA9 of MACD Line (NOT an approximation)
 * Histogram = MACD Line - Signal Line
 */
export const calcMACD = (prices: number[]): MACDResult => {
    if (prices.length < 26) {
        return { macd: 0, signal: 0, histogram: 0, trend: 'neutral' };
    }

    // Build full EMA12 and EMA26 arrays
    const ema12Array = calcEMAArray(prices, 12);
    const ema26Array = calcEMAArray(prices, 26);

    // MACD line = EMA12 - EMA26 (aligned from period-26 onwards)
    // ema12Array starts at index 12, ema26Array starts at index 26
    // We need to align them: ema26Array[0] corresponds to price[26]
    // ema12Array[14] also corresponds to price[26] (12 + 14 = 26)
    const offset = 26 - 12; // = 14
    const macdLine: number[] = [];
    for (let i = 0; i < ema26Array.length; i++) {
        macdLine.push(ema12Array[i + offset] - ema26Array[i]);
    }

    // Signal line = EMA9 of MACD line
    if (macdLine.length < 9) {
        const lastMacd = macdLine[macdLine.length - 1] || 0;
        return { macd: Number(lastMacd.toFixed(2)), signal: 0, histogram: Number(lastMacd.toFixed(2)), trend: 'neutral' };
    }

    const signalArray = calcEMAArray(macdLine, 9);
    const macd = Number(macdLine[macdLine.length - 1].toFixed(2));
    const signal = Number(signalArray[signalArray.length - 1].toFixed(2));
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
