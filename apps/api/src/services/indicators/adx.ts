/**
 * ADX (Average Directional Index) Indicator
 * Measures trend strength regardless of direction
 * ADX > 25 = strong trend, ADX < 20 = choppy/no trend
 * @module @stock-assist/api/services/indicators/adx
 */

import type { OHLCData } from '@stock-assist/shared';

export interface ADXResult {
    adx: number;                      // 0-100, trend strength
    plusDI: number;                    // +DI (bullish pressure)
    minusDI: number;                  // -DI (bearish pressure)
    trendStrength: 'strong' | 'moderate' | 'weak' | 'choppy';
    trendDirection: 'bullish' | 'bearish' | 'neutral';
    adxHistory: number[];             // Last 5 ADX values for trend acceleration check
}

/**
 * Calculate ADX with +DI and -DI
 * Standard 14-period ADX calculation
 */
export function calcADX(data: OHLCData[], period: number = 14): ADXResult {
    if (data.length < period * 2 + 1) {
        return { adx: 0, plusDI: 0, minusDI: 0, trendStrength: 'choppy', trendDirection: 'neutral', adxHistory: [] };
    }

    // Step 1: Calculate True Range, +DM, -DM for each bar
    const trueRanges: number[] = [];
    const plusDMs: number[] = [];
    const minusDMs: number[] = [];

    for (let i = 1; i < data.length; i++) {
        const high = data[i].high;
        const low = data[i].low;
        const prevClose = data[i - 1].close;
        const prevHigh = data[i - 1].high;
        const prevLow = data[i - 1].low;

        // True Range = max(H-L, |H-prevC|, |L-prevC|)
        const tr = Math.max(
            high - low,
            Math.abs(high - prevClose),
            Math.abs(low - prevClose)
        );
        trueRanges.push(tr);

        // +DM = H - prevH (if positive and > -(L - prevL))
        const upMove = high - prevHigh;
        const downMove = prevLow - low;

        if (upMove > downMove && upMove > 0) {
            plusDMs.push(upMove);
        } else {
            plusDMs.push(0);
        }

        if (downMove > upMove && downMove > 0) {
            minusDMs.push(downMove);
        } else {
            minusDMs.push(0);
        }
    }

    // Step 2: Smooth using Wilder's method (first value = sum of period, then smooth)
    const smooth = (values: number[]): number[] => {
        const smoothed: number[] = [];
        let sum = 0;
        for (let i = 0; i < period; i++) {
            sum += values[i];
        }
        smoothed.push(sum);
        for (let i = period; i < values.length; i++) {
            smoothed.push(smoothed[smoothed.length - 1] - (smoothed[smoothed.length - 1] / period) + values[i]);
        }
        return smoothed;
    };

    const smoothTR = smooth(trueRanges);
    const smoothPlusDM = smooth(plusDMs);
    const smoothMinusDM = smooth(minusDMs);

    // Step 3: Calculate +DI and -DI
    const plusDIArray: number[] = [];
    const minusDIArray: number[] = [];
    const dxArray: number[] = [];

    for (let i = 0; i < smoothTR.length; i++) {
        if (smoothTR[i] === 0) {
            plusDIArray.push(0);
            minusDIArray.push(0);
            dxArray.push(0);
            continue;
        }

        const pdi = (smoothPlusDM[i] / smoothTR[i]) * 100;
        const mdi = (smoothMinusDM[i] / smoothTR[i]) * 100;
        plusDIArray.push(pdi);
        minusDIArray.push(mdi);

        const diSum = pdi + mdi;
        const dx = diSum === 0 ? 0 : (Math.abs(pdi - mdi) / diSum) * 100;
        dxArray.push(dx);
    }

    // Step 4: Calculate ADX as smoothed average of DX
    if (dxArray.length < period) {
        return { adx: 0, plusDI: 0, minusDI: 0, trendStrength: 'choppy', trendDirection: 'neutral', adxHistory: [] };
    }

    let adxSum = 0;
    for (let i = 0; i < period; i++) {
        adxSum += dxArray[i];
    }
    let adx = adxSum / period;

    // Collect ADX history for trend acceleration check (Phase E #11)
    const adxValues: number[] = [adx];

    // Continue smoothing ADX
    for (let i = period; i < dxArray.length; i++) {
        adx = ((adx * (period - 1)) + dxArray[i]) / period;
        adxValues.push(adx);
    }

    // Last 5 ADX values for acceleration check
    const adxHistory = adxValues.slice(-5).map(v => Number(v.toFixed(2)));

    // Get latest +DI and -DI
    const latestPlusDI = plusDIArray[plusDIArray.length - 1];
    const latestMinusDI = minusDIArray[minusDIArray.length - 1];

    // Determine trend strength
    let trendStrength: ADXResult['trendStrength'];
    if (adx >= 25) trendStrength = 'strong';
    else if (adx >= 20) trendStrength = 'moderate';
    else if (adx >= 15) trendStrength = 'weak';
    else trendStrength = 'choppy';

    // Determine trend direction from DI crossover
    let trendDirection: ADXResult['trendDirection'];
    if (latestPlusDI > latestMinusDI && adx >= 20) trendDirection = 'bullish';
    else if (latestMinusDI > latestPlusDI && adx >= 20) trendDirection = 'bearish';
    else trendDirection = 'neutral';

    return {
        adx: Number(adx.toFixed(2)),
        plusDI: Number(latestPlusDI.toFixed(2)),
        minusDI: Number(latestMinusDI.toFixed(2)),
        trendStrength,
        trendDirection,
        adxHistory,
    };
}
