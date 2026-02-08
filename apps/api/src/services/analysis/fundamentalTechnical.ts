/**
 * Fundamental-Technical Conflict Detector
 * Identifies when technical and fundamental analysis disagree
 */

import type { FundamentalData } from '../data/fundamentals';

export interface FundamentalTechnicalConflict {
    hasConflict: boolean;
    technicalBias: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
    fundamentalVerdict: string;
    conflictType: 'NONE' | 'OVERVALUED_BULLISH' | 'UNDERVALUED_BEARISH' | 'WEAK_GROWTH_BULLISH';
    confidenceAdjustment: number; // -30 to +30
    recommendation: string;
    details: string[];
}

export interface TechnicalContext {
    bias: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
    confidenceScore: number;
}

/**
 * Detect conflicts between fundamental and technical analysis
 */
export function detectFundamentalTechnicalConflict(
    technical: TechnicalContext,
    fundamentals: FundamentalData
): FundamentalTechnicalConflict {
    const details: string[] = [];
    let conflictType: 'NONE' | 'OVERVALUED_BULLISH' | 'UNDERVALUED_BEARISH' | 'WEAK_GROWTH_BULLISH' = 'NONE';
    let confidenceAdjustment = 0;

    // Check P/E ratio conflict
    const peRatio = fundamentals.metrics.peRatio;
    const valuation = fundamentals.valuation;

    if (technical.bias === 'BULLISH') {
        // Bullish technical but overvalued fundamentals
        if (valuation === 'overvalued' && peRatio && peRatio > 30) {
            conflictType = 'OVERVALUED_BULLISH';
            confidenceAdjustment = -15;
            details.push(`Stock is technically bullish but fundamentally overvalued (P/E ${peRatio.toFixed(1)})`);
        }

        // Bullish technical but weak growth
        if (fundamentals.growth === 'weak') {
            conflictType = 'WEAK_GROWTH_BULLISH';
            confidenceAdjustment = Math.min(confidenceAdjustment, -10);
            details.push(`Bullish technical setup but ${fundamentals.growth} earnings growth`);
        }

        // Bullish technical + undervalued = boost
        if (valuation === 'undervalued') {
            confidenceAdjustment = +15;
            details.push(`Strong fundamental support: undervalued with ${fundamentals.growth} growth`);
        }

    } else if (technical.bias === 'BEARISH') {
        // Bearish technical but undervalued fundamentals
        if (valuation === 'undervalued' && fundamentals.growth === 'strong') {
            conflictType = 'UNDERVALUED_BEARISH';
            confidenceAdjustment = -10;
            details.push(`Bearish technical but fundamentally undervalued - potential reversal`);
        }

        // Bearish + overvalued = confirm
        if (valuation === 'overvalued') {
            confidenceAdjustment = +10;
            details.push(`Fundamental weakness confirms bearish technical setup`);
        }
    }

    const hasConflict = conflictType !== 'NONE';

    // Generate recommendation
    let recommendation = '';
    if (conflictType === 'OVERVALUED_BULLISH') {
        recommendation = 'Proceed with caution - technically strong but overvalued. Consider smaller position or wait for pullback.';
    } else if (conflictType === 'UNDERVALUED_BEARISH') {
        recommendation = 'Bearish setup but fundamentally attractive - may find support soon. Consider waiting for reversal signal.';
    } else if (conflictType === 'WEAK_GROWTH_BULLISH') {
        recommendation = 'Technical strength not backed by fundamentals - be ready to exit quickly.';
    } else {
        recommendation = technical.bias === 'NEUTRAL'
            ? 'No strong technical or fundamental bias - SKIP'
            : 'Fundamental and technical analysis aligned - higher confidence.';
    }

    return {
        hasConflict,
        technicalBias: technical.bias,
        fundamentalVerdict: `${valuation} valuation with ${fundamentals.growth} growth`,
        conflictType,
        confidenceAdjustment,
        recommendation,
        details,
    };
}

/**
 * Get human-readable summary
 */
export function getConflictSummary(conflict: FundamentalTechnicalConflict): string {
    if (!conflict.hasConflict) {
        return `✅ Fundamental-technical alignment: ${conflict.fundamentalVerdict}`;
    }

    return `⚠️ Conflict detected: ${conflict.technicalBias} technical but ${conflict.fundamentalVerdict}`;
}
