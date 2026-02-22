/**
 * Trade Selectivity Filter — v2 (with ADX Acceleration)
 * Pre-filter that rejects marginal setups before scoring.
 * This reduces trade frequency but increases win rate.
 * 
 * Default gates:
 *   - ADX ≥ 18 AND rising last 3 candles (Phase E #11: Trend Acceleration)
 *   - Alignment ≥ 65% (multi-timeframe)
 *   - Volume confirmed (ratio ≥ 1.2)
 *   - No severe FT conflict
 *   - Not within ±3 days of earnings (when data available)
 * 
 * Phase E #11 change: ADX gate changed from hard floor (≥22) to
 * trend acceleration (≥18 AND rising 3 candles). This catches
 * emerging trends early rather than waiting for trend maturity.
 * 
 * @module @stock-assist/api/services/analysis/tradeSelectivity
 */

export interface SelectivityContext {
    adx: number;
    adxHistory?: number[];          // Last 5+ ADX values for acceleration check
    alignmentScore: number;         // Multi-timeframe alignment (0-100)
    volumeRatio: number;
    ftConflictSeverity: 'none' | 'low' | 'medium' | 'high';
    earningsProximity?: number;     // Days to nearest earnings, undefined if unknown
    macdDivergence?: 'bullish' | 'bearish' | 'none'; // New phase 6 rule
    currentPrice?: number;
    vwap?: number;
}

export interface SelectivityGate {
    passed: boolean;
    reason: string;
    rejectedBy?: string;            // Which gate rejected the trade
    gateResults: {
        adx: { passed: boolean; value: number; threshold: number; rising?: boolean; risingCandles?: number };
        alignment: { passed: boolean; value: number; threshold: number };
        volume: { passed: boolean; value: number; threshold: number };
        ftConflict: { passed: boolean; severity: string };
        earnings: { passed: boolean; days?: number; threshold: number };
        macdDivergence: { passed: boolean; divergence: string };
        vwapExtension: { passed: boolean; extension: number; maxExtension: number };
    };
    passedCount: number;
    totalGates: number;
}

// Configurable thresholds
const THRESHOLDS = {
    minADX: 18,                     // Phase E #11: lowered from 22 to 18 (with rising requirement)
    adxRisingCandles: 3,            // Phase E #11: ADX must be rising for 3 candles
    minAlignment: 65,
    minVolume: 1.2,
    maxFTConflict: 'medium' as const,
    earningsWindow: 3,
    maxVwapExtension: 1.05, // Reject if price is > 5% above weekly VWAP
};

const CONFLICT_SEVERITY_ORDER = ['none', 'low', 'medium', 'high'];

/**
 * Check if ADX is rising over the last N candles.
 * Returns true if each of the last N values is higher than the previous.
 */
function isADXRising(adxHistory: number[], candles: number): boolean {
    if (adxHistory.length < candles + 1) return false;

    // Take the last (candles + 1) values to check N rising candles
    const recent = adxHistory.slice(-(candles + 1));

    for (let i = 1; i < recent.length; i++) {
        if (recent[i] <= recent[i - 1]) return false;
    }

    return true;
}

/**
 * Evaluate whether a setup meets minimum selectivity criteria.
 * Returns detailed gate results for logging.
 * 
 * Phase E #11: ADX gate now requires BOTH:
 *   1. ADX ≥ 18 (lowered from 22)
 *   2. ADX rising last 3 candles (acceleration, not just magnitude)
 * 
 * This catches emerging trends early while still rejecting choppy markets.
 */
export function evaluateSelectivity(context: SelectivityContext): SelectivityGate {
    // Phase E #11: ADX acceleration check
    const adxAboveThreshold = context.adx >= THRESHOLDS.minADX;
    const adxRising = context.adxHistory
        ? isADXRising(context.adxHistory, THRESHOLDS.adxRisingCandles)
        : true; // If no history, skip rising check (backward compat)

    // ADX passes if EITHER:
    // 1. ADX ≥ 25 (strong trend — no rising requirement)
    // 2. ADX ≥ 18 AND rising last 3 candles (accelerating trend)
    const adxPassed = context.adx >= 25 || (adxAboveThreshold && adxRising);

    const gateResults = {
        adx: {
            passed: adxPassed,
            value: context.adx,
            threshold: THRESHOLDS.minADX,
            rising: adxRising,
            risingCandles: THRESHOLDS.adxRisingCandles,
        },
        alignment: {
            passed: context.alignmentScore >= THRESHOLDS.minAlignment,
            value: context.alignmentScore,
            threshold: THRESHOLDS.minAlignment,
        },
        volume: {
            passed: context.volumeRatio >= THRESHOLDS.minVolume,
            value: context.volumeRatio,
            threshold: THRESHOLDS.minVolume,
        },
        ftConflict: {
            passed: CONFLICT_SEVERITY_ORDER.indexOf(context.ftConflictSeverity) <
                CONFLICT_SEVERITY_ORDER.indexOf(THRESHOLDS.maxFTConflict),
            severity: context.ftConflictSeverity,
        },
        earnings: {
            passed: context.earningsProximity === undefined || context.earningsProximity > THRESHOLDS.earningsWindow,
            days: context.earningsProximity,
            threshold: THRESHOLDS.earningsWindow,
        },
        macdDivergence: {
            passed: context.macdDivergence !== 'bearish', // Reject bearish divergence
            divergence: context.macdDivergence || 'none',
        },
        vwapExtension: {
            passed: context.currentPrice && context.vwap && context.vwap > 0
                ? (context.currentPrice / context.vwap) <= THRESHOLDS.maxVwapExtension
                : true,
            extension: context.currentPrice && context.vwap && context.vwap > 0
                ? (context.currentPrice / context.vwap)
                : 1,
            maxExtension: THRESHOLDS.maxVwapExtension,
        },
    };

    const passedCount = Object.values(gateResults).filter(g => g.passed).length;
    const totalGates = Object.keys(gateResults).length;

    // Find first failing gate
    const rejectedBy = !gateResults.adx.passed ? 'ADX' :
        !gateResults.alignment.passed ? 'Alignment' :
            !gateResults.volume.passed ? 'Volume' :
                !gateResults.ftConflict.passed ? 'FT-Conflict' :
                    !gateResults.macdDivergence.passed ? 'MACD-Divergence' :
                        !gateResults.vwapExtension.passed ? 'VWAP-Extension' :
                            !gateResults.earnings.passed ? 'Earnings' :
                                undefined;

    const allPassed = passedCount === totalGates;

    let reason: string;
    if (allPassed) {
        reason = `All ${totalGates} selectivity gates passed — trade eligible`;
    } else if (rejectedBy === 'ADX') {
        if (!adxAboveThreshold) {
            reason = `ADX too low (${context.adx.toFixed(0)} < ${THRESHOLDS.minADX}) — no trend`;
        } else if (!adxRising) {
            reason = `ADX not accelerating (${context.adx.toFixed(0)} ≥ ${THRESHOLDS.minADX} but not rising ${THRESHOLDS.adxRisingCandles} candles) — trend weakening`;
        } else {
            reason = `ADX check failed (${context.adx.toFixed(0)}) — unclear trend`;
        }
    } else if (rejectedBy === 'Alignment') {
        reason = `Multi-TF alignment too low (${context.alignmentScore}% < ${THRESHOLDS.minAlignment}%) — conflicting timeframes`;
    } else if (rejectedBy === 'Volume') {
        reason = `Volume too low (${context.volumeRatio.toFixed(1)}x < ${THRESHOLDS.minVolume}x) — weak conviction`;
    } else if (rejectedBy === 'FT-Conflict') {
        reason = `Fundamental-Technical conflict (${context.ftConflictSeverity}) — mixed signals`;
    } else if (rejectedBy === 'MACD-Divergence') {
        reason = `Hidden bearish divergence detected on MACD — possible trend exhaustion`;
    } else if (rejectedBy === 'VWAP-Extension') {
        const ext = ((gateResults.vwapExtension.extension - 1) * 100).toFixed(1);
        reason = `Price overextended above weekly VWAP (+${ext}%) — chasing risk too high`;
    } else if (rejectedBy === 'Earnings') {
        reason = `Within ${context.earningsProximity}d of earnings (window: ±${THRESHOLDS.earningsWindow}d) — event risk`;
    } else {
        reason = `${totalGates - passedCount} gate(s) failed — setup not selective enough`;
    }

    return {
        passed: allPassed,
        reason,
        rejectedBy,
        gateResults,
        passedCount,
        totalGates,
    };
}
