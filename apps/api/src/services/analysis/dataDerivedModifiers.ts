/**
 * Data-Derived Modifiers Service — Phase D #8
 * 
 * Replaces static modifiers (+8%, -10%, etc.) with empirically derived values.
 * 
 * Current (static):
 *   volumeConfirmed → +8%
 *   ADX strong      → +8%
 *   ADX weak        → -5%
 *   alignment 100%  → +15%
 *   alignment <50%  → -10%
 * 
 * Target (data-derived):
 *   modifier = winRate(withCondition) - winRate(baseline)
 * 
 * If the win rate WITH volume confirmation is 68% and WITHOUT is 52%,
 * the derived modifier is +16% — not the assumed +8%.
 * 
 * NOTE from v6.0 roadmap:
 * > If condition hashing works well, modifiers may become COMPLETELY UNNECESSARY.
 * > Hashing captures nonlinear interactions (volume + alignment + regime together)
 * > that linear modifier stacking cannot.
 * 
 * This service provides the bridge: use data-derived modifiers until hashing matures.
 * 
 * @module @stock-assist/api/services/analysis/dataDerivedModifiers
 */

import { SignalRecord, SignalStatus } from '../../models/SignalRecord';

// ═══════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════

export interface DerivedModifier {
    name: string;
    staticValue: number;         // The old hardcoded modifier (for comparison)
    derivedValue: number;        // Data-derived modifier from win rate delta
    sampleWith: number;          // Signals WITH this condition
    sampleWithout: number;       // Signals WITHOUT this condition
    winRateWith: number;         // Win rate WITH this condition
    winRateWithout: number;      // Win rate WITHOUT this condition
    reliable: boolean;           // true when both samples ≥ MIN_SAMPLES
    source: 'derived' | 'static'; // Which value is currently active
}

export interface DerivedModifiersResult {
    ready: boolean;
    modifiers: DerivedModifier[];
    totalSignals: number;
    message: string;
}

export interface AppliedModifiers {
    volumeModifier: number;
    multiTFModifier: number;
    adxModifier: number;
    source: 'derived' | 'static';
    details: string;
}

// ═══════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════

/** Minimum samples on EACH side (with/without) to trust derived value */
const MIN_SAMPLES_PER_SIDE = 30;

/** Cache TTL — refresh at most once per 2 hours */
const CACHE_TTL_MS = 2 * 60 * 60 * 1000;

/** Static fallback modifiers (current hardcoded values) */
const STATIC_MODIFIERS = {
    volumeHigh: 8,          // volumeRatio ≥ 1.5
    volumeConfirmed: 5,     // volumeRatio ≥ 1.2
    volumeLow: -8,          // volumeRatio < 0.8
    alignmentPerfect: 15,   // alignmentScore ≥ 100
    alignmentStrong: 8,     // alignmentScore ≥ 65
    alignmentNeutral: 0,    // alignmentScore ≥ 50
    alignmentConflict: -10, // alignmentScore < 50
    adxStrong: 8,           // ADX ≥ 25
    adxWeak: -5,            // ADX < 20
    adxChoppy: -8,          // ADX < 15
};

// ═══════════════════════════════════════════════════════════════
// CACHE
// ═══════════════════════════════════════════════════════════════

let derivedCache: { result: DerivedModifiersResult; lastUpdated: number } | null = null;

// ═══════════════════════════════════════════════════════════════
// CORE FUNCTIONS
// ═══════════════════════════════════════════════════════════════

/**
 * Calculate the win-rate delta for a given condition.
 * modifier = winRate(withCondition) - winRate(baseline)
 */
async function calcWinRateDelta(
    conditionField: string,
    conditionQuery: Record<string, any>,
    inverseQuery: Record<string, any>,
): Promise<{ winRateWith: number; winRateWithout: number; sampleWith: number; sampleWithout: number }> {
    const [withResult, withoutResult] = await Promise.all([
        SignalRecord.aggregate([
            { $match: { ...conditionQuery, status: { $ne: SignalStatus.PENDING } } },
            {
                $group: {
                    _id: null,
                    total: { $sum: 1 },
                    wins: { $sum: { $cond: [{ $eq: ['$status', SignalStatus.TARGET_HIT] }, 1, 0] } },
                }
            }
        ]),
        SignalRecord.aggregate([
            { $match: { ...inverseQuery, status: { $ne: SignalStatus.PENDING } } },
            {
                $group: {
                    _id: null,
                    total: { $sum: 1 },
                    wins: { $sum: { $cond: [{ $eq: ['$status', SignalStatus.TARGET_HIT] }, 1, 0] } },
                }
            }
        ]),
    ]);

    const w = withResult[0] || { total: 0, wins: 0 };
    const wo = withoutResult[0] || { total: 0, wins: 0 };

    return {
        winRateWith: w.total > 0 ? Math.round((w.wins / w.total) * 100) : 0,
        winRateWithout: wo.total > 0 ? Math.round((wo.wins / wo.total) * 100) : 0,
        sampleWith: w.total,
        sampleWithout: wo.total,
    };
}

/**
 * Compute all data-derived modifiers from SignalRecord outcomes.
 * This queries the database for win rates with/without each condition.
 */
export async function getDerivedModifiers(): Promise<DerivedModifiersResult> {
    try {
        // Check cache
        if (derivedCache && Date.now() - derivedCache.lastUpdated < CACHE_TTL_MS) {
            return derivedCache.result;
        }

        // 1. Volume Confirmation modifier
        const volumeConfirmed = await calcWinRateDelta(
            'volumeConfirmed',
            { volumeConfirmed: true },
            { volumeConfirmed: false }
        );

        // 2. High Volume (≥1.5) vs rest
        const volumeHigh = await calcWinRateDelta(
            'volumeRatio',
            { volumeRatio: { $gte: 1.5 } },
            { volumeRatio: { $lt: 1.5 } }
        );

        // 3. Strong Alignment (≥65) vs weak (<65)
        const alignmentStrong = await calcWinRateDelta(
            'alignmentScore',
            { alignmentScore: { $gte: 65 } },
            { alignmentScore: { $lt: 65 } }
        );

        // 4. Perfect Alignment (≥90) vs rest
        const alignmentPerfect = await calcWinRateDelta(
            'alignmentScore',
            { alignmentScore: { $gte: 90 } },
            { alignmentScore: { $lt: 90 } }
        );

        // 5. ADX Strong (≥25) vs weak (<25)
        const adxStrong = await calcWinRateDelta(
            'adxValue',
            { adxValue: { $gte: 25 } },
            { adxValue: { $lt: 25 } }
        );

        // 6. ADX Choppy (<15) vs trending (≥15)
        const adxChoppy = await calcWinRateDelta(
            'adxValue',
            { adxValue: { $lt: 15 } },
            { adxValue: { $gte: 15 } }
        );

        // Build modifier list
        const buildModifier = (
            name: string,
            staticVal: number,
            data: { winRateWith: number; winRateWithout: number; sampleWith: number; sampleWithout: number }
        ): DerivedModifier => {
            const reliable = data.sampleWith >= MIN_SAMPLES_PER_SIDE && data.sampleWithout >= MIN_SAMPLES_PER_SIDE;
            const derivedValue = data.winRateWith - data.winRateWithout;

            return {
                name,
                staticValue: staticVal,
                derivedValue: reliable ? derivedValue : staticVal,
                sampleWith: data.sampleWith,
                sampleWithout: data.sampleWithout,
                winRateWith: data.winRateWith,
                winRateWithout: data.winRateWithout,
                reliable,
                source: reliable ? 'derived' : 'static',
            };
        };

        const modifiers: DerivedModifier[] = [
            buildModifier('Volume Confirmed', STATIC_MODIFIERS.volumeConfirmed, volumeConfirmed),
            buildModifier('Volume High (≥1.5x)', STATIC_MODIFIERS.volumeHigh, volumeHigh),
            buildModifier('Alignment Strong (≥65%)', STATIC_MODIFIERS.alignmentStrong, alignmentStrong),
            buildModifier('Alignment Perfect (≥90%)', STATIC_MODIFIERS.alignmentPerfect, alignmentPerfect),
            buildModifier('ADX Strong (≥25)', STATIC_MODIFIERS.adxStrong, adxStrong),
            buildModifier('ADX Choppy (<15)', STATIC_MODIFIERS.adxChoppy, adxChoppy),
        ];

        const totalSignals = volumeConfirmed.sampleWith + volumeConfirmed.sampleWithout;
        const readyCount = modifiers.filter(m => m.reliable).length;

        const result: DerivedModifiersResult = {
            ready: readyCount >= 3, // At least half should be reliable
            modifiers,
            totalSignals,
            message: readyCount >= 3
                ? `${readyCount}/${modifiers.length} modifiers data-derived (${totalSignals} signals)`
                : `Need more data: ${readyCount}/${modifiers.length} modifiers reliable (${totalSignals} signals, need ${MIN_SAMPLES_PER_SIDE}+ per side)`,
        };

        derivedCache = { result, lastUpdated: Date.now() };
        return result;

    } catch (error) {
        console.error('[DerivedModifiers] Error computing modifiers:', error);
        return {
            ready: false,
            modifiers: [],
            totalSignals: 0,
            message: `Error: ${error}`,
        };
    }
}

/**
 * Get the appropriate modifiers for a given set of conditions.
 * Uses data-derived values when available, falls back to static.
 * 
 * @param volumeRatio - Current volume ratio
 * @param alignmentScore - Multi-timeframe alignment (0-100)
 * @param adxValue - Current ADX value
 * @returns Applied modifiers with source attribution
 */
export async function getModifiersForConditions(
    volumeRatio: number,
    alignmentScore: number,
    adxValue: number
): Promise<AppliedModifiers> {
    const derived = await getDerivedModifiers();

    // Helper: find derived modifier by name, fall back to static
    const getVal = (name: string, staticFallback: number): number => {
        const mod = derived.modifiers.find(m => m.name === name);
        if (mod && mod.reliable) return mod.derivedValue;
        return staticFallback;
    };

    // Volume modifier
    let volumeModifier = 0;
    if (volumeRatio >= 1.5) {
        volumeModifier = getVal('Volume High (≥1.5x)', STATIC_MODIFIERS.volumeHigh);
    } else if (volumeRatio >= 1.2) {
        volumeModifier = getVal('Volume Confirmed', STATIC_MODIFIERS.volumeConfirmed);
    } else if (volumeRatio < 0.8) {
        volumeModifier = STATIC_MODIFIERS.volumeLow; // Negative — no positive data-derivation
    }

    // Multi-TF alignment modifier
    let multiTFModifier = 0;
    if (alignmentScore >= 90) {
        multiTFModifier = getVal('Alignment Perfect (≥90%)', STATIC_MODIFIERS.alignmentPerfect);
    } else if (alignmentScore >= 65) {
        multiTFModifier = getVal('Alignment Strong (≥65%)', STATIC_MODIFIERS.alignmentStrong);
    } else if (alignmentScore >= 50) {
        multiTFModifier = STATIC_MODIFIERS.alignmentNeutral;
    } else {
        multiTFModifier = STATIC_MODIFIERS.alignmentConflict;
    }

    // ADX modifier
    let adxModifier = 0;
    if (adxValue >= 25) {
        adxModifier = getVal('ADX Strong (≥25)', STATIC_MODIFIERS.adxStrong);
    } else if (adxValue < 15) {
        adxModifier = getVal('ADX Choppy (<15)', STATIC_MODIFIERS.adxChoppy);
    } else if (adxValue < 20) {
        adxModifier = STATIC_MODIFIERS.adxWeak;
    }

    return {
        volumeModifier,
        multiTFModifier,
        adxModifier,
        source: derived.ready ? 'derived' : 'static',
        details: derived.ready
            ? `Data-derived modifiers (${derived.totalSignals} signals): vol=${volumeModifier}, mtf=${multiTFModifier}, adx=${adxModifier}`
            : `Static modifiers (insufficient data): vol=${volumeModifier}, mtf=${multiTFModifier}, adx=${adxModifier}`,
    };
}
