/**
 * Market Regime Classifier — v2 (with self-learning weights)
 * Classifies current market regime to enable dynamic weight selection.
 *
 * Regimes:
 *   TRENDING_STRONG  — ADX > 25, clear directional alignment
 *   TRENDING_WEAK    — ADX 15-25
 *   RANGE            — ADX < 15, low ATR relative to price
 *   VOLATILE         — ATR > 2× mean, high volume
 *   EVENT_DRIVEN     — Breaking news with high impact
 *
 * Phase C #7: Self-Learning Weights
 *   When sufficient data exists (100+ resolved signals per regime),
 *   empirical weights derived from outcome data replace hardcoded defaults.
 *   The data determines which factors matter most in each regime.
 *
 * @module @stock-assist/api/services/analysis/regimeClassifier
 */

import type { MarketRegime } from '../../models/SignalRecord';
import { SignalRecord, SignalStatus } from '../../models/SignalRecord';

export interface RegimeInput {
    adxValue: number;
    atrCurrent: number;
    atrMean: number;         // Average ATR over last 20 bars
    volumeRatio: number;     // Current volume / avg volume
    newsImpact: 'high' | 'medium' | 'low';
    hasBreakingNews: boolean;
    alignmentScore: number;  // Multi-timeframe alignment (0-100)
}

export interface RegimeResult {
    regime: MarketRegime;
    confidence: number;      // 0-100 how confident we are in this classification
    description: string;
    weights: RegimeWeights;
}

export interface RegimeWeights {
    technical: number;
    pattern: number;
    volume: number;
    news: number;
    fundamental: number;
}

// ═══════════════════════════════════════════════════════════════
// DEFAULT WEIGHTS (used until empirical data is available)
// ═══════════════════════════════════════════════════════════════

// Per-regime weight distributions (must sum to 1.0)
const DEFAULT_REGIME_WEIGHTS: Record<MarketRegime, RegimeWeights> = {
    TRENDING_STRONG: { technical: 0.45, pattern: 0.15, volume: 0.15, news: 0.10, fundamental: 0.15 },
    TRENDING_WEAK: { technical: 0.35, pattern: 0.20, volume: 0.15, news: 0.15, fundamental: 0.15 },
    RANGE: { technical: 0.25, pattern: 0.10, volume: 0.20, news: 0.20, fundamental: 0.25 },
    VOLATILE: { technical: 0.30, pattern: 0.10, volume: 0.25, news: 0.20, fundamental: 0.15 },
    EVENT_DRIVEN: { technical: 0.15, pattern: 0.05, volume: 0.15, news: 0.45, fundamental: 0.20 },
};

// ═══════════════════════════════════════════════════════════════
// PHASE C #7: EMPIRICAL WEIGHT LEARNING
// ═══════════════════════════════════════════════════════════════

/** Minimum resolved signals per regime to trust empirical weights */
const MIN_SIGNALS_FOR_EMPIRICAL_WEIGHTS = 100;

/** Cache empirical weights (refreshed at most once per hour) */
let empiricalWeightsCache: Record<string, { weights: RegimeWeights; sampleSize: number; lastUpdated: number }> = {};
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

/**
 * Derive regime weights empirically from SignalRecord outcome data.
 * 
 * Method: For each sub-score factor, measure the average value in
 * winning signals vs losing signals. The factor with the largest
 * win-loss gap gets the highest weight — it's the most discriminating.
 * 
 * This replaces assumed weights with data-proven weights.
 */
export async function getEmpiricalWeightsForRegime(
    regime: MarketRegime
): Promise<{ weights: RegimeWeights; sampleSize: number; reliable: boolean } | null> {
    try {
        // Check cache first
        const cached = empiricalWeightsCache[regime];
        if (cached && Date.now() - cached.lastUpdated < CACHE_TTL_MS) {
            return {
                weights: cached.weights,
                sampleSize: cached.sampleSize,
                reliable: cached.sampleSize >= MIN_SIGNALS_FOR_EMPIRICAL_WEIGHTS,
            };
        }

        // Query resolved signals for this regime
        // Derive weights from which conditions correlate with wins vs losses
        const results = await SignalRecord.aggregate([
            { $match: { regime, status: { $ne: SignalStatus.PENDING } } },
            {
                $group: {
                    _id: '$status',
                    count: { $sum: 1 },
                    avgConfidence: { $avg: '$confidence' },
                    avgBaseConfidence: { $avg: '$baseConfidence' },
                    avgAdxValue: { $avg: '$adxValue' },
                    avgVolumeRatio: { $avg: '$volumeRatio' },
                    avgAlignmentScore: { $avg: '$alignmentScore' },
                    avgPatternConfluence: { $avg: '$patternConfluence' },
                    // Modifier contributions
                    avgVolumeMod: { $avg: '$modifiers.volume' },
                    avgMultiTFMod: { $avg: '$modifiers.multiTF' },
                    avgAdxMod: { $avg: '$modifiers.adx' },
                    avgConfluenceMod: { $avg: '$modifiers.confluence' },
                    avgFTMod: { $avg: '$modifiers.ft' },
                    avgSectorMod: { $avg: '$modifiers.sector' },
                }
            }
        ]);

        // Build win/loss profiles
        const winData = results.find(r => r._id === SignalStatus.TARGET_HIT);
        const lossData = results.find(r => r._id === SignalStatus.STOP_HIT);
        const totalSamples = results.reduce((sum: number, r: any) => sum + r.count, 0);

        if (!winData || !lossData || totalSamples < 30) {
            return null; // Not enough differentiated data
        }

        // Calculate discriminating power of each factor
        // Higher gap between win-avg and loss-avg → more discriminating → higher weight
        const factors = {
            technical: Math.abs((winData.avgAlignmentScore || 50) - (lossData.avgAlignmentScore || 50)),
            pattern: Math.abs((winData.avgPatternConfluence || 50) - (lossData.avgPatternConfluence || 50)),
            volume: Math.abs((winData.avgVolumeRatio || 1) - (lossData.avgVolumeRatio || 1)) * 30, // Scale volume (0-3) to ~0-90
            news: Math.abs((winData.avgFTMod || 0) - (lossData.avgFTMod || 0)) * 5, // Scale modifier to comparable range
            fundamental: Math.abs((winData.avgSectorMod || 0) - (lossData.avgSectorMod || 0)) * 5,
        };

        // Normalize to sum to 1.0
        const totalWeight = factors.technical + factors.pattern + factors.volume + factors.news + factors.fundamental;

        if (totalWeight < 1) {
            // No meaningful differentiation found — fall back to defaults
            return null;
        }

        // Apply minimum floor (no factor goes below 5%)
        const MIN_WEIGHT = 0.05;
        const rawWeights = {
            technical: Math.max(MIN_WEIGHT, factors.technical / totalWeight),
            pattern: Math.max(MIN_WEIGHT, factors.pattern / totalWeight),
            volume: Math.max(MIN_WEIGHT, factors.volume / totalWeight),
            news: Math.max(MIN_WEIGHT, factors.news / totalWeight),
            fundamental: Math.max(MIN_WEIGHT, factors.fundamental / totalWeight),
        };

        // Re-normalize after flooring
        const flooredTotal = rawWeights.technical + rawWeights.pattern + rawWeights.volume + rawWeights.news + rawWeights.fundamental;
        const weights: RegimeWeights = {
            technical: Number((rawWeights.technical / flooredTotal).toFixed(3)),
            pattern: Number((rawWeights.pattern / flooredTotal).toFixed(3)),
            volume: Number((rawWeights.volume / flooredTotal).toFixed(3)),
            news: Number((rawWeights.news / flooredTotal).toFixed(3)),
            fundamental: Number((rawWeights.fundamental / flooredTotal).toFixed(3)),
        };

        // Ensure sum is exactly 1.0 (fix rounding)
        const sum = weights.technical + weights.pattern + weights.volume + weights.news + weights.fundamental;
        if (Math.abs(sum - 1.0) > 0.001) {
            weights.technical += Number((1.0 - sum).toFixed(3));
        }

        // Cache result
        empiricalWeightsCache[regime] = {
            weights,
            sampleSize: totalSamples,
            lastUpdated: Date.now(),
        };

        return {
            weights,
            sampleSize: totalSamples,
            reliable: totalSamples >= MIN_SIGNALS_FOR_EMPIRICAL_WEIGHTS,
        };
    } catch (error) {
        console.error(`[RegimeClassifier] Error computing empirical weights for ${regime}:`, error);
        return null;
    }
}

/**
 * Classify market regime based on current conditions
 */
export function classifyRegime(input: RegimeInput): RegimeResult {
    // Priority 1: Event-driven (breaking news overrides)
    if (input.hasBreakingNews && input.newsImpact === 'high') {
        return {
            regime: 'EVENT_DRIVEN',
            confidence: 85,
            description: 'High-impact breaking news detected — event-driven regime',
            weights: DEFAULT_REGIME_WEIGHTS.EVENT_DRIVEN,
        };
    }

    // Priority 2: High volatility
    const atrMultiple = input.atrMean > 0 ? input.atrCurrent / input.atrMean : 1;
    if (atrMultiple > 2.0 && input.volumeRatio > 1.8) {
        return {
            regime: 'VOLATILE',
            confidence: Math.min(95, Math.round(atrMultiple * 30)),
            description: `ATR ${atrMultiple.toFixed(1)}× average with ${input.volumeRatio.toFixed(1)}× volume — volatile regime`,
            weights: DEFAULT_REGIME_WEIGHTS.VOLATILE,
        };
    }

    // Priority 3: Trending vs Range (ADX-based)
    if (input.adxValue >= 25) {
        const confidence = input.alignmentScore >= 65 ? 90 : 70;
        return {
            regime: 'TRENDING_STRONG',
            confidence,
            description: `ADX ${input.adxValue.toFixed(0)} with ${input.alignmentScore}% alignment — strong trend`,
            weights: DEFAULT_REGIME_WEIGHTS.TRENDING_STRONG,
        };
    }

    if (input.adxValue >= 15) {
        return {
            regime: 'TRENDING_WEAK',
            confidence: 65,
            description: `ADX ${input.adxValue.toFixed(0)} — weak/developing trend`,
            weights: DEFAULT_REGIME_WEIGHTS.TRENDING_WEAK,
        };
    }

    // ADX < 15 → Range
    return {
        regime: 'RANGE',
        confidence: 75,
        description: `ADX ${input.adxValue.toFixed(0)} — range-bound/choppy market`,
        weights: DEFAULT_REGIME_WEIGHTS.RANGE,
    };
}

/**
 * Get the weight distribution for a given regime.
 * Phase C #7: Prefers empirical weights when sufficient data exists.
 * Falls back to hardcoded defaults when data is insufficient.
 * 
 * Note: This is an ASYNC version for fetching fresh empirical weights.
 */
export async function getEmpiricalOrDefaultWeights(regime: MarketRegime): Promise<{
    weights: RegimeWeights;
    source: 'empirical' | 'default';
    sampleSize: number;
}> {
    const empirical = await getEmpiricalWeightsForRegime(regime);

    if (empirical && empirical.reliable) {
        return {
            weights: empirical.weights,
            source: 'empirical',
            sampleSize: empirical.sampleSize,
        };
    }

    return {
        weights: DEFAULT_REGIME_WEIGHTS[regime],
        source: 'default',
        sampleSize: empirical?.sampleSize || 0,
    };
}

/**
 * Get the weight distribution for a given regime (sync — uses defaults + cache).
 * Backward-compatible with existing code that calls this synchronously.
 * For empirical weights, use getEmpiricalOrDefaultWeights() instead.
 */
export function getWeightsForRegime(regime: MarketRegime): RegimeWeights {
    // Check if we have cached empirical weights
    const cached = empiricalWeightsCache[regime];
    if (cached && cached.sampleSize >= MIN_SIGNALS_FOR_EMPIRICAL_WEIGHTS && Date.now() - cached.lastUpdated < CACHE_TTL_MS) {
        return cached.weights;
    }
    return DEFAULT_REGIME_WEIGHTS[regime];
}

/**
 * Get regime weight learning status for all regimes.
 * Used by the signal-stats endpoint to show learning progress.
 */
export async function getRegimeLearningStatus(): Promise<{
    regimes: {
        regime: MarketRegime;
        source: 'empirical' | 'default';
        sampleSize: number;
        minRequired: number;
        weights: RegimeWeights;
    }[];
}> {
    const allRegimes: MarketRegime[] = ['TRENDING_STRONG', 'TRENDING_WEAK', 'RANGE', 'VOLATILE', 'EVENT_DRIVEN'];
    const regimes = await Promise.all(
        allRegimes.map(async (regime) => {
            const result = await getEmpiricalOrDefaultWeights(regime);
            return {
                regime,
                source: result.source,
                sampleSize: result.sampleSize,
                minRequired: MIN_SIGNALS_FOR_EMPIRICAL_WEIGHTS,
                weights: result.weights,
            };
        })
    );

    return { regimes };
}
