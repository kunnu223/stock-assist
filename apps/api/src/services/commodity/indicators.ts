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

    // ── 1. Technical Score (0-100, weight 30%) ──
    let techScore = 50;

    // RSI
    const rsi = indicators.rsi.value;
    if (rsi >= 70) { techScore -= 12; factors.push(`RSI overbought (${rsi})`); }
    else if (rsi >= 55) { techScore += 15; factors.push(`RSI bullish momentum (${rsi})`); }
    else if (rsi >= 40) { techScore += 5; factors.push(`RSI neutral (${rsi})`); }
    else if (rsi >= 30) { techScore += 18; factors.push(`RSI oversold opportunity (${rsi})`); }
    else { techScore -= 8; factors.push(`RSI extremely oversold (${rsi})`); }

    // MACD
    if (indicators.macd.trend === 'bullish') { techScore += 18; factors.push('MACD bullish crossover'); }
    else if (indicators.macd.trend === 'bearish') { techScore -= 15; factors.push('MACD bearish crossover'); }

    // Moving averages
    if (indicators.ma.trend === 'bullish') { techScore += 15; factors.push('Above key MAs — bullish'); }
    else if (indicators.ma.trend === 'bearish') { techScore -= 15; factors.push('Below key MAs — bearish'); }

    // Weekly confirmation
    if (weeklyIndicators) {
        if (weeklyIndicators.ma.trend === indicators.ma.trend) {
            techScore += 12;
            factors.push(`Weekly confirms daily: ${indicators.ma.trend}`);
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
    const weights = { technical: 0.30, seasonality: 0.15, macro: 0.25, priceVolume: 0.15, crashRisk: 0.15 };

    let weightedScore = Math.round(
        techScore * weights.technical +
        seasonScore * weights.seasonality +
        macroScore * weights.macro +
        pvScore * weights.priceVolume +
        crashScore * weights.crashRisk
    );

    // ── Signal agreement amplifier ──
    const bullishSignals = [
        indicators.ma.trend === 'bullish',
        indicators.macd.trend === 'bullish',
        indicators.rsi.value > 40 && indicators.rsi.value < 70,
        seasonality.currentMonth.bias === 'BULLISH',
        macro.overallBias === 'BULLISH',
        priceVolume.signal === 'STRONG_BULLISH',
    ].filter(Boolean).length;

    const bearishSignals = [
        indicators.ma.trend === 'bearish',
        indicators.macd.trend === 'bearish',
        indicators.rsi.value > 70,
        seasonality.currentMonth.bias === 'BEARISH',
        macro.overallBias === 'BEARISH',
        priceVolume.signal === 'STRONG_BEARISH',
    ].filter(Boolean).length;

    const dominant = Math.max(bullishSignals, bearishSignals);
    if (dominant >= 5) {
        const amp = 15;
        weightedScore = weightedScore > 50 ? Math.min(95, weightedScore + amp) : Math.max(15, weightedScore - amp);
        factors.push(`🎯 ${dominant}/6 signals aligned — high conviction`);
    } else if (dominant >= 4) {
        const amp = 10;
        weightedScore = weightedScore > 50 ? Math.min(92, weightedScore + amp) : Math.max(18, weightedScore - amp);
        factors.push(`${dominant}/6 signals aligned`);
    } else if (dominant <= 1) {
        weightedScore = Math.round(weightedScore * 0.85 + 50 * 0.15);
        factors.push('Mixed signals — low conviction');
    }

    // Final clamp
    weightedScore = Math.max(15, Math.min(95, weightedScore));

    // Direction
    const isBullish = indicators.ma.trend === 'bullish' || indicators.macd.trend === 'bullish';
    const isBearish = indicators.ma.trend === 'bearish' || indicators.macd.trend === 'bearish';
    const direction = bullishSignals > bearishSignals ? 'BULLISH'
        : bearishSignals > bullishSignals ? 'BEARISH' : 'NEUTRAL';

    // Recommendation
    let recommendation: CommodityConfidenceResult['recommendation'];
    if (weightedScore >= 65 && isBullish) recommendation = 'BUY';
    else if (weightedScore >= 65 && isBearish) recommendation = 'SELL';
    else if (weightedScore < 40) recommendation = 'WAIT';
    else recommendation = 'HOLD';

    return {
        score: weightedScore,
        direction,
        recommendation,
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
