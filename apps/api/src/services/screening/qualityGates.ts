/**
 * Quality Gates Module
 * Applies strict filters after clarity scoring to ensure signal quality.
 * 
 * Gate 1: Volatility — reject if ATR-based daily volatility > 5%
 * Gate 2: Volume validation — penalize high-clarity signals without volume confirmation
 * Gate 3: Liquidity — reject if volume < 50% of 20-day average
 */

import type { OHLCData } from '@stock-assist/shared';
import { calcATR } from '../indicators/volume';
import type { SignalClarityResult, IndicatorSignal } from './signalClarity';

// ─── Types ──────────────────────────────────────────────

export interface QualityGateResult {
    passed: boolean;
    reason?: string;
    confidenceAdjustment: number;  // Positive = boost, Negative = penalty
    gatesPassed: string[];
    gatesFailed: string[];
}

// ─── Gate Functions ─────────────────────────────────────

/**
 * Gate 1: Volatility Check
 * Reject stocks with daily volatility > 5% (too unpredictable)
 */
function checkVolatility(data: OHLCData[]): { passed: boolean; reason?: string; volatility: number } {
    if (data.length < 15) {
        return { passed: true, volatility: 0 }; // Not enough data to judge
    }

    const atr = calcATR(data, 14);
    const currentPrice = data[data.length - 1].close;
    const volatilityPercent = (atr / currentPrice) * 100;

    if (volatilityPercent > 5) {
        return {
            passed: false,
            reason: `Volatility ${volatilityPercent.toFixed(1)}% > 5% threshold`,
            volatility: volatilityPercent,
        };
    }

    return { passed: true, volatility: volatilityPercent };
}

/**
 * Gate 2: Volume Validation
 * If clarity >= 80% but volume doesn't confirm → confidence penalty (not rejection)
 */
function checkVolumeValidation(
    clarityScore: number,
    signals: IndicatorSignal[]
): { volumeConfirmed: boolean; confidenceAdjustment: number } {
    const volumeSignal = signals.find(s => s.name === 'Volume');
    const volumeConfirmed = volumeSignal?.direction !== 'neutral' && (volumeSignal?.strength ?? 0) >= 30;

    let confidenceAdjustment = 0;

    if (volumeConfirmed) {
        confidenceAdjustment = +5; // Boost for volume confirmation
    } else if (clarityScore >= 80) {
        // High clarity but no volume = suspicious
        confidenceAdjustment = -10;
    }

    return { volumeConfirmed, confidenceAdjustment };
}

/**
 * Gate 3: Liquidity Check
 * Reject stocks with volume < 50% of 20-day average (inactive/illiquid)
 */
function checkLiquidity(data: OHLCData[]): { passed: boolean; reason?: string; volumeRatio: number } {
    if (data.length < 21) {
        return { passed: true, volumeRatio: 1 };
    }

    const last20 = data.slice(-21, -1);
    const avgVolume = last20.reduce((sum, d) => sum + d.volume, 0) / 20;
    const currentVolume = data[data.length - 1].volume;
    const ratio = avgVolume > 0 ? currentVolume / avgVolume : 0;

    if (ratio < 0.5) {
        return {
            passed: false,
            reason: `Volume ${(ratio * 100).toFixed(0)}% < 50% of average`,
            volumeRatio: ratio,
        };
    }

    return { passed: true, volumeRatio: ratio };
}

// ─── Main Gate Runner ───────────────────────────────────

/**
 * Run all quality gates on a stock.
 * Returns pass/fail and any confidence adjustments.
 */
export function runQualityGates(
    symbol: string,
    clarity: SignalClarityResult,
    data: OHLCData[]
): QualityGateResult {
    const gatesPassed: string[] = [];
    const gatesFailed: string[] = [];
    let totalConfidenceAdj = 0;

    // Gate 1: Volatility
    const volGate = checkVolatility(data);
    if (!volGate.passed) {
        console.log(`[QualityGates] ${symbol} rejected: ${volGate.reason}`);
        gatesFailed.push('volatility');
        return {
            passed: false,
            reason: volGate.reason,
            confidenceAdjustment: 0,
            gatesPassed,
            gatesFailed,
        };
    }
    gatesPassed.push('volatility');

    // Gate 2: Volume Validation (penalty, not rejection)
    const volumeGate = checkVolumeValidation(clarity.clarityScore, clarity.signals);
    totalConfidenceAdj += volumeGate.confidenceAdjustment;
    if (volumeGate.volumeConfirmed) {
        gatesPassed.push('volume_confirmed');
    } else {
        gatesFailed.push('volume_unconfirmed');
    }

    // Gate 3: Liquidity
    const liqGate = checkLiquidity(data);
    if (!liqGate.passed) {
        console.log(`[QualityGates] ${symbol} rejected: ${liqGate.reason}`);
        gatesFailed.push('liquidity');
        return {
            passed: false,
            reason: liqGate.reason,
            confidenceAdjustment: 0,
            gatesPassed,
            gatesFailed,
        };
    }
    gatesPassed.push('liquidity');

    console.log(`[QualityGates] ${symbol} passed all gates ✅ (adj: ${totalConfidenceAdj >= 0 ? '+' : ''}${totalConfidenceAdj})`);

    return {
        passed: true,
        confidenceAdjustment: totalConfidenceAdj,
        gatesPassed,
        gatesFailed,
    };
}

/**
 * Check if volume confirms the signal direction
 */
export function isVolumeConfirmed(signals: IndicatorSignal[]): boolean {
    const volumeSignal = signals.find(s => s.name === 'Volume');
    return volumeSignal?.direction !== 'neutral' && (volumeSignal?.strength ?? 0) >= 30;
}
