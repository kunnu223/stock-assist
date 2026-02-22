/**
 * Commodity-Specific Indicators
 * Price-volume analysis, commodity confidence scoring
 * @module @stock-assist/api/services/commodity/indicators
 */

import type { OHLCData, TechnicalIndicators } from '@stock-assist/shared';
import type { SeasonalityResult } from './seasonality';
import type { MacroContext } from './macroContext';
import type { CrashDetectionResult } from './crashDetection';

export interface PriceVolumeSignal {
    signal: 'STRONG_BULLISH' | 'WEAK_BULLISH' | 'STRONG_BEARISH' | 'WEAK_BEARISH' | 'NEUTRAL';
    description: string;
    modifier: number;  // -10 to +10
}

export interface CommodityConfidenceResult {
    score: number;                // 15-95
    direction: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
    recommendation: 'BUY' | 'SELL' | 'HOLD' | 'WAIT';
    signalStrength: {
        stars: 1 | 2 | 3 | 4 | 5;
        aligned: number;       // how many of 6 signals agree
        total: number;         // always 6
        label: string;         // "Strong Setup" / "Moderate" / "Don't Trade"
    };
    tradeability: {
        canTrade: boolean;
        reason: string;
        suggestion: string;
    };
    breakdown: {
        technical: number;
        seasonality: number;
        macro: number;
        priceVolume: number;
        crashRisk: number;
    };
    factors: string[];
}

/**
 * Analyze price-volume relationship
 * 
 * Price ↑ + Volume ↑ = STRONG BULLISH (new money entering)
 * Price ↑ + Volume ↓ = WEAK BULLISH (short covering)
 * Price ↓ + Volume ↑ = STRONG BEARISH (new shorts)
 * Price ↓ + Volume ↓ = WEAK BEARISH (longs exiting)
 */
export function analyzePriceVolume(history: OHLCData[]): PriceVolumeSignal {
    if (history.length < 5) {
        return { signal: 'NEUTRAL', description: 'Insufficient data', modifier: 0 };
    }

    // Compare last 3 days vs prior 5 days
    const recent3 = history.slice(-3);
    const prior5 = history.slice(-8, -3);

    if (prior5.length < 3) {
        return { signal: 'NEUTRAL', description: 'Insufficient data', modifier: 0 };
    }

    const recentAvgPrice = recent3.reduce((s, b) => s + b.close, 0) / recent3.length;
    const priorAvgPrice = prior5.reduce((s, b) => s + b.close, 0) / prior5.length;
    const recentAvgVol = recent3.reduce((s, b) => s + b.volume, 0) / recent3.length;
    const priorAvgVol = prior5.reduce((s, b) => s + b.volume, 0) / prior5.length;

    const priceRising = recentAvgPrice > priorAvgPrice;
    const volumeRising = priorAvgVol > 0 && (recentAvgVol / priorAvgVol) > 1.1;
    const volumeFalling = priorAvgVol > 0 && (recentAvgVol / priorAvgVol) < 0.9;

    if (priceRising && volumeRising) {
        return {
            signal: 'STRONG_BULLISH',
            description: 'Price rising with increasing volume — new money entering',
            modifier: 10,
        };
    } else if (priceRising && volumeFalling) {
        return {
            signal: 'WEAK_BULLISH',
            description: 'Price rising but volume declining — short covering rally',
            modifier: 3,
        };
    } else if (!priceRising && volumeRising) {
        return {
            signal: 'STRONG_BEARISH',
            description: 'Price falling with increasing volume — new shorts entering',
            modifier: -10,
        };
    } else if (!priceRising && volumeFalling) {
        return {
            signal: 'WEAK_BEARISH',
            description: 'Price falling with declining volume — longs exiting',
            modifier: -3,
        };
    }

    return { signal: 'NEUTRAL', description: 'No clear price-volume divergence', modifier: 0 };
}

/**
 * Calculate commodity confidence score
 * Combines technical, seasonal, macro, price-volume, and crash risk
 */
export function calculateCommodityConfidence(
    indicators: TechnicalIndicators,
    seasonality: SeasonalityResult,
    macro: MacroContext,
    priceVolume: PriceVolumeSignal,
    crashDetection: CrashDetectionResult,
    weeklyIndicators?: TechnicalIndicators
): CommodityConfidenceResult {
    const factors: string[] = [];

    // ── 1. Technical Score (0-100, weight 35%) ──
    let techScore = 50;

    // RSI — cross-referenced with MA trend (Fix #4)
    const rsi = indicators.rsi.value;
    const maTrend = indicators.ma.trend;
    if (rsi >= 70) {
        techScore -= 12;
        factors.push(`RSI overbought (${rsi})`);
    } else if (rsi >= 55) {
        techScore += 15;
        factors.push(`RSI bullish momentum (${rsi})`);
    } else if (rsi >= 40) {
        techScore += 5;
        factors.push(`RSI neutral (${rsi})`);
    } else if (rsi >= 30) {
        // In a downtrend, oversold RSI = momentum, not opportunity
        if (maTrend === 'bearish') {
            techScore -= 5;
            factors.push(`RSI oversold in downtrend (${rsi}) — momentum, not reversal`);
        } else {
            techScore += 12;
            factors.push(`RSI oversold opportunity (${rsi})`);
        }
    } else {
        if (maTrend === 'bearish') {
            techScore -= 15;
            factors.push(`RSI extremely oversold in downtrend (${rsi}) — strong selling`);
        } else {
            techScore -= 5;
            factors.push(`RSI extremely oversold (${rsi}) — possible bounce`);
        }
    }

    // MACD
    if (indicators.macd.trend === 'bullish') { techScore += 18; factors.push('MACD bullish crossover'); }
    else if (indicators.macd.trend === 'bearish') { techScore -= 15; factors.push('MACD bearish crossover'); }

    // Moving averages
    if (maTrend === 'bullish') { techScore += 15; factors.push('Above key MAs — bullish'); }
    else if (maTrend === 'bearish') { techScore -= 15; factors.push('Below key MAs — bearish'); }

    // Weekly confirmation
    if (weeklyIndicators) {
        if (weeklyIndicators.ma.trend === maTrend) {
            techScore += 12;
            factors.push(`Weekly confirms daily: ${maTrend}`);
        } else {
            techScore -= 8;
            factors.push('Weekly-daily timeframe conflict');
        }
    }

    techScore = Math.max(0, Math.min(100, techScore));

    // ── 2. Seasonality Score (0-100) ──
    const seasonScore = seasonality.currentMonth.winRate;
    factors.push(`Seasonality: ${seasonality.currentMonth.bias} (${seasonScore}% win rate)`);

    // ── 3. Macro Score (0-100) ──
    const macroBase = 50 + macro.modifier * 3; // ±45 range from macro
    const macroScore = Math.max(0, Math.min(100, macroBase));
    factors.push(`Macro: ${macro.overallBias} (USD ${macro.usdCorrelation.impact.substring(0, 50)})`);

    // ── 4. Price-Volume Score (0-100) ──
    const pvScore = 50 + priceVolume.modifier * 5; // ±50 range
    factors.push(`Price-Volume: ${priceVolume.signal}`);

    // ── 5. Crash Risk Score (0-100, inverse) ──
    // Higher crash probability = LOWER score
    const crashScore = Math.max(0, 100 - crashDetection.probability * 2);

    // ── Weighted combination ──
    // Fix #5: Reduce seasonality weight (static data = noise), increase technical
    const weights = { technical: 0.35, seasonality: 0.08, macro: 0.25, priceVolume: 0.17, crashRisk: 0.15 };

    let weightedScore = Math.round(
        techScore * weights.technical +
        seasonScore * weights.seasonality +
        macroScore * weights.macro +
        pvScore * weights.priceVolume +
        crashScore * weights.crashRisk
    );

    // ── Fix #2: Weighted signal agreement (technical 2x, others 1x) ──
    const bullishWeight =
        (indicators.ma.trend === 'bullish' ? 2 : 0) +
        (indicators.macd.trend === 'bullish' ? 2 : 0) +
        (indicators.rsi.value > 40 && indicators.rsi.value < 70 ? 1 : 0) +
        (seasonality.currentMonth.bias === 'BULLISH' ? 1 : 0) +
        (macro.overallBias === 'BULLISH' ? 1 : 0) +
        (priceVolume.signal === 'STRONG_BULLISH' ? 1 : 0);

    const bearishWeight =
        (indicators.ma.trend === 'bearish' ? 2 : 0) +
        (indicators.macd.trend === 'bearish' ? 2 : 0) +
        (indicators.rsi.value > 70 ? 1 : 0) +
        (seasonality.currentMonth.bias === 'BEARISH' ? 1 : 0) +
        (macro.overallBias === 'BEARISH' ? 1 : 0) +
        (priceVolume.signal === 'STRONG_BEARISH' ? 1 : 0);

    // Count for star rating (max 8 weighted points)
    const dominantWeight = Math.max(bullishWeight, bearishWeight);
    const totalPossible = 8;
    const alignmentRatio = dominantWeight / totalPossible;

    if (alignmentRatio >= 0.75) {
        const amp = 15;
        weightedScore = weightedScore > 50 ? Math.min(95, weightedScore + amp) : Math.max(15, weightedScore - amp);
        factors.push(`🎯 Strong alignment (${dominantWeight}/${totalPossible}) — high conviction`);
    } else if (alignmentRatio >= 0.5) {
        const amp = 10;
        weightedScore = weightedScore > 50 ? Math.min(92, weightedScore + amp) : Math.max(18, weightedScore - amp);
        factors.push(`${dominantWeight}/${totalPossible} weighted signals aligned`);
    } else if (alignmentRatio <= 0.25) {
        weightedScore = Math.round(weightedScore * 0.85 + 50 * 0.15);
        factors.push('Mixed signals — low conviction');
    }

    // Final clamp
    weightedScore = Math.max(15, Math.min(95, weightedScore));

    // Direction — weighted voting (Fix #2)
    const isBullish = indicators.ma.trend === 'bullish' || indicators.macd.trend === 'bullish';
    const isBearish = indicators.ma.trend === 'bearish' || indicators.macd.trend === 'bearish';
    const direction = bullishWeight > bearishWeight ? 'BULLISH'
        : bearishWeight > bullishWeight ? 'BEARISH' : 'NEUTRAL';

    // Recommendation
    let recommendation: CommodityConfidenceResult['recommendation'];
    if (weightedScore >= 65 && isBullish) recommendation = 'BUY';
    else if (weightedScore >= 65 && isBearish) recommendation = 'SELL';
    else if (weightedScore < 40) recommendation = 'WAIT';
    else recommendation = 'HOLD';

    // Signal Strength Stars (using weighted alignment)
    let stars: 1 | 2 | 3 | 4 | 5;
    let starLabel: string;
    if (alignmentRatio >= 0.75) {
        stars = 5;
        starLabel = 'Strong Setup — High Probability';
    } else if (alignmentRatio >= 0.625) {
        stars = 4;
        starLabel = 'Good Setup';
    } else if (alignmentRatio >= 0.5) {
        stars = 3;
        starLabel = 'Moderate — Be Cautious';
    } else if (alignmentRatio >= 0.375) {
        stars = 2;
        starLabel = 'Weak — Risky Trade';
    } else {
        stars = 1;
        starLabel = 'Conflicting — Don\'t Trade';
    }

    // Tradeability gate
    const rsiExtreme = indicators.rsi.value > 85 || indicators.rsi.value < 15;
    const crashHigh = crashDetection.probability > 60;
    let canTrade = true;
    let tradeReason = 'Signals are aligned — trade conditions acceptable';
    let tradeSuggestion = 'Follow the recommended action with proper position sizing';

    if (stars <= 2) {
        canTrade = false;
        tradeReason = `Weighted alignment only ${dominantWeight}/${totalPossible} — too much conflict`;
        tradeSuggestion = 'Wait for stronger signal alignment before entering';
    } else if (crashHigh) {
        canTrade = false;
        tradeReason = `Crash probability is ${crashDetection.probability}% — high risk environment`;
        tradeSuggestion = 'Stay in cash until crash risk drops below 40%';
    } else if (rsiExtreme) {
        canTrade = false;
        tradeReason = `RSI at extreme level (${indicators.rsi.value.toFixed(0)}) — reversal likely`;
        tradeSuggestion = 'Wait for RSI to return to 30-70 range';
    }

    return {
        score: weightedScore,
        direction,
        recommendation: canTrade ? recommendation : 'WAIT',
        signalStrength: {
            stars,
            aligned: dominantWeight,
            total: totalPossible,
            label: starLabel,
        },
        tradeability: {
            canTrade,
            reason: tradeReason,
            suggestion: tradeSuggestion,
        },
        breakdown: {
            technical: techScore,
            seasonality: seasonScore,
            macro: macroScore,
            priceVolume: pvScore,
            crashRisk: crashScore,
        },
        factors: factors.slice(0, 12),
    };
}
