/**
 * Multi-Timeframe Alignment Service
 * @module @stock-assist/api/utils/timeframeAlignment
 * 
 * Verifies that daily, weekly, and monthly trends align.
 * Trades with conflicting timeframes are marked for avoidance.
 * 
 * Philosophy: "Trade with the tide, not against it"
 * - Daily gives entry timing
 * - Weekly confirms swing direction
 * - Monthly confirms primary trend
 */

import type { TechnicalIndicators } from '@stock-assist/shared';

// ═══════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════

/** 
 * Minimum alignment score to proceed with trade
 * Score ranges 0-100 where:
 * - 100 = All timeframes perfectly aligned
 * - 75+ = Strong alignment (recommended)
 * - 50-74 = Moderate alignment (proceed with caution)
 * - <50 = Poor alignment (avoid)
 */
const MIN_ALIGNMENT_SCORE = 60;

/**
 * Weight for each timeframe in alignment calculation
 * Higher weight = more important
 */
const TIMEFRAME_WEIGHTS = {
    daily: 0.2,    // Entry timing
    weekly: 0.35,  // Swing direction
    monthly: 0.45  // Primary trend (most important)
};

/**
 * RSI thresholds for trend determination
 */
const RSI_THRESHOLDS = {
    bullish: 55,   // RSI above this = bullish
    bearish: 45,   // RSI below this = bearish
    neutral: { min: 45, max: 55 }  // Between = neutral
};

// ═══════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════

export type TrendDirection = 'BULLISH' | 'BEARISH' | 'NEUTRAL';

export interface TimeframeTrend {
    timeframe: 'daily' | 'weekly' | 'monthly';
    trend: TrendDirection;
    confidence: number;  // 0-100
    signals: {
        rsi: TrendDirection;
        ma: TrendDirection;
        momentum: TrendDirection;
    };
    rawData: {
        rsi: number;
        maTrend: string;
        priceVsSma20: 'above' | 'below' | 'at';
    };
}

export interface AlignmentResult {
    aligned: boolean;
    score: number;  // 0-100
    overallTrend: TrendDirection;
    timeframes: {
        daily: TimeframeTrend;
        weekly?: TimeframeTrend;
        monthly?: TimeframeTrend;
    };
    conflicts: string[];
    recommendation: string;
    tradeable: boolean;
}

// ═══════════════════════════════════════════════════════════════
// CORE FUNCTIONS
// ═══════════════════════════════════════════════════════════════

/**
 * Determine trend from indicators
 */
function analyzeTrend(
    indicators: TechnicalIndicators | undefined,
    timeframe: 'daily' | 'weekly' | 'monthly'
): TimeframeTrend | null {
    if (!indicators) return null;

    const rsi = indicators.rsi?.value || 50;
    const maTrend = indicators.ma?.trend || 'NEUTRAL';
    const sma20 = indicators.ma?.sma20 || 0;
    const currentPrice = indicators.ma?.sma20 || 0; // Approximation

    // Determine RSI trend
    let rsiTrend: TrendDirection = 'NEUTRAL';
    if (rsi > RSI_THRESHOLDS.bullish) rsiTrend = 'BULLISH';
    else if (rsi < RSI_THRESHOLDS.bearish) rsiTrend = 'BEARISH';

    // Determine MA trend
    let maTrendDir: TrendDirection = 'NEUTRAL';
    const maLower = maTrend.toLowerCase();
    if (maLower.includes('bullish') || maLower.includes('uptrend') || maLower.includes('up')) {
        maTrendDir = 'BULLISH';
    } else if (maLower.includes('bearish') || maLower.includes('downtrend') || maLower.includes('down')) {
        maTrendDir = 'BEARISH';
    }

    // Determine momentum (based on RSI momentum)
    let momentumTrend: TrendDirection = 'NEUTRAL';
    if (rsi > 60) momentumTrend = 'BULLISH';
    else if (rsi < 40) momentumTrend = 'BEARISH';

    // Calculate overall trend for this timeframe
    const signals = { rsi: rsiTrend, ma: maTrendDir, momentum: momentumTrend };
    const bullishCount = Object.values(signals).filter(s => s === 'BULLISH').length;
    const bearishCount = Object.values(signals).filter(s => s === 'BEARISH').length;

    let trend: TrendDirection;
    let confidence: number;

    if (bullishCount >= 2) {
        trend = 'BULLISH';
        confidence = bullishCount === 3 ? 90 : 70;
    } else if (bearishCount >= 2) {
        trend = 'BEARISH';
        confidence = bearishCount === 3 ? 90 : 70;
    } else {
        trend = 'NEUTRAL';
        confidence = 50;
    }

    return {
        timeframe,
        trend,
        confidence,
        signals,
        rawData: {
            rsi,
            maTrend,
            priceVsSma20: currentPrice > sma20 ? 'above' : currentPrice < sma20 ? 'below' : 'at'
        }
    };
}

/**
 * Check multi-timeframe alignment
 * @param dailyIndicators - Indicators from daily data
 * @param weeklyIndicators - Indicators from weekly data (optional)
 * @param monthlyIndicators - Indicators from monthly data (optional)
 */
export function checkTimeframeAlignment(
    dailyIndicators: TechnicalIndicators,
    weeklyIndicators?: TechnicalIndicators,
    monthlyIndicators?: TechnicalIndicators
): AlignmentResult {
    const conflicts: string[] = [];

    // Analyze each timeframe
    const daily = analyzeTrend(dailyIndicators, 'daily');
    const weekly = weeklyIndicators ? analyzeTrend(weeklyIndicators, 'weekly') : null;
    const monthly = monthlyIndicators ? analyzeTrend(monthlyIndicators, 'monthly') : null;

    if (!daily) {
        return {
            aligned: false,
            score: 0,
            overallTrend: 'NEUTRAL',
            timeframes: { daily: null as any },
            conflicts: ['Daily indicators unavailable'],
            recommendation: 'Cannot analyze - insufficient data',
            tradeable: false
        };
    }

    // Calculate alignment score
    let score = 0;
    let totalWeight = 0;

    // Daily contribution
    const dailyScore = daily.trend !== 'NEUTRAL' ? daily.confidence : 50;
    score += dailyScore * TIMEFRAME_WEIGHTS.daily;
    totalWeight += TIMEFRAME_WEIGHTS.daily;

    // Weekly contribution (if available)
    if (weekly) {
        const weeklyScore = weekly.trend !== 'NEUTRAL' ? weekly.confidence : 50;

        // Check alignment with daily
        if (daily.trend !== 'NEUTRAL' && weekly.trend !== 'NEUTRAL' && daily.trend !== weekly.trend) {
            conflicts.push(`Daily (${daily.trend}) conflicts with Weekly (${weekly.trend})`);
            score += weeklyScore * TIMEFRAME_WEIGHTS.weekly * 0.5; // Reduce contribution
        } else if (daily.trend === weekly.trend && daily.trend !== 'NEUTRAL') {
            score += weeklyScore * TIMEFRAME_WEIGHTS.weekly * 1.2; // Boost for alignment
        } else {
            score += weeklyScore * TIMEFRAME_WEIGHTS.weekly;
        }
        totalWeight += TIMEFRAME_WEIGHTS.weekly;
    }

    // Monthly contribution (if available)
    if (monthly) {
        const monthlyScore = monthly.trend !== 'NEUTRAL' ? monthly.confidence : 50;

        // Check alignment with daily and weekly
        if (daily.trend !== 'NEUTRAL' && monthly.trend !== 'NEUTRAL' && daily.trend !== monthly.trend) {
            conflicts.push(`Daily (${daily.trend}) conflicts with Monthly (${monthly.trend})`);
            score += monthlyScore * TIMEFRAME_WEIGHTS.monthly * 0.3; // Heavy reduction
        } else if (weekly && weekly.trend !== 'NEUTRAL' && monthly.trend !== 'NEUTRAL' && weekly.trend !== monthly.trend) {
            conflicts.push(`Weekly (${weekly.trend}) conflicts with Monthly (${monthly.trend})`);
            score += monthlyScore * TIMEFRAME_WEIGHTS.monthly * 0.5; // Reduce contribution
        } else if (daily.trend === monthly.trend && daily.trend !== 'NEUTRAL') {
            score += monthlyScore * TIMEFRAME_WEIGHTS.monthly * 1.3; // Big boost for alignment
        } else {
            score += monthlyScore * TIMEFRAME_WEIGHTS.monthly;
        }
        totalWeight += TIMEFRAME_WEIGHTS.monthly;
    }

    // Normalize score to 0-100
    const normalizedScore = Math.min(100, Math.max(0, Math.round((score / totalWeight) * 100) / 100));
    const finalScore = Math.round(normalizedScore);

    // Determine overall trend (prioritize monthly > weekly > daily)
    let overallTrend: TrendDirection;
    if (monthly && monthly.trend !== 'NEUTRAL') {
        overallTrend = monthly.trend;
    } else if (weekly && weekly.trend !== 'NEUTRAL') {
        overallTrend = weekly.trend;
    } else {
        overallTrend = daily.trend;
    }

    // Check if all available timeframes agree
    const trends = [daily.trend, weekly?.trend, monthly?.trend].filter(t => t && t !== 'NEUTRAL');
    const allAgree = trends.length > 0 && trends.every(t => t === trends[0]);

    // Generate recommendation
    let recommendation: string;
    let tradeable = true;

    if (allAgree && trends.length >= 2) {
        recommendation = `Strong ${trends[0]} alignment across ${trends.length} timeframes`;
    } else if (conflicts.length === 0 && finalScore >= MIN_ALIGNMENT_SCORE) {
        recommendation = `Acceptable alignment (${finalScore}%) - proceed with caution`;
    } else if (conflicts.length > 0) {
        tradeable = finalScore >= MIN_ALIGNMENT_SCORE;
        recommendation = `Conflicting signals: ${conflicts.join('; ')}. ${tradeable ? 'Reduced confidence.' : 'Avoid trade.'}`;
    } else {
        recommendation = 'Neutral signals - wait for clearer direction';
        tradeable = false;
    }

    return {
        aligned: conflicts.length === 0 && allAgree,
        score: finalScore,
        overallTrend,
        timeframes: {
            daily,
            ...(weekly && { weekly }),
            ...(monthly && { monthly })
        },
        conflicts,
        recommendation,
        tradeable: tradeable && finalScore >= MIN_ALIGNMENT_SCORE
    };
}

/**
 * Quick check if timeframes are aligned enough to trade
 */
export function isTimeframeAligned(
    dailyIndicators: TechnicalIndicators,
    weeklyIndicators?: TechnicalIndicators,
    monthlyIndicators?: TechnicalIndicators
): boolean {
    const result = checkTimeframeAlignment(dailyIndicators, weeklyIndicators, monthlyIndicators);
    return result.tradeable;
}

/**
 * Get a simple alignment string for logging
 */
export function getAlignmentSummary(
    dailyIndicators: TechnicalIndicators,
    weeklyIndicators?: TechnicalIndicators,
    monthlyIndicators?: TechnicalIndicators
): string {
    const result = checkTimeframeAlignment(dailyIndicators, weeklyIndicators, monthlyIndicators);

    const tfSummary = [
        `D:${result.timeframes.daily?.trend?.[0] || '?'}`,
        result.timeframes.weekly ? `W:${result.timeframes.weekly.trend[0]}` : '',
        result.timeframes.monthly ? `M:${result.timeframes.monthly.trend[0]}` : ''
    ].filter(Boolean).join('/');

    return `${tfSummary} (${result.score}%) - ${result.aligned ? '✅ Aligned' : result.tradeable ? '⚠️ Proceed w/ caution' : '❌ Conflicts'}`;
}
