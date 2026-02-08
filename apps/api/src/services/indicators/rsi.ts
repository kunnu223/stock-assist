/**
 * RSI Calculator
 * @module @stock-assist/api/services/indicators/rsi
 */

import type { RSIResult } from '@stock-assist/shared';

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
    else if (value <= 30) interpretation = 'oversold';

    return { value, interpretation };
};
