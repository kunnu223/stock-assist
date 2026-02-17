/**
 * Confidence Scoring Service — v4 (direction/probability split)
 * 
 * v1 problem: all sub-scores started at 50 with ±10 modifiers,
 * producing a weighted average always in 50-65 range.
 * 
 * v2 fix: stronger signals → wider ranges, signal agreement amplifier
 * 
 * v3 fix: dynamic weights based on market regime instead of static 35/20/15/15/15.
 * In strong trends, technical weight increases. In event-driven markets, news dominates.
 * Falls back to default weights when regime is not provided.
 * 
 * v4 fix (Phase B #3): Split Direction from Probability.
 * Model A → Direction = BULLISH | BEARISH | NEUTRAL (from signal agreement)
 * Model B → Strength = 0-100% (from regime-weighted sub-scores)
 * These are now independent outputs — no bias contamination.
 * 
 * @module @stock-assist/api/services/analysis/confidenceScoring
 */

import type { TechnicalIndicators, PatternAnalysis } from '@stock-assist/shared';
import type { MarketRegime } from '../../models/SignalRecord';
import { getWeightsForRegime, type RegimeWeights } from './regimeClassifier';

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

// ═══════════════════════════════════════════════════════════════
// Phase B #3: Direction/Probability Split (New Interfaces)
// ═══════════════════════════════════════════════════════════════

/** Model A output — pure direction signal independent of strength */
export interface DirectionResult {
    direction: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
    conviction: number;          // 0-100 how strongly signals agree on this direction
    bullishSignals: number;      // count of bullish signals
    bearishSignals: number;      // count of bearish signals
    signalDetails: string[];     // which signals contributed
}

/** Model B output — pure strength/probability independent of direction */
export interface StrengthResult {
    strength: number;            // 0-100 weighted sub-score strength
    breakdown: ConfidenceBreakdown;
    regime?: MarketRegime;
    weightsUsed: RegimeWeights;
}

/** Combined result from the split model (Phase B #3) */
export interface SplitConfidenceResult {
    // Model A: Direction
    direction: DirectionResult;
    // Model B: Strength
    strength: StrengthResult;
    // Combined (backward-compatible)
    score: number;               // strength, clamped 15-95
    recommendation: 'BUY' | 'SELL' | 'HOLD' | 'WAIT';
    factors: string[];
    breakdown: ConfidenceBreakdown;
}

interface ScoringInput {
    patterns: PatternAnalysis;
    news: EnhancedNewsAnalysis;
    indicators: TechnicalIndicators;
    fundamentals: FundamentalData;
    weeklyIndicators?: TechnicalIndicators;
    monthlyIndicators?: TechnicalIndicators;
    regime?: MarketRegime;  // v3: dynamic weights based on market regime
}

// Default weight configuration (fallback when no regime is classified)
const DEFAULT_WEIGHTS: RegimeWeights = {
    technical: 0.35,       // 35% — technical is king for swing trades
    pattern: 0.20,         // 20% — patterns
    volume: 0.15,          // 15% — volume
    news: 0.15,            // 15% — news (often neutral, reduce weight)
    fundamental: 0.15,     // 15% — fundamentals
};

/**
 * Get active weights — regime-adaptive or default fallback
 */
function getActiveWeights(regime?: MarketRegime): RegimeWeights {
    if (!regime) return DEFAULT_WEIGHTS;
    return getWeightsForRegime(regime);
}

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
 * v3: Regime-adaptive weights (backward-compatible wrapper)
 * Internally delegates to the split model (v4).
 */
export const calculateConfidence = (input: ScoringInput): ConfidenceResult => {
    const split = calculateSplitConfidence(input);
    return {
        score: split.score,
        breakdown: split.breakdown,
        factors: split.factors,
        recommendation: split.recommendation,
    };
};

/**
 * Phase B #3: Split Direction/Probability Model
 * 
 * Model A (Direction): Counts bullish vs bearish technical signals.
 *   Output: BULLISH | BEARISH | NEUTRAL + conviction score.
 *   Pure signal agreement — no mixing with strength.
 * 
 * Model B (Strength): Weighted sub-score calculation.
 *   Output: 0-100% strength score based on regime-adaptive weights.
 *   Pure strength — no mixing with direction.
 * 
 * Combined: direction + strength → recommendation.
 */
export const calculateSplitConfidence = (input: ScoringInput): SplitConfidenceResult => {
    // ── Sub-score calculations (shared by both models) ──
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

    // ════════════════════════════════════════════
    // MODEL A: Direction (pure signal agreement)
    // ════════════════════════════════════════════
    const bullishSignalChecks = [
        { signal: input.indicators.ma.trend === 'bullish', label: 'MA bullish' },
        { signal: input.indicators.macd.trend === 'bullish', label: 'MACD bullish' },
        { signal: input.indicators.rsi.value > 40 && input.indicators.rsi.value < 70, label: 'RSI healthy range' },
        { signal: input.patterns.primary?.type === 'bullish', label: 'Bullish pattern' },
        { signal: input.patterns.atBreakout === true, label: 'At breakout' },
    ];
    const bearishSignalChecks = [
        { signal: input.indicators.ma.trend === 'bearish', label: 'MA bearish' },
        { signal: input.indicators.macd.trend === 'bearish', label: 'MACD bearish' },
        { signal: input.indicators.rsi.value > 70, label: 'RSI overbought' },
        { signal: input.patterns.primary?.type === 'bearish', label: 'Bearish pattern' },
    ];

    const bullishSignals = bullishSignalChecks.filter(s => s.signal).length;
    const bearishSignals = bearishSignalChecks.filter(s => s.signal).length;
    const totalChecks = bullishSignalChecks.length + bearishSignalChecks.length;
    const dominantCount = Math.max(bullishSignals, bearishSignals);

    const signalDetails: string[] = [
        ...bullishSignalChecks.filter(s => s.signal).map(s => `✅ ${s.label}`),
        ...bearishSignalChecks.filter(s => s.signal).map(s => `🔻 ${s.label}`),
    ];

    let directionValue: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
    if (bullishSignals > bearishSignals && bullishSignals >= 2) {
        directionValue = 'BULLISH';
    } else if (bearishSignals > bullishSignals && bearishSignals >= 2) {
        directionValue = 'BEARISH';
    } else {
        directionValue = 'NEUTRAL';
    }

    // Conviction = how strongly signals agree (percentage of dominant signals)
    const conviction = totalChecks > 0 ? Math.round((dominantCount / totalChecks) * 100) : 0;

    const directionResult: DirectionResult = {
        direction: directionValue,
        conviction,
        bullishSignals,
        bearishSignals,
        signalDetails,
    };

    // ════════════════════════════════════════════
    // MODEL B: Strength (pure weighted sub-scores)
    // ════════════════════════════════════════════
    const weights = getActiveWeights(input.regime);

    let strengthScore = Math.round(
        breakdown.technicalAlignment * weights.technical +
        breakdown.patternStrength * weights.pattern +
        breakdown.volumeConfirmation * weights.volume +
        breakdown.newsSentiment * weights.news +
        breakdown.fundamentalStrength * weights.fundamental
    );

    // Dampen toward neutral only when signals show NO clear direction
    if (dominantCount <= 1) {
        strengthScore = Math.round(strengthScore * 0.85 + 50 * 0.15);
    }

    const strengthResult: StrengthResult = {
        strength: Math.min(95, Math.max(15, strengthScore)),
        breakdown,
        regime: input.regime,
        weightsUsed: weights,
    };

    // ════════════════════════════════════════════
    // COMBINED: direction + strength → recommendation
    // ════════════════════════════════════════════
    const clampedScore = Math.min(95, Math.max(15, strengthScore));

    let recommendation: SplitConfidenceResult['recommendation'];
    if (clampedScore < 35) {
        recommendation = 'WAIT';
    } else if (clampedScore >= 65 && directionValue === 'BULLISH') {
        recommendation = 'BUY';
    } else if (clampedScore >= 65 && directionValue === 'BEARISH') {
        recommendation = 'SELL';
    } else if (clampedScore >= 35 && clampedScore < 50) {
        recommendation = 'WAIT';
    } else {
        recommendation = 'HOLD';
    }

    // Collect all factors
    const allFactors = [
        ...patternResult.factors,
        ...newsResult.factors,
        ...technicalResult.factors,
        ...volumeResult.factors,
        ...fundamentalResult.factors,
    ];

    return {
        direction: directionResult,
        strength: strengthResult,
        score: clampedScore,
        recommendation,
        factors: allFactors.slice(0, 10),
        breakdown,
    };
};
