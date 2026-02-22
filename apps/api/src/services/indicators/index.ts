/**
 * Indicators Service - Main export
 * @module @stock-assist/api/services/indicators
 */

import type { OHLCData, TechnicalIndicators } from '@stock-assist/shared';
import { calcMA } from './ma';
import { calcRSI } from './rsi';
import { calcSR } from './sr';
import { analyzeVolume, calcMACD, calcATR, calcVWAP } from './volume';
import { calcADX } from './adx';

/** Calculate all technical indicators */
export const calcIndicators = (data: OHLCData[]): TechnicalIndicators => {
    const prices = data.map((d) => d.close);

    return {
        rsi: calcRSI(prices),
        ma: calcMA(prices),
        sr: calcSR(data),
        volume: analyzeVolume(data),
        macd: calcMACD(prices),
        atr: calcATR(data),
        vwap: calcVWAP(data, 5), // 5 period (Weekly) VWAP
    };
};

export { calcSMA, calcEMA, calcMA } from './ma';
export { calcRSI } from './rsi';
export { calcSR } from './sr';
export { analyzeVolume, calcMACD, calcATR, calcVWAP } from './volume';
export { calcBollingerBands, calcFibonacciLevels } from './bollinger';
export { calcADX } from './adx';
