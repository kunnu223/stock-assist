/**
 * Confidence Scoring Service — v2 (wider differentiation)
 * 
 * v1 problem: all sub-scores started at 50 with ±10 modifiers,
 * producing a weighted average always in 50-65 range.
 * 
 * v2 fix: stronger signals → wider ranges, signal agreement amplifier
 * 
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
    patternStrength: 0.20,      // 20% — patterns
    newsSentiment: 0.15,        // 15% — news (often neutral, reduce weight)
    technicalAlignment: 0.35,   // 35% — technical is king for swing trades
    volumeConfirmation: 0.15,   // 15% — volume
    fundamentalStrength: 0.15,  // 15% — fundamentals
};

/**
 * Calculate pattern strength score (0-100)
 * v2: No pattern = 35 (below neutral), strong pattern + breakout > 85
 */
const scorePatternStrength = (patterns: PatternAnalysis): { score: number; factors: string[] } => {
    const factors: string[] = [];
    let score = 35; // No pattern = below neutral (not 50)

    if (patterns.primary) {
        const confidence = patterns.primary.confidence || 50;
        score = confidence;
        factors.push(`Primary pattern: ${patterns.primary.name} (${confidence}%)`);

        if (patterns.primary.type === 'bullish') {
            score += 15;
            factors.push('Bullish pattern detected');
        } else if (patterns.primary.type === 'bearish') {
            score += 15; // Bearish is also a strong signal (high score = high confidence)
            factors.push('Bearish pattern detected');
        }
    } else {
        factors.push('No clear pattern detected');
    }

    // Trend alignment bonus (bigger impact)
    if (patterns.trend.strength > 70) {
        score += 15;
        factors.push(`Strong ${patterns.trend.direction} trend (${patterns.trend.strength}%)`);
    } else if (patterns.trend.strength > 50) {
        score += 8;
        factors.push(`Moderate ${patterns.trend.direction} trend (${patterns.trend.strength}%)`);
    }

    if (patterns.atBreakout) {
        score += 20;
        factors.push('At breakout level');
    }

    return { score: Math.min(100, Math.max(0, score)), factors };
};

/**
 * Calculate news sentiment score (0-100)
 * v2: No news = 50 (truly neutral), strong news 20-90
 */
const scoreNewsSentiment = (news: EnhancedNewsAnalysis): { score: number; factors: string[] } => {
    const factors: string[] = [];
    let score = news.sentimentScore;

    factors.push(`News sentiment: ${news.sentiment} (${news.sentimentScore})`);

    // Impact level modifier (stronger)
    if (news.impactLevel === 'high') {
        if (news.sentiment === 'positive') {
            score += 20;
            factors.push('High-impact positive news');
        } else if (news.sentiment === 'negative') {
            score -= 20;
            factors.push('High-impact negative news');
        }
    } else if (news.impactLevel === 'medium') {
        if (news.sentiment === 'positive') {
            score += 10;
            factors.push('Medium-impact positive news');
        } else if (news.sentiment === 'negative') {
            score -= 10;
            factors.push('Medium-impact negative news');
        }
    }

    if (news.items.length === 0) {
        score = 50; // Truly neutral
        factors.push('No recent news');
    }

    return { score: Math.min(100, Math.max(0, score)), factors };
};

/**
 * Calculate technical alignment score (0-100)
 * v2: All bullish = 90+, all bearish = 15, mixed = 45-55
 * Technical is weighted 35%, so this has the most influence
 */
const scoreTechnicalAlignment = (
    indicators: TechnicalIndicators,
    weekly?: TechnicalIndicators,
    monthly?: TechnicalIndicators
): { score: number; factors: string[] } => {
    const factors: string[] = [];
    let score = 50;

    // RSI scoring (wider range)
    const rsi = indicators.rsi.value;
    if (rsi >= 70) {
        score -= 15; // Overbought = danger
        factors.push(`RSI overbought (${rsi}) — reversal risk`);
    } else if (rsi >= 60) {
        score += 15; // Bullish momentum
        factors.push(`RSI bullish momentum (${rsi})`);
    } else if (rsi >= 40) {
        score += 5; // Healthy range, slight positive
        factors.push(`RSI healthy range (${rsi})`);
    } else if (rsi >= 30) {
        score += 20; // Oversold = buying opportunity
        factors.push(`RSI oversold (${rsi}) — potential reversal`);
    } else {
        score -= 10; // Extremely oversold = falling knife
        factors.push(`RSI extremely oversold (${rsi}) — falling knife risk`);
    }

    // MACD scoring (stronger signals)
    if (indicators.macd.trend === 'bullish') {
        score += 20;
        factors.push('MACD bullish crossover');
    } else if (indicators.macd.trend === 'bearish') {
        score -= 15;
        factors.push('MACD bearish crossover');
    }

    // MA trend (stronger signals)
    if (indicators.ma.trend === 'bullish') {
        score += 15;
        factors.push('Price above key moving averages');
    } else if (indicators.ma.trend === 'bearish') {
        score -= 15;
        factors.push('Price below key moving averages');
    }

    // Multi-timeframe alignment (big differentiator)
    if (weekly && monthly) {
        const dailyBullish = indicators.ma.trend === 'bullish';
        const weeklyBullish = weekly.ma.trend === 'bullish';
        const monthlyBullish = monthly.ma.trend === 'bullish';

        const dailyBearish = indicators.ma.trend === 'bearish';
        const weeklyBearish = weekly.ma.trend === 'bearish';
        const monthlyBearish = monthly.ma.trend === 'bearish';

        if (dailyBullish && weeklyBullish && monthlyBullish) {
            score += 25;
            factors.push('All timeframes aligned bullish ✅');
        } else if (dailyBearish && weeklyBearish && monthlyBearish) {
            score += 25; // Bearish alignment is also high-confidence (for SHORT)
            factors.push('All timeframes aligned bearish ✅');
        } else if ((dailyBullish && weeklyBullish) || (dailyBearish && weeklyBearish)) {
            score += 10;
            factors.push('Daily + Weekly aligned');
        } else {
            score -= 10;
            factors.push('Mixed timeframe signals — low conviction');
        }
    }

    return { score: Math.min(100, Math.max(0, score)), factors };
};

/**
 * Calculate volume confirmation score (0-100)
 * v2: Range 20-95 instead of 30-85
 */
const scoreVolumeConfirmation = (indicators: TechnicalIndicators): { score: number; factors: string[] } => {
    const factors: string[] = [];
    let score = 50;

    const volumeRatio = indicators.volume.ratio;

    if (volumeRatio > 2.0) {
        score = 95;
        factors.push(`Exceptional volume (${volumeRatio.toFixed(1)}x avg) — strong conviction`);
    } else if (volumeRatio > 1.5) {
        score = 80;
        factors.push(`High volume confirmation (${volumeRatio.toFixed(1)}x avg)`);
    } else if (volumeRatio > 1.0) {
        score = 65;
        factors.push(`Above average volume (${volumeRatio.toFixed(1)}x)`);
    } else if (volumeRatio > 0.7) {
        score = 45;
        factors.push(`Below average volume (${volumeRatio.toFixed(1)}x)`);
    } else if (volumeRatio > 0.4) {
        score = 30;
        factors.push(`Low volume (${volumeRatio.toFixed(1)}x) — weak conviction`);
    } else {
        score = 20;
        factors.push(`Very low volume (${volumeRatio.toFixed(1)}x) — no conviction`);
    }

    return { score, factors };
};

/**
 * Calculate fundamental strength score (0-100)
 * v2: Wider range 25-90
 */
const scoreFundamentalStrength = (fundamentals: FundamentalData): { score: number; factors: string[] } => {
    const factors: string[] = [];
    let score = 50;

    // Valuation scoring (stronger)
    switch (fundamentals.valuation) {
        case 'undervalued':
            score += 25;
            factors.push('Undervalued by fundamentals');
            break;
        case 'overvalued':
            score -= 20;
            factors.push('Overvalued — premium pricing risk');
            break;
        case 'fair':
            score += 5;
            factors.push('Fair valuation');
            break;
    }

    // Growth scoring (stronger)
    switch (fundamentals.growth) {
        case 'strong':
            score += 20;
            factors.push('Strong growth metrics');
            break;
        case 'weak':
            score -= 15;
            factors.push('Weak growth');
            break;
        case 'moderate':
            score += 8;
            factors.push('Moderate growth');
            break;
    }

    // Sector comparison (stronger)
    if (fundamentals.sectorComparison === 'outperforming') {
        score += 12;
        factors.push('Outperforming sector');
    } else if (fundamentals.sectorComparison === 'underperforming') {
        score -= 12;
        factors.push('Underperforming sector');
    }

    if (fundamentals.metrics.peRatio) {
        factors.push(`P/E Ratio: ${fundamentals.metrics.peRatio}`);
    }

    return { score: Math.min(100, Math.max(0, score)), factors };
};

/**
 * Calculate overall confidence score and recommendation
 * v2: Added signal agreement amplifier — when signals agree, push score harder
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
    let weightedScore = Math.round(
        breakdown.patternStrength * WEIGHTS.patternStrength +
        breakdown.newsSentiment * WEIGHTS.newsSentiment +
        breakdown.technicalAlignment * WEIGHTS.technicalAlignment +
        breakdown.volumeConfirmation * WEIGHTS.volumeConfirmation +
        breakdown.fundamentalStrength * WEIGHTS.fundamentalStrength
    );

    // ── Signal agreement amplifier ──
    // When multiple signals agree on direction, amplify the score
    // When they disagree, push toward neutral (50)
    const bullishSignals = [
        input.indicators.ma.trend === 'bullish',
        input.indicators.macd.trend === 'bullish',
        input.indicators.rsi.value > 40 && input.indicators.rsi.value < 70,
        input.patterns.primary?.type === 'bullish',
        input.patterns.atBreakout === true,
    ].filter(Boolean).length;

    const bearishSignals = [
        input.indicators.ma.trend === 'bearish',
        input.indicators.macd.trend === 'bearish',
        input.indicators.rsi.value > 70, // Overbought
        input.patterns.primary?.type === 'bearish',
    ].filter(Boolean).length;

    const dominantDirection = bullishSignals >= bearishSignals ? bullishSignals : bearishSignals;

    // Amplifier: 4+ signals agree → boost by 12, 3 → +8, 2 → +0, 1 → -5
    if (dominantDirection >= 4) {
        const amplifier = 12;
        weightedScore = weightedScore > 50
            ? Math.min(95, weightedScore + amplifier)
            : Math.max(15, weightedScore - amplifier);
    } else if (dominantDirection >= 3) {
        const amplifier = 8;
        weightedScore = weightedScore > 50
            ? Math.min(92, weightedScore + amplifier)
            : Math.max(18, weightedScore - amplifier);
    } else if (dominantDirection <= 1) {
        // No clear direction — push toward neutral
        weightedScore = Math.round(weightedScore * 0.85 + 50 * 0.15);
    }

    // Collect all factors
    const allFactors = [
        ...patternResult.factors,
        ...newsResult.factors,
        ...technicalResult.factors,
        ...volumeResult.factors,
        ...fundamentalResult.factors,
    ];

    // Determine recommendation (v2: wider thresholds)
    let recommendation: ConfidenceResult['recommendation'];
    const isBullish = input.indicators.ma.trend === 'bullish' ||
        input.patterns.primary?.type === 'bullish' ||
        input.indicators.macd.trend === 'bullish';

    const isBearish = input.indicators.ma.trend === 'bearish' ||
        input.patterns.primary?.type === 'bearish' ||
        input.indicators.macd.trend === 'bearish';

    if (weightedScore < 35) {
        recommendation = 'WAIT';
    } else if (weightedScore >= 65 && isBullish) {
        recommendation = 'BUY';
    } else if (weightedScore >= 65 && isBearish) {
        recommendation = 'SELL';
    } else if (weightedScore >= 35 && weightedScore < 50) {
        recommendation = 'WAIT';
    } else {
        recommendation = 'HOLD';
    }

    return {
        score: Math.min(95, Math.max(15, weightedScore)),
        breakdown,
        factors: allFactors.slice(0, 10),
        recommendation,
    };
};
