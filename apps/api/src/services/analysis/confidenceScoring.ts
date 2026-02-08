/**
 * Confidence Scoring Service
 * @module @stock-assist/api/services/analysis/confidenceScoring
 */

import type { TechnicalIndicators, PatternAnalysis } from '@stock-assist/shared';

// Local type definitions (to avoid circular dependencies with shared package)
export interface EnhancedNewsAnalysis {
    items: any[];
    sentiment: 'positive' | 'negative' | 'neutral';
    sentimentScore: number;
    impactLevel: 'high' | 'medium' | 'low';
    latestHeadlines: string[];
    dataFreshness: number;
}

export interface FundamentalData {
    valuation: 'undervalued' | 'fair' | 'overvalued' | 'unknown';
    growth: 'strong' | 'moderate' | 'weak' | 'unknown';
    metrics: {
        peRatio: number | null;
        pbRatio: number | null;
        marketCap: number | null;
        dividendYield: number | null;
        eps: number | null;
        bookValue: number | null;
    };
    sectorComparison: 'outperforming' | 'inline' | 'underperforming' | 'unknown';
}

export interface ConfidenceBreakdown {
    patternStrength: number;
    newsSentiment: number;
    technicalAlignment: number;
    volumeConfirmation: number;
    fundamentalStrength: number;
}

export interface ConfidenceResult {
    score: number;
    breakdown: ConfidenceBreakdown;
    factors: string[];
    recommendation: 'BUY' | 'SELL' | 'HOLD' | 'WAIT';
}

interface ScoringInput {
    patterns: PatternAnalysis;
    news: EnhancedNewsAnalysis;
    indicators: TechnicalIndicators;
    fundamentals: FundamentalData;
    weeklyIndicators?: TechnicalIndicators;
    monthlyIndicators?: TechnicalIndicators;
}

// Weight configuration (total = 100%)
const WEIGHTS = {
    patternStrength: 0.25,      // 25%
    newsSentiment: 0.20,        // 20%
    technicalAlignment: 0.25,   // 25%
    volumeConfirmation: 0.15,   // 15%
    fundamentalStrength: 0.15,  // 15%
};

/**
 * Calculate pattern strength score (0-100)
 */
const scorePatternStrength = (patterns: PatternAnalysis): { score: number; factors: string[] } => {
    const factors: string[] = [];
    let score = 50; // Base score

    if (patterns.primary) {
        const confidence = patterns.primary.confidence || 50;
        score = confidence;
        factors.push(`Primary pattern: ${patterns.primary.name} (${confidence}%)`);

        if (patterns.primary.type === 'bullish') {
            score += 10;
            factors.push('Bullish pattern detected');
        } else if (patterns.primary.type === 'bearish') {
            score -= 10;
            factors.push('Bearish pattern detected');
        }
    } else {
        factors.push('No clear pattern detected');
    }

    // Trend alignment bonus
    if (patterns.trend.strength > 70) {
        score += 10;
        factors.push(`Strong ${patterns.trend.direction} trend (${patterns.trend.strength}%)`);
    }

    if (patterns.atBreakout) {
        score += 15;
        factors.push('At breakout level');
    }

    return { score: Math.min(100, Math.max(0, score)), factors };
};

/**
 * Calculate news sentiment score (0-100)
 */
const scoreNewsSentiment = (news: EnhancedNewsAnalysis): { score: number; factors: string[] } => {
    const factors: string[] = [];
    let score = news.sentimentScore;

    factors.push(`News sentiment: ${news.sentiment} (${news.sentimentScore})`);

    // Impact level modifier
    if (news.impactLevel === 'high') {
        if (news.sentiment === 'positive') {
            score += 15;
            factors.push('High-impact positive news');
        } else if (news.sentiment === 'negative') {
            score -= 15;
            factors.push('High-impact negative news');
        }
    }

    if (news.items.length === 0) {
        score = 50; // Neutral if no news
        factors.push('No recent news');
    }

    return { score: Math.min(100, Math.max(0, score)), factors };
};

/**
 * Calculate technical alignment score (0-100)
 */
const scoreTechnicalAlignment = (
    indicators: TechnicalIndicators,
    weekly?: TechnicalIndicators,
    monthly?: TechnicalIndicators
): { score: number; factors: string[] } => {
    const factors: string[] = [];
    let score = 50;

    // RSI scoring
    const rsi = indicators.rsi.value;
    if (rsi > 30 && rsi < 70) {
        score += 10;
        factors.push(`RSI in healthy range (${rsi})`);
    } else if (rsi <= 30) {
        score += 15; // Oversold = buying opportunity
        factors.push(`RSI oversold (${rsi}) - potential reversal`);
    } else {
        score -= 10;
        factors.push(`RSI overbought (${rsi}) - caution`);
    }

    // MACD scoring
    if (indicators.macd.trend === 'bullish') {
        score += 15;
        factors.push('MACD bullish');
    } else if (indicators.macd.trend === 'bearish') {
        score -= 10;
        factors.push('MACD bearish');
    }

    // MA trend
    if (indicators.ma.trend === 'bullish') {
        score += 10;
        factors.push('Price above key moving averages');
    } else if (indicators.ma.trend === 'bearish') {
        score -= 10;
        factors.push('Price below key moving averages');
    }

    // Multi-timeframe alignment bonus
    if (weekly && monthly) {
        const dailyBullish = indicators.ma.trend === 'bullish';
        const weeklyBullish = weekly.ma.trend === 'bullish';
        const monthlyBullish = monthly.ma.trend === 'bullish';

        if (dailyBullish && weeklyBullish && monthlyBullish) {
            score += 20;
            factors.push('All timeframes aligned bullish');
        } else if (!dailyBullish && !weeklyBullish && !monthlyBullish) {
            score -= 20;
            factors.push('All timeframes aligned bearish');
        } else {
            factors.push('Mixed timeframe signals');
        }
    }

    return { score: Math.min(100, Math.max(0, score)), factors };
};

/**
 * Calculate volume confirmation score (0-100)
 */
const scoreVolumeConfirmation = (indicators: TechnicalIndicators): { score: number; factors: string[] } => {
    const factors: string[] = [];
    let score = 50;

    const volumeRatio = indicators.volume.ratio;

    if (volumeRatio > 1.5) {
        score = 85;
        factors.push(`High volume confirmation (${volumeRatio}x avg)`);
    } else if (volumeRatio > 1.0) {
        score = 70;
        factors.push(`Above average volume (${volumeRatio}x)`);
    } else if (volumeRatio < 0.5) {
        score = 30;
        factors.push(`Low volume warning (${volumeRatio}x avg)`);
    } else {
        score = 50;
        factors.push(`Normal volume (${volumeRatio}x)`);
    }

    return { score, factors };
};

/**
 * Calculate fundamental strength score (0-100)
 */
const scoreFundamentalStrength = (fundamentals: FundamentalData): { score: number; factors: string[] } => {
    const factors: string[] = [];
    let score = 50;

    // Valuation scoring
    switch (fundamentals.valuation) {
        case 'undervalued':
            score += 20;
            factors.push('Undervalued by fundamentals');
            break;
        case 'overvalued':
            score -= 15;
            factors.push('Overvalued - premium pricing');
            break;
        case 'fair':
            factors.push('Fair valuation');
            break;
    }

    // Growth scoring
    switch (fundamentals.growth) {
        case 'strong':
            score += 20;
            factors.push('Strong growth metrics');
            break;
        case 'weak':
            score -= 10;
            factors.push('Weak growth');
            break;
        case 'moderate':
            score += 5;
            factors.push('Moderate growth');
            break;
    }

    // Sector comparison
    if (fundamentals.sectorComparison === 'outperforming') {
        score += 10;
        factors.push('Outperforming sector');
    } else if (fundamentals.sectorComparison === 'underperforming') {
        score -= 10;
        factors.push('Underperforming sector');
    }

    // Add PE ratio info if available
    if (fundamentals.metrics.peRatio) {
        factors.push(`P/E Ratio: ${fundamentals.metrics.peRatio}`);
    }

    return { score: Math.min(100, Math.max(0, score)), factors };
};

/**
 * Calculate overall confidence score and recommendation
 */
export const calculateConfidence = (input: ScoringInput): ConfidenceResult => {
    const patternResult = scorePatternStrength(input.patterns);
    const newsResult = scoreNewsSentiment(input.news);
    const technicalResult = scoreTechnicalAlignment(
        input.indicators,
        input.weeklyIndicators,
        input.monthlyIndicators
    );
    const volumeResult = scoreVolumeConfirmation(input.indicators);
    const fundamentalResult = scoreFundamentalStrength(input.fundamentals);

    const breakdown: ConfidenceBreakdown = {
        patternStrength: patternResult.score,
        newsSentiment: newsResult.score,
        technicalAlignment: technicalResult.score,
        volumeConfirmation: volumeResult.score,
        fundamentalStrength: fundamentalResult.score,
    };

    // Calculate weighted score
    const weightedScore = Math.round(
        breakdown.patternStrength * WEIGHTS.patternStrength +
        breakdown.newsSentiment * WEIGHTS.newsSentiment +
        breakdown.technicalAlignment * WEIGHTS.technicalAlignment +
        breakdown.volumeConfirmation * WEIGHTS.volumeConfirmation +
        breakdown.fundamentalStrength * WEIGHTS.fundamentalStrength
    );

    // Collect all factors
    const allFactors = [
        ...patternResult.factors,
        ...newsResult.factors,
        ...technicalResult.factors,
        ...volumeResult.factors,
        ...fundamentalResult.factors,
    ];

    // Determine recommendation
    let recommendation: ConfidenceResult['recommendation'];
    const isBullish = input.indicators.ma.trend === 'bullish' ||
        input.patterns.primary?.type === 'bullish' ||
        input.indicators.macd.trend === 'bullish';

    const isBearish = input.indicators.ma.trend === 'bearish' ||
        input.patterns.primary?.type === 'bearish' ||
        input.indicators.macd.trend === 'bearish';

    if (weightedScore < 40) {
        recommendation = 'WAIT';
    } else if (weightedScore >= 40 && weightedScore < 60) {
        recommendation = 'HOLD';
    } else if (weightedScore >= 60 && isBullish) {
        recommendation = 'BUY';
    } else if (weightedScore >= 60 && isBearish) {
        recommendation = 'SELL';
    } else {
        recommendation = 'HOLD';
    }

    return {
        score: weightedScore,
        breakdown,
        factors: allFactors.slice(0, 10), // Limit to top 10 factors
        recommendation,
    };
};
