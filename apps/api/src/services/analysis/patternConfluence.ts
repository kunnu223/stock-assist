/**
 * Pattern Confluence Analyzer
 * Scores pattern agreement across multiple timeframes
 */

import type { PatternAnalysis } from '@stock-assist/shared';

export interface TimeframePatterns {
    '1D': PatternAnalysis;
    '1W': PatternAnalysis;
    '1M': PatternAnalysis;
}

export interface PatternConfluence {
    score: number; // 0-100
    bullishTimeframes: string[];
    bearishTimeframes: string[];
    neutralTimeframes: string[];
    bullishCount: number;
    bearishCount: number;
    neutralCount: number;
    agreement: 'STRONG' | 'MODERATE' | 'WEAK' | 'CONFLICT';
    confidenceModifier: number; // -30 to +30
    conflicts: string[];
    recommendation: string;
}

/**
 * Determine pattern bias for a single timeframe
 */
function getPatternBias(patterns: PatternAnalysis): 'bullish' | 'bearish' | 'neutral' {
    if (!patterns.primary) return 'neutral';

    const { type, confidence } = patterns.primary;

    // Only consider high-confidence patterns (>60%)
    if (confidence && confidence < 60) return 'neutral';

    return type as 'bullish' | 'bearish';
}

/**
 * Calculate pattern confluence across timeframes
 */
export function calculatePatternConfluence(timeframes: TimeframePatterns): PatternConfluence {
    const bullishTimeframes: string[] = [];
    const bearishTimeframes: string[] = [];
    const neutralTimeframes: string[] = [];

    // Analyze each timeframe
    for (const [tf, patterns] of Object.entries(timeframes)) {
        const bias = getPatternBias(patterns);

        if (bias === 'bullish') {
            bullishTimeframes.push(tf);
        } else if (bias === 'bearish') {
            bearishTimeframes.push(tf);
        } else {
            neutralTimeframes.push(tf);
        }
    }

    const bullishCount = bullishTimeframes.length;
    const bearishCount = bearishTimeframes.length;
    const neutralCount = neutralTimeframes.length;
    const totalTimeframes = 3;

    // Calculate confluence score
    const maxCount = Math.max(bullishCount, bearishCount);
    const baseScore = (maxCount / totalTimeframes) * 100;

    // Detect conflicts
    const conflicts: string[] = [];
    if (bullishCount > 0 && bearishCount > 0) {
        conflicts.push(`${bullishCount} bullish vs ${bearishCount} bearish timeframes`);
    }

    // Determine agreement level
    let agreement: 'STRONG' | 'MODERATE' | 'WEAK' | 'CONFLICT';
    if (maxCount === totalTimeframes) {
        agreement = 'STRONG'; // All 3 agree
    } else if (maxCount === 2 && (bullishCount === 0 || bearishCount === 0)) {
        agreement = 'MODERATE'; // 2 agree, 1 neutral
    } else if (bullishCount > 0 && bearishCount > 0) {
        agreement = 'CONFLICT'; // Mixed signals
    } else {
        agreement = 'WEAK'; // No clear pattern
    }

    // Calculate confidence modifier
    let confidenceModifier = 0;
    switch (agreement) {
        case 'STRONG':
            confidenceModifier = +20; // Boost by 20%
            break;
        case 'MODERATE':
            confidenceModifier = +10;
            break;
        case 'WEAK':
            confidenceModifier = -10;
            break;
        case 'CONFLICT':
            confidenceModifier = -25; // Penalize heavily
            break;
    }

    // Generate recommendation
    let recommendation = '';
    if (agreement === 'STRONG') {
        const direction = bullishCount === 3 ? 'BULLISH' : bearishCount === 3 ? 'BEARISH' : 'NEUTRAL';
        recommendation = `Strong ${direction.toLowerCase()} confluence across all timeframes`;
    } else if (agreement === 'MODERATE') {
        const direction = bullishCount >= 2 ? 'bullish' : bearishCount >= 2 ? 'bearish' : 'neutral';
        recommendation = `Moderate ${direction} setup - proceed with caution`;
    } else if (agreement === 'CONFLICT') {
        recommendation = `Conflicting signals - WAIT for clarity or trade smaller position`;
    } else {
        recommendation = `Weak pattern formation - SKIP this setup`;
    }

    return {
        score: Math.round(baseScore),
        bullishTimeframes,
        bearishTimeframes,
        neutralTimeframes,
        bullishCount,
        bearishCount,
        neutralCount,
        agreement,
        confidenceModifier,
        conflicts,
        recommendation,
    };
}

/**
 * Get human-readable confluence summary
 */
export function getConfluenceSummary(confluence: PatternConfluence): string {
    const { bullishCount, bearishCount, neutralCount, agreement } = confluence;

    return `${agreement} pattern confluence: ${bullishCount} bullish, ${bearishCount} bearish, ${neutralCount} neutral timeframes`;
}
