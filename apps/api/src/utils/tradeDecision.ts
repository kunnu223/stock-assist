/**
 * Trade Decision Logic
 * @module @stock-assist/api/utils/tradeDecision
 */

// ═══════════════════════════════════════════════════════════════
// ACCURACY THRESHOLDS - Adjust these to tune strictness
// ═══════════════════════════════════════════════════════════════

/**
 * Coin-flip probability range
 * Default: 45-55% (strict)
 * Relaxed: 40-60% (allows more opportunities)
 */
const COIN_FLIP_MIN = 45;
const COIN_FLIP_MAX = 55;

/**
 * Minimum pattern confidence required
 * Default: 70% (strict)
 * Relaxed: 65% (allows moderate confidence patterns)
 */
const MIN_PATTERN_CONFIDENCE = 70;

/**
 * Minimum volume ratio (compared to average)
 * Default: 0.5 (50% of average)
 * Relaxed: 0.4 (40% of average)
 */
const MIN_VOLUME_RATIO = 0.5;

/**
 * Minimum probability for either direction
 * Default: 60% (strict)
 * Relaxed: 55% (allows slightly weaker setups)
 */
const MIN_PROBABILITY = 60;

/**
 * Minimum risk/reward ratio
 * Default: 1.5
 * Relaxed: 1.2
 */
const MIN_RISK_REWARD = 1.5;

/**
 * Thresholds for STRONG_SETUP categorization
 */
const STRONG_SETUP_THRESHOLDS = {
    minProbability: 65,      // One direction must be >65%
    minPatternConfidence: 75, // Pattern confidence >75%
    minVolumeRatio: 0.8,     // Volume >80% of average
    minRiskReward: 2.0       // Risk/Reward >2.0
};

// ═══════════════════════════════════════════════════════════════


export interface TradeDecision {
    shouldTrade: boolean;
    reason: string;
    category: 'STRONG_SETUP' | 'NEUTRAL' | 'AVOID';
    warnings: string[];
}

/**
 * Determine if a stock should be traded based on accuracy criteria
 * Implements the "When NOT to Trade" checklist
 */
export function shouldTrade(analysis: any): TradeDecision {
    const warnings: string[] = [];
    const symbol = analysis.stock || 'Unknown';

    // Extract key metrics
    const bullProb = analysis.bullish?.probability || 0;
    const bearProb = analysis.bearish?.probability || 0;
    const patternConfidence = analysis.pattern?.confidence || 0;
    const volumeRatio = analysis.indicators?.volume?.ratio || 1;
    const bullRR = analysis.bullish?.tradePlan?.riskReward || 0;
    const bearRR = analysis.bearish?.tradePlan?.riskReward || 0;
    const maxRR = Math.max(bullRR, bearRR);

    // Check 1: Coin flip probability (configurable range)
    if (bullProb >= COIN_FLIP_MIN && bullProb <= COIN_FLIP_MAX) {
        return {
            shouldTrade: false,
            reason: `Coin flip probability (${bullProb}% bullish, ${bearProb}% bearish) - no clear edge`,
            category: 'AVOID',
            warnings: [`Probability in coin-flip range (${COIN_FLIP_MIN}-${COIN_FLIP_MAX}%)`]
        };
    }

    // Check 2: Pattern confidence < threshold
    if (patternConfidence > 0 && patternConfidence < MIN_PATTERN_CONFIDENCE) {
        return {
            shouldTrade: false,
            reason: `Low pattern confidence (${patternConfidence}%) - wait for clearer setup`,
            category: 'AVOID',
            warnings: [`Pattern confidence below ${MIN_PATTERN_CONFIDENCE}% threshold`]
        };
    }

    // Check 3: Low volume
    if (volumeRatio < MIN_VOLUME_RATIO) {
        return {
            shouldTrade: false,
            reason: `Low volume (${(volumeRatio * 100).toFixed(0)}% of average) - unreliable breakouts`,
            category: 'AVOID',
            warnings: [`Volume below ${(MIN_VOLUME_RATIO * 100).toFixed(0)}% of average`]
        };
    }

    // Check 4: Conflicting signals (RSI vs MA)
    if (analysis.indicators) {
        const rsi = analysis.indicators.rsi?.value;
        const maTrend = analysis.indicators.ma?.trend || '';

        if (rsi !== undefined) {
            const rsiBullish = rsi > 50;
            const maBullish = maTrend.toLowerCase().includes('bullish') || maTrend.toLowerCase().includes('uptrend');
            const maBearish = maTrend.toLowerCase().includes('bearish') || maTrend.toLowerCase().includes('downtrend');

            if ((rsiBullish && maBearish) || (!rsiBullish && maBullish)) {
                warnings.push(`Conflicting signals: RSI ${rsiBullish ? 'bullish' : 'bearish'} vs MA ${maTrend}`);
                return {
                    shouldTrade: false,
                    reason: `Conflicting signals between RSI and MA trend - wait for alignment`,
                    category: 'NEUTRAL',
                    warnings
                };
            }
        }
    }

    // Check 5: Both scenarios weak (both < threshold)
    if (bullProb < MIN_PROBABILITY && bearProb < MIN_PROBABILITY) {
        return {
            shouldTrade: false,
            reason: `Both scenarios weak (Bull: ${bullProb}%, Bear: ${bearProb}%) - no clear direction`,
            category: 'NEUTRAL',
            warnings: [`Neither scenario shows strong conviction (> ${MIN_PROBABILITY}%)`]
        };
    }

    // Check 6: Risk/Reward < threshold
    if (maxRR > 0 && maxRR < MIN_RISK_REWARD) {
        return {
            shouldTrade: false,
            reason: `Risk/Reward too low (${maxRR.toFixed(2)}) - below ${MIN_RISK_REWARD} minimum`,
            category: 'AVOID',
            warnings: [`Risk/Reward below minimum threshold (${MIN_RISK_REWARD})`]
        };
    }

    // Check 7: AI explicitly marked as AVOID
    if (analysis.category === 'AVOID') {
        return {
            shouldTrade: false,
            reason: analysis.recommendation || 'AI marked as AVOID',
            category: 'AVOID',
            warnings: ['AI analysis recommends avoiding this trade']
        };
    }

    // Additional warnings (don't block trade, but flag concerns)
    if (volumeRatio < 0.75) {
        warnings.push(`Volume below average (${(volumeRatio * 100).toFixed(0)}%)`);
    }

    if (patternConfidence > 0 && patternConfidence < 75) {
        warnings.push(`Pattern confidence moderate (${patternConfidence}%)`);
    }

    if (analysis.confidence === 'LOW') {
        warnings.push('AI confidence marked as LOW');
    }

    // Passed all checks - determine category
    const highConfidence = (bullProb > STRONG_SETUP_THRESHOLDS.minProbability || bearProb > STRONG_SETUP_THRESHOLDS.minProbability) &&
        patternConfidence > STRONG_SETUP_THRESHOLDS.minPatternConfidence &&
        volumeRatio > STRONG_SETUP_THRESHOLDS.minVolumeRatio &&
        maxRR > STRONG_SETUP_THRESHOLDS.minRiskReward;

    const category = highConfidence ? 'STRONG_SETUP' : 'NEUTRAL';

    return {
        shouldTrade: true,
        reason: highConfidence
            ? `High confidence setup (${bullProb > bearProb ? bullProb + '% bullish' : bearProb + '% bearish'})`
            : `Acceptable setup (${bullProb > bearProb ? bullProb + '% bullish' : bearProb + '% bearish'})`,
        category,
        warnings
    };
}

/**
 * Check if analysis meets red flags checklist
 */
export function checkRedFlags(analysis: any): {
    passed: boolean;
    failedChecks: string[];
} {
    const failedChecks: string[] = [];

    const bullProb = analysis.bullish?.probability || 0;
    const bearProb = analysis.bearish?.probability || 0;
    const patternConfidence = analysis.pattern?.confidence || 0;
    const volumeRatio = analysis.indicators?.volume?.ratio || 1;
    const bullRR = analysis.bullish?.tradePlan?.riskReward || 0;
    const bearRR = analysis.bearish?.tradePlan?.riskReward || 0;
    const maxRR = Math.max(bullRR, bearRR);

    // Red Flags Checklist
    if (patternConfidence > 0 && patternConfidence <= MIN_PATTERN_CONFIDENCE) {
        failedChecks.push(`Pattern confidence ≤ ${MIN_PATTERN_CONFIDENCE}%`);
    }

    if (bullProb < MIN_PROBABILITY && bearProb < MIN_PROBABILITY) {
        failedChecks.push(`Probability < ${MIN_PROBABILITY}% in both directions`);
    }

    if (volumeRatio < MIN_VOLUME_RATIO) {
        failedChecks.push('Volume does not confirm pattern');
    }

    if (maxRR < MIN_RISK_REWARD) {
        failedChecks.push(`Risk/Reward < ${MIN_RISK_REWARD}`);
    }

    // Check for conflicting news (if available)
    if (analysis.news && analysis.news.items) {
        const sentiments = analysis.news.items.map((n: any) => n.sentiment);
        const hasPositive = sentiments.includes('positive');
        const hasNegative = sentiments.includes('negative');

        if (hasPositive && hasNegative) {
            failedChecks.push('News is conflicting');
        }
    }

    return {
        passed: failedChecks.length === 0,
        failedChecks
    };
}
