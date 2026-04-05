/**
 * RSI Calculator
 * @module @stock-assist/api/services/indicators/rsi
 */

import type { RSIResult } from '@stock-assist/shared';

/** Sector-optimized RSI periods (Inumula 2019, +470% vs standard on NIFTY 50) */
export const SECTOR_RSI_PERIODS: Record<string, number> = {
    'IT': 9, 'Automobiles': 9, 'Energy': 9,
    'Metals': 7, 'Pharmaceuticals': 11,
    'Financials': 12, 'FMCG': 11, 'default': 10,
};

/** Calculate RSI (Relative Strength Index) */
export const calcRSI = (prices: number[], period: number = 14): RSIResult => {
    if (prices.length < period + 1) {
        return { value: 50, interpretation: 'neutral' };
    }

    const changes: number[] = [];
    for (let i = 1; i < prices.length; i++) {
        changes.push(prices[i] - prices[i - 1]);
    }

    const recent = changes.slice(-period);
    let gains = 0;
    let losses = 0;

    recent.forEach((change) => {
        if (change > 0) gains += change;
        else losses += Math.abs(change);
    });

    const avgGain = gains / period;
    const avgLoss = losses / period;

    if (avgLoss === 0) {
        return { value: 100, interpretation: 'overbought' };
    }

    const rs = avgGain / avgLoss;
    const rsi = 100 - 100 / (1 + rs);
    const value = Number(rsi.toFixed(2));

    let interpretation: 'oversold' | 'neutral' | 'overbought' = 'neutral';
    if (value >= 70) interpretation = 'overbought';
    else if (value <= 40) interpretation = 'oversold';

    return { value, interpretation };
};

/**
 * RSI Divergence Detection (Phase 2, item 2.5)
 *
 * Compares price swing points with RSI swing points over a lookback window.
 * - Bearish divergence: price makes higher high, RSI makes lower high
 * - Bullish divergence: price makes lower low, RSI makes higher low
 *
 * @param prices - Close prices array
 * @param period - RSI period
 * @param lookback - Number of bars to check for divergence (default 20)
 * @returns 'bullish' | 'bearish' | 'none'
 */
export function detectRSIDivergence(
    prices: number[],
    period: number = 14,
    lookback: number = 20
): 'bullish' | 'bearish' | 'none' {
    if (prices.length < period + lookback) return 'none';

    // Build RSI array for the lookback window
    const rsiValues: number[] = [];
    for (let i = prices.length - lookback; i <= prices.length; i++) {
        const slice = prices.slice(0, i);
        const result = calcRSI(slice, period);
        rsiValues.push(result.value);
    }

    if (rsiValues.length < lookback) return 'none';

    const recentPrices = prices.slice(-lookback);
    const currentPrice = recentPrices[recentPrices.length - 1];
    const currentRSI = rsiValues[rsiValues.length - 1];

    // Find previous swing highs/lows in the lookback (exclude last 2 bars)
    const prevPrices = recentPrices.slice(0, -2);
    const prevRSIs = rsiValues.slice(0, -2);

    const maxPriceIdx = prevPrices.indexOf(Math.max(...prevPrices));
    const minPriceIdx = prevPrices.indexOf(Math.min(...prevPrices));

    // Bearish divergence: price higher high + RSI lower high
    if (currentPrice > prevPrices[maxPriceIdx]) {
        const prevRSIAtHigh = prevRSIs[maxPriceIdx];
        if (prevRSIAtHigh > 55 && currentRSI < prevRSIAtHigh - 3) {
            return 'bearish';
        }
    }

    // Bullish divergence: price lower low + RSI higher low
    if (currentPrice < prevPrices[minPriceIdx]) {
        const prevRSIAtLow = prevRSIs[minPriceIdx];
        if (prevRSIAtLow < 45 && currentRSI > prevRSIAtLow + 3) {
            return 'bullish';
        }
    }

    return 'none';
}
