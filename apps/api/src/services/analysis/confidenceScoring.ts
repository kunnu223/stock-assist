/**
 * Confidence Scoring Service
 * Direction model (bullish/bearish signals) + strength model (weighted sub-scores)
 * → combined recommendation with conviction-based thresholds
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
    regime?: MarketRegime;
    // v5: additional context for richer scoring
    adxValue?: number;
    bollingerPercentB?: number;
    candlestickComposite?: number;  // -1 to +1 from candlestick analysis
}

// Default weight configuration (fallback when no regime is classified)
const DEFAULT_WEIGHTS: RegimeWeights = {
    technical: 0.40,       // 40% — technical is king for swing trades (up from 35)
    pattern: 0.20,         // 20% — patterns
    volume: 0.15,          // 15% — volume
    news: 0.10,            // 10% — news (often neutral, reduced)
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
 * Non-linear sigmoid push — amplifies strong signals toward extremes.
 * Scores near 50 stay near 50. Scores above 65 get pushed toward 85-95.
 * Scores below 35 get pushed toward 15-25.
 *
 * Uses a modified sigmoid: output = 50 + 50 * tanh(k * (input - 50) / 50)
 * k controls steepness (higher = more aggressive push)
 */
function sigmoidPush(score: number, steepness: number = 1.8): number {
    const normalized = (score - 50) / 50; // -1 to +1
    const pushed = Math.tanh(steepness * normalized);
    return Math.round(50 + 50 * pushed);
}

/**
 * Calculate pattern strength score (0-100)
 * v5: Stronger ranges, trend alignment has more impact
 */
const scorePatternStrength = (patterns: PatternAnalysis): { score: number; factors: string[] } => {
    const factors: string[] = [];
    let score = 30; // No pattern = well below neutral

    if (patterns.primary) {
        const confidence = patterns.primary.confidence || 50;
        score = confidence;
        factors.push(`Primary pattern: ${patterns.primary.name} (${confidence}%)`);

        if (patterns.primary.type === 'bullish') {
            score += 20;
            factors.push('Bullish pattern detected');
        } else if (patterns.primary.type === 'bearish') {
            score += 20;
            factors.push('Bearish pattern detected');
        }
    } else {
        factors.push('No clear pattern detected');
    }

    // Trend alignment bonus (bigger impact in v5)
    if (patterns.trend.strength > 70) {
        score += 20;
        factors.push(`Strong ${patterns.trend.direction} trend (${patterns.trend.strength}%)`);
    } else if (patterns.trend.strength > 50) {
        score += 12;
        factors.push(`Moderate ${patterns.trend.direction} trend (${patterns.trend.strength}%)`);
    }

    if (patterns.atBreakout) {
        score += 25;
        factors.push('At breakout level — high momentum');
    }

    // Secondary patterns add confidence
    if (patterns.secondary && patterns.secondary.length > 0) {
        score += Math.min(10, patterns.secondary.length * 5);
        factors.push(`${patterns.secondary.length} confirming pattern(s)`);
    }

    return { score: Math.min(100, Math.max(0, score)), factors };
};

/**
 * Calculate news sentiment score (0-100)
 * v5: More decisive — positive high-impact news = 85+
 */
const scoreNewsSentiment = (news: EnhancedNewsAnalysis): { score: number; factors: string[] } => {
    const factors: string[] = [];
    let score = news.sentimentScore;

    factors.push(`News sentiment: ${news.sentiment} (${news.sentimentScore})`);

    if (news.impactLevel === 'high') {
        if (news.sentiment === 'positive') {
            score += 25;
            factors.push('High-impact positive news');
        } else if (news.sentiment === 'negative') {
            score -= 25;
            factors.push('High-impact negative news');
        }
    } else if (news.impactLevel === 'medium') {
        if (news.sentiment === 'positive') {
            score += 15;
            factors.push('Medium-impact positive news');
        } else if (news.sentiment === 'negative') {
            score -= 15;
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
 * v5: Wider scoring ranges, EMA crossover impact, stronger MTF alignment
 */
const scoreTechnicalAlignment = (
    indicators: TechnicalIndicators,
    weekly?: TechnicalIndicators,
    monthly?: TechnicalIndicators
): { score: number; factors: string[] } => {
    const factors: string[] = [];
    let score = 50;

    // RSI scoring — v5.1: context-aware (respects trend direction)
    // Oversold in a downtrend = falling knife, NOT buying opportunity
    const rsi = indicators.rsi.value;
    const trendIsBearish = indicators.ma.trend === 'bearish';
    const trendIsBullish = indicators.ma.trend === 'bullish';

    if (rsi >= 75) {
        if (trendIsBullish) {
            score += 5; // Overbought in a strong uptrend = momentum, not reversal
            factors.push(`RSI overbought in uptrend (${rsi}) — strong momentum`);
        } else {
            score -= 20;
            factors.push(`RSI extreme overbought (${rsi}) — high reversal risk`);
        }
    } else if (rsi >= 70) {
        if (trendIsBullish) {
            score += 8;
            factors.push(`RSI overbought in uptrend (${rsi}) — bullish momentum`);
        } else {
            score -= 10;
            factors.push(`RSI overbought (${rsi}) — caution`);
        }
    } else if (rsi >= 55) {
        score += 20;
        factors.push(`RSI bullish momentum (${rsi})`);
    } else if (rsi >= 40) {
        score += 10;
        factors.push(`RSI healthy range (${rsi})`);
    } else if (rsi >= 30) {
        // v5.1: Oversold RSI scoring depends on trend
        if (trendIsBearish) {
            // Falling knife — oversold in a downtrend confirms bearish strength
            score -= 10;
            factors.push(`RSI oversold in downtrend (${rsi}) — falling knife, bearish momentum`);
        } else if (trendIsBullish) {
            // Pullback in uptrend — genuine buying opportunity
            score += 25;
            factors.push(`RSI oversold in uptrend (${rsi}) — strong buying opportunity`);
        } else {
            // Neutral trend — mild positive (possible bounce)
            score += 8;
            factors.push(`RSI oversold (${rsi}) — potential bounce`);
        }
    } else {
        // Extreme oversold < 30
        if (trendIsBearish) {
            score -= 15; // Capitulation in a downtrend = strong bearish signal
            factors.push(`RSI deeply oversold in downtrend (${rsi}) — capitulation sell-off`);
        } else {
            score += 5; // Possible reversal
            factors.push(`RSI deeply oversold (${rsi}) — potential capitulation reversal`);
        }
    }

    // MACD scoring (stronger signals in v5)
    if (indicators.macd.trend === 'bullish') {
        score += 22;
        factors.push('MACD bullish crossover');
        // Histogram momentum bonus
        if (indicators.macd.histogram > 0) {
            const histStrength = Math.min(10, Math.abs(indicators.macd.histogram) * 2);
            score += Math.round(histStrength);
            factors.push(`MACD histogram positive (${indicators.macd.histogram})`);
        }
    } else if (indicators.macd.trend === 'bearish') {
        score -= 18;
        factors.push('MACD bearish crossover');
        if (indicators.macd.histogram < 0) {
            score -= Math.min(8, Math.abs(indicators.macd.histogram) * 2);
        }
    }

    // MACD divergence (powerful signal)
    if (indicators.macd.divergence === 'bullish') {
        score += 15;
        factors.push('MACD bullish divergence — momentum shifting up');
    } else if (indicators.macd.divergence === 'bearish') {
        score -= 12;
        factors.push('MACD bearish divergence — momentum weakening');
    }

    // MA trend (stronger signals)
    if (indicators.ma.trend === 'bullish') {
        score += 18;
        factors.push('Price above key moving averages');
    } else if (indicators.ma.trend === 'bearish') {
        score -= 18;
        factors.push('Price below key moving averages');
    }

    // EMA 9/21 crossover (short-term momentum)
    if (indicators.ma.ema9 > indicators.ma.ema21) {
        score += 12;
        factors.push('EMA 9 > EMA 21 — short-term bullish');
    } else if (indicators.ma.ema9 < indicators.ma.ema21) {
        score -= 10;
        factors.push('EMA 9 < EMA 21 — short-term bearish');
    }

    // Multi-timeframe alignment (big differentiator)
    // v5.1: Works with weekly-only when monthly is unavailable (don't skip entirely)
    const dailyBullish = indicators.ma.trend === 'bullish';
    const dailyBearish = indicators.ma.trend === 'bearish';
    const weeklyBullish = weekly?.ma.trend === 'bullish';
    const weeklyBearish = weekly?.ma.trend === 'bearish';
    const monthlyBullish = monthly?.ma.trend === 'bullish';
    const monthlyBearish = monthly?.ma.trend === 'bearish';

    if (weekly && monthly) {
        // All 3 timeframes available
        if (dailyBullish && weeklyBullish && monthlyBullish) {
            score += 30;
            factors.push('All timeframes aligned bullish — maximum conviction');
        } else if (dailyBearish && weeklyBearish && monthlyBearish) {
            score += 30;
            factors.push('All timeframes aligned bearish — maximum conviction');
        } else if ((dailyBullish && weeklyBullish) || (dailyBearish && weeklyBearish)) {
            score += 18;
            factors.push('Daily + Weekly aligned');
        } else {
            score -= 8;
            factors.push('Mixed timeframe signals');
        }
    } else if (weekly) {
        // v5.1: Only weekly available (monthly missing) — still give credit for alignment
        if ((dailyBullish && weeklyBullish) || (dailyBearish && weeklyBearish)) {
            score += 22; // Strong bonus — daily + weekly agree
            factors.push('Daily + Weekly aligned (monthly unavailable)');
        } else if (dailyBullish !== dailyBearish && weeklyBullish !== weeklyBearish) {
            // One is directional, other is neutral — mild mixed
            score -= 4;
            factors.push('Partial timeframe conflict');
        }
    }

    return { score: Math.min(100, Math.max(0, score)), factors };
};

/**
 * Calculate volume confirmation score (0-100)
 * v5: More granular ranges, higher ceiling
 */
const scoreVolumeConfirmation = (indicators: TechnicalIndicators): { score: number; factors: string[] } => {
    const factors: string[] = [];
    const volumeRatio = indicators.volume.ratio;

    let score: number;
    if (volumeRatio > 2.5) {
        score = 100;
        factors.push(`Massive volume (${volumeRatio.toFixed(1)}x avg) — institutional activity`);
    } else if (volumeRatio > 2.0) {
        score = 92;
        factors.push(`Exceptional volume (${volumeRatio.toFixed(1)}x avg) — strong conviction`);
    } else if (volumeRatio > 1.5) {
        score = 82;
        factors.push(`High volume confirmation (${volumeRatio.toFixed(1)}x avg)`);
    } else if (volumeRatio > 1.2) {
        score = 70;
        factors.push(`Above average volume (${volumeRatio.toFixed(1)}x) — confirmed`);
    } else if (volumeRatio > 1.0) {
        score = 58;
        factors.push(`Normal volume (${volumeRatio.toFixed(1)}x)`);
    } else if (volumeRatio > 0.7) {
        score = 40;
        factors.push(`Below average volume (${volumeRatio.toFixed(1)}x)`);
    } else if (volumeRatio > 0.4) {
        score = 25;
        factors.push(`Low volume (${volumeRatio.toFixed(1)}x) — weak conviction`);
    } else {
        score = 15;
        factors.push(`Very low volume (${volumeRatio.toFixed(1)}x) — no conviction`);
    }

    return { score, factors };
};

/**
 * Calculate fundamental strength score (0-100)
 * v5: Wider range, stronger differentiation
 */
const scoreFundamentalStrength = (fundamentals: FundamentalData): { score: number; factors: string[] } => {
    const factors: string[] = [];
    let score = 50;

    // Valuation scoring (stronger in v5)
    switch (fundamentals.valuation) {
        case 'undervalued':
            score += 28;
            factors.push('Undervalued by fundamentals — margin of safety');
            break;
        case 'overvalued':
            score -= 22;
            factors.push('Overvalued — premium pricing risk');
            break;
        case 'fair':
            score += 5;
            factors.push('Fair valuation');
            break;
    }

    // Growth scoring (stronger in v5)
    switch (fundamentals.growth) {
        case 'strong':
            score += 22;
            factors.push('Strong growth metrics');
            break;
        case 'weak':
            score -= 18;
            factors.push('Weak growth');
            break;
        case 'moderate':
            score += 10;
            factors.push('Moderate growth');
            break;
    }

    // Sector comparison (stronger in v5)
    if (fundamentals.sectorComparison === 'outperforming') {
        score += 15;
        factors.push('Outperforming sector');
    } else if (fundamentals.sectorComparison === 'underperforming') {
        score -= 15;
        factors.push('Underperforming sector');
    }

    if (fundamentals.metrics.peRatio) {
        factors.push(`P/E Ratio: ${fundamentals.metrics.peRatio}`);
    }

    return { score: Math.min(100, Math.max(0, score)), factors };
};

/**
 * Calculate overall confidence score and recommendation
 * Backward-compatible wrapper — delegates to the split model (v5).
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
 * v5: Decisive Signals Engine
 *
 * Model A (Direction): 10 bullish + 8 bearish checks for richer signal detection.
 *   Conviction = dominantCount / sameDirectionChecks (FIXED from /totalChecks).
 *
 * Model B (Strength): Regime-weighted sub-scores with:
 *   - Signal amplification (1.15-1.25x when 5+ signals agree)
 *   - Non-linear sigmoid push toward extremes
 *   - Trend conviction profile shortcuts
 *
 * Combined: direction + strength → recommendation (threshold lowered to 60).
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

    // Direction model: weighted bullish/bearish signal checks
    const bullishSignalChecks = [
        { signal: input.indicators.ma.trend === 'bullish', label: 'MA bullish', weight: 3 },
        { signal: input.indicators.ma.ema9 > input.indicators.ma.ema21, label: 'EMA 9/21 bullish crossover', weight: 2 },
        { signal: input.indicators.macd.trend === 'bullish', label: 'MACD bullish', weight: 3 },
        { signal: input.indicators.macd.histogram > 0, label: 'MACD histogram positive', weight: 1 },
        { signal: input.indicators.macd.divergence === 'bullish', label: 'MACD bullish divergence', weight: 2 },
        { signal: input.indicators.rsi.value >= 50 && input.indicators.rsi.value < 60 && input.indicators.ma.trend === 'bullish', label: 'RSI mid-range in uptrend', weight: 1 },
        { signal: input.indicators.rsi.value >= 30 && input.indicators.rsi.value <= 40 && input.indicators.ma.trend !== 'bearish', label: 'RSI oversold reversal zone', weight: 2 },
        { signal: input.patterns.primary?.type === 'bullish', label: 'Bullish pattern', weight: 3 },
        { signal: input.patterns.atBreakout === true, label: 'At breakout', weight: 2 },
        { signal: input.indicators.volume.ratio > 1.2 && input.indicators.ma.trend === 'bullish', label: 'Volume confirmed uptrend', weight: 1 },
    ];
    const bearishSignalChecks = [
        { signal: input.indicators.ma.trend === 'bearish', label: 'MA bearish', weight: 3 },
        { signal: input.indicators.ma.ema9 < input.indicators.ma.ema21, label: 'EMA 9/21 bearish crossover', weight: 2 },
        { signal: input.indicators.macd.trend === 'bearish', label: 'MACD bearish', weight: 3 },
        { signal: input.indicators.macd.histogram < 0, label: 'MACD histogram negative', weight: 1 },
        { signal: input.indicators.macd.divergence === 'bearish', label: 'MACD bearish divergence', weight: 2 },
        { signal: input.indicators.rsi.value > 70, label: 'RSI overbought', weight: 2 },
        { signal: input.indicators.rsi.value < 35 && input.indicators.ma.trend === 'bearish', label: 'RSI weak in downtrend', weight: 2 },
        { signal: input.patterns.primary?.type === 'bearish', label: 'Bearish pattern', weight: 3 },
        { signal: input.indicators.volume.ratio > 1.2 && input.indicators.ma.trend === 'bearish', label: 'Volume confirmed downtrend', weight: 1 },
        { signal: input.indicators.volume.ratio > 1.5 && input.indicators.ma.trend === 'bearish', label: 'Heavy volume selling', weight: 2 },
    ];

    // Multi-timeframe directional checks
    if (input.weeklyIndicators) {
        bullishSignalChecks.push(
            { signal: input.weeklyIndicators.ma.trend === 'bullish', label: 'Weekly trend bullish', weight: 3 }
        );
        bearishSignalChecks.push(
            { signal: input.weeklyIndicators.ma.trend === 'bearish', label: 'Weekly trend bearish', weight: 3 }
        );
    }
    if (input.monthlyIndicators) {
        bullishSignalChecks.push(
            { signal: input.monthlyIndicators.ma.trend === 'bullish', label: 'Monthly trend bullish', weight: 2 }
        );
        bearishSignalChecks.push(
            { signal: input.monthlyIndicators.ma.trend === 'bearish', label: 'Monthly trend bearish', weight: 2 }
        );
    }

    const bullishSignals = bullishSignalChecks.filter(s => s.signal).length;
    const bearishSignals = bearishSignalChecks.filter(s => s.signal).length;
    const dominantCount = Math.max(bullishSignals, bearishSignals);

    const bullishWeightedScore = bullishSignalChecks.filter(s => s.signal).reduce((sum, s) => sum + s.weight, 0);
    const bearishWeightedScore = bearishSignalChecks.filter(s => s.signal).reduce((sum, s) => sum + s.weight, 0);
    const bullishTotalWeight = bullishSignalChecks.reduce((sum, s) => sum + s.weight, 0);
    const bearishTotalWeight = bearishSignalChecks.reduce((sum, s) => sum + s.weight, 0);

    const signalDetails: string[] = [
        ...bullishSignalChecks.filter(s => s.signal).map(s => `✅ ${s.label}`),
        ...bearishSignalChecks.filter(s => s.signal).map(s => `🔻 ${s.label}`),
    ];

    let directionValue: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
    if (bullishSignals > bearishSignals && bullishSignals >= 3) {
        directionValue = 'BULLISH';
    } else if (bearishSignals > bullishSignals && bearishSignals >= 3) {
        directionValue = 'BEARISH';
    } else if (bullishWeightedScore > bearishWeightedScore && bullishSignals >= 2) {
        directionValue = 'BULLISH';
    } else if (bearishWeightedScore > bullishWeightedScore && bearishSignals >= 2) {
        directionValue = 'BEARISH';
    } else if (bullishSignals > bearishSignals) {
        directionValue = 'BULLISH';
    } else if (bearishSignals > bullishSignals) {
        directionValue = 'BEARISH';
    } else {
        directionValue = 'NEUTRAL';
    }

    // Weighted conviction for dominant direction
    const dominantWeightedScore = directionValue === 'BULLISH' ? bullishWeightedScore
        : directionValue === 'BEARISH' ? bearishWeightedScore
        : Math.max(bullishWeightedScore, bearishWeightedScore);
    const dominantTotalWeight = directionValue === 'BULLISH' ? bullishTotalWeight
        : directionValue === 'BEARISH' ? bearishTotalWeight
        : Math.max(bullishTotalWeight, bearishTotalWeight);
    const conviction = dominantTotalWeight > 0
        ? Math.round((dominantWeightedScore / dominantTotalWeight) * 100)
        : 0;

    const directionResult: DirectionResult = {
        direction: directionValue,
        conviction,
        bullishSignals,
        bearishSignals,
        signalDetails,
    };

    // Strength model: weighted sub-scores with direction-aware technical alignment
    const weights = getActiveWeights(input.regime);

    // Invert technical alignment when direction is bearish (12% raw → 88% bearish-aligned)
    let effectiveTechnical = breakdown.technicalAlignment;
    if (directionValue === 'BEARISH' && breakdown.technicalAlignment < 40) {
        effectiveTechnical = 100 - breakdown.technicalAlignment;
    } else if (directionValue === 'BULLISH' && breakdown.technicalAlignment > 60) {
        effectiveTechnical = breakdown.technicalAlignment;
    }

    let strengthScore = Math.round(
        effectiveTechnical * weights.technical +
        breakdown.patternStrength * weights.pattern +
        breakdown.volumeConfirmation * weights.volume +
        breakdown.newsSentiment * weights.news +
        breakdown.fundamentalStrength * weights.fundamental
    );

    // ── Signal amplification: when signals strongly agree, boost the score ──
    if (dominantCount >= 7) {
        strengthScore = Math.round(strengthScore * 1.25);
    } else if (dominantCount >= 5) {
        strengthScore = Math.round(strengthScore * 1.18);
    } else if (dominantCount >= 4) {
        strengthScore = Math.round(strengthScore * 1.10);
    }

    if (dominantCount <= 1 && directionValue === 'NEUTRAL') {
        strengthScore = Math.round(strengthScore * 0.85 + 50 * 0.15);
    }

    // Conviction profile floors for strong multi-timeframe alignment
    const allTFBullish = input.weeklyIndicators?.ma.trend === 'bullish' &&
        input.monthlyIndicators?.ma.trend === 'bullish' &&
        input.indicators.ma.trend === 'bullish';
    const allTFBearish = input.weeklyIndicators?.ma.trend === 'bearish' &&
        input.monthlyIndicators?.ma.trend === 'bearish' &&
        input.indicators.ma.trend === 'bearish';
    const dailyWeeklyBullish = input.weeklyIndicators?.ma.trend === 'bullish' &&
        input.indicators.ma.trend === 'bullish';
    const dailyWeeklyBearish = input.weeklyIndicators?.ma.trend === 'bearish' &&
        input.indicators.ma.trend === 'bearish';

    if ((allTFBullish || allTFBearish) && input.indicators.volume.ratio >= 1.2) {
        strengthScore = Math.max(strengthScore, 78);
    }
    if ((dailyWeeklyBullish || dailyWeeklyBearish) && !input.monthlyIndicators) {
        strengthScore = Math.max(strengthScore, 72);
    }
    if (input.patterns.atBreakout && input.indicators.volume.ratio >= 1.5) {
        strengthScore = Math.max(strengthScore, 80);
    }
    if (input.indicators.rsi.value <= 35 && input.indicators.macd.trend === 'bullish' &&
        input.indicators.volume.ratio >= 1.0) {
        strengthScore = Math.max(strengthScore, 75);
    }
    if (input.adxValue && input.adxValue >= 30 && (allTFBullish || allTFBearish)) {
        strengthScore = Math.max(strengthScore, 82);
    }
    if (input.patterns.primary?.confidence && input.patterns.primary.confidence >= 70 &&
        (dailyWeeklyBullish || dailyWeeklyBearish)) {
        strengthScore = Math.max(strengthScore, 70);
    }

    strengthScore = sigmoidPush(strengthScore, 1.6);

    if (input.candlestickComposite !== undefined && Math.abs(input.candlestickComposite) > 0.2) {
        const candleBonus = Math.round(input.candlestickComposite * 15);
        if ((directionValue === 'BULLISH' && candleBonus > 0) ||
            (directionValue === 'BEARISH' && candleBonus < 0)) {
            strengthScore += Math.abs(candleBonus);
        }
    }

    const strengthResult: StrengthResult = {
        strength: Math.min(95, Math.max(15, strengthScore)),
        breakdown,
        regime: input.regime,
        weightsUsed: weights,
    };

    // Combined recommendation
    const clampedScore = Math.min(95, Math.max(15, strengthScore));
    let recommendation: SplitConfidenceResult['recommendation'];
    if (clampedScore >= 60 && directionValue === 'BULLISH') {
        recommendation = 'BUY';
    } else if (clampedScore >= 60 && directionValue === 'BEARISH') {
        recommendation = 'SELL';
    } else if (clampedScore >= 50 && conviction >= 70 && directionValue === 'BULLISH') {
        recommendation = 'BUY';
    } else if (clampedScore >= 50 && conviction >= 70 && directionValue === 'BEARISH') {
        recommendation = 'SELL';
    } else if (directionValue === 'NEUTRAL' && clampedScore < 35) {
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
        factors: allFactors.slice(0, 12),
        breakdown,
    };
};
