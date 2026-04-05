/**
 * Indicators Service - Main export
 * @module @stock-assist/api/services/indicators
 */

import type { OHLCData, TechnicalIndicators } from '@stock-assist/shared';
import { calcMA } from './ma';
import { calcRSI, SECTOR_RSI_PERIODS } from './rsi';
import { calcSR } from './sr';
import { analyzeVolume, calcMACD, calcATR, calcVWAP } from './volume';
import { calcADX } from './adx';

/** Calculate all technical indicators (sector-optimized when sector provided) */
export const calcIndicators = (data: OHLCData[], sector?: string): TechnicalIndicators => {
    const prices = data.map((d) => d.close);
    const rsiPeriod = SECTOR_RSI_PERIODS[sector || ''] || SECTOR_RSI_PERIODS['default'];

    return {
        rsi: calcRSI(prices, rsiPeriod),
        ma: calcMA(prices),
        sr: calcSR(data),
        volume: analyzeVolume(data),
        macd: calcMACD(prices, sector),
        atr: calcATR(data),
        vwap: calcVWAP(data, 5),
    };
};

export { calcSMA, calcEMA, calcMA } from './ma';
export { calcRSI, detectRSIDivergence } from './rsi';
export { calcSR } from './sr';
export { analyzeVolume, calcMACD, calcATR, calcVWAP, macdHistogramMomentum, volumeTrend, buildMACDHistogramArray } from './volume';
export { calcBollingerBands, calcFibonacciLevels } from './bollinger';
export { calcADX } from './adx';
