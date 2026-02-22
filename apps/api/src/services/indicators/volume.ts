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
        return { macd: 0, signal: 0, histogram: 0, trend: 'neutral', divergence: 'none' };
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

    // Build full histogram array for divergence checking
    const histogramArray: number[] = [];
    const signalOffset = macdLine.length - signalArray.length;
    for (let i = 0; i < signalArray.length; i++) {
        histogramArray.push(macdLine[i + signalOffset] - signalArray[i]);
    }

    const macd = Number(macdLine[macdLine.length - 1].toFixed(2));
    const signal = Number(signalArray[signalArray.length - 1].toFixed(2));
    const histogram = Number(histogramArray[histogramArray.length - 1].toFixed(2));

    let trend: 'bullish' | 'bearish' | 'neutral' = 'neutral';
    if (histogram > 0 && macd > 0) trend = 'bullish';
    else if (histogram < 0 && macd < 0) trend = 'bearish';

    let divergence: 'bullish' | 'bearish' | 'none' = 'none';
    const LOOKBACK = 20;

    if (prices.length >= LOOKBACK && histogramArray.length >= LOOKBACK) {
        const recentPrices = prices.slice(-LOOKBACK);
        const recentHistograms = histogramArray.slice(-LOOKBACK);

        const currentPrice = recentPrices[recentPrices.length - 1];
        const currentHist = recentHistograms[recentHistograms.length - 1];

        const maxClose = Math.max(...recentPrices.slice(0, LOOKBACK - 1));
        const minClose = Math.min(...recentPrices.slice(0, LOOKBACK - 1));

        // Bearish divergence: Price makes higher high, MACD histogram fails to make higher high
        if (currentPrice > maxClose) {
            const maxHist = Math.max(...recentHistograms.slice(0, LOOKBACK - 1));
            // Require histogram to be positive for valid bearish divergence check
            if (maxHist > 0 && currentHist < maxHist * 0.8) {
                divergence = 'bearish';
            }
        }
        // Bullish divergence: Price makes lower low, MACD histogram fails to make lower low
        else if (currentPrice < minClose) {
            const minHist = Math.min(...recentHistograms.slice(0, LOOKBACK - 1));
            // Require histogram to be negative for valid bullish divergence check
            if (minHist < 0 && currentHist > minHist * 0.8) {
                divergence = 'bullish';
            }
        }
    }

    return { macd, signal, histogram, trend, divergence };
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

/** Calculate VWAP over a specific period (e.g., 5 for weekly VWAP on daily charts) */
export const calcVWAP = (data: OHLCData[], period: number = 5): number => {
    if (data.length < period) return 0;
    const recent = data.slice(-period);
    let cumulativeTypicalPriceVolume = 0;
    let cumulativeVolume = 0;

    for (const d of recent) {
        const typicalPrice = (d.high + d.low + d.close) / 3;
        cumulativeTypicalPriceVolume += typicalPrice * d.volume;
        cumulativeVolume += d.volume;
    }

    if (cumulativeVolume === 0) return 0;
    return Number((cumulativeTypicalPriceVolume / cumulativeVolume).toFixed(2));
};
