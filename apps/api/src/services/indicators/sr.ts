/**
 * Support & Resistance Calculator
 * @module @stock-assist/api/services/indicators/sr
 */

import type { OHLCData, SRLevels } from '@stock-assist/shared';

/** Calculate support and resistance levels */
export const calcSR = (data: OHLCData[]): SRLevels => {
    if (data.length < 5) {
        const price = data[data.length - 1]?.close || 0;
        return {
            support: price * 0.98,
            resistance: price * 1.02,
            pivot: price,
            r1: price * 1.01,
            r2: price * 1.02,
            s1: price * 0.99,
            s2: price * 0.98,
        };
    }

    const last = data[data.length - 1];
    const { high, low, close } = last;

    // Pivot point calculation
    const pivot = (high + low + close) / 3;
    const r1 = 2 * pivot - low;
    const r2 = pivot + (high - low);
    const s1 = 2 * pivot - high;
    const s2 = pivot - (high - low);

    // Find recent support/resistance from price action
    const recent = data.slice(-20);
    const highs = recent.map((d) => d.high);
    const lows = recent.map((d) => d.low);

    const resistance = Math.max(...highs);
    const support = Math.min(...lows);

    return {
        support: Number(support.toFixed(2)),
        resistance: Number(resistance.toFixed(2)),
        pivot: Number(pivot.toFixed(2)),
        r1: Number(r1.toFixed(2)),
        r2: Number(r2.toFixed(2)),
        s1: Number(s1.toFixed(2)),
        s2: Number(s2.toFixed(2)),
    };
};
