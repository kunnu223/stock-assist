/**
 * Technical Analysis Aggregator
 * @module @stock-assist/api/services/analysis/technicalAnalysis
 */

import type { OHLCData, TechnicalIndicators, PatternAnalysis } from '@stock-assist/shared';
import { calcIndicators } from '../indicators';
import { analyzePatterns } from '../patterns';
import { calcBollingerBands, calcFibonacciLevels } from '../indicators/bollinger';
import { getCandlestickPatternNames } from './candlestick';

// Local type definitions
export interface TimeframeResult {
    patterns: string[];
    trend: 'bullish' | 'bearish' | 'neutral';
    strength: number;
    keyLevels: {
        support: number;
        resistance: number;
    };
}

export interface MultiTimeframeAnalysis {
    timeframes: {
        '1D': TimeframeResult;
        '1W': TimeframeResult;
        '1M': TimeframeResult;
    };
    alignment: 'bullish' | 'bearish' | 'neutral' | 'mixed';
    alignmentScore: number;
}

interface TimeframeData {
    daily: OHLCData[];
    weekly: OHLCData[];
    monthly: OHLCData[];
}

interface ComprehensiveTechnicalAnalysis {
    multiTimeframe: MultiTimeframeAnalysis;
    candlestickPatterns: string[];
    bollingerBands: ReturnType<typeof calcBollingerBands>;
    fibonacciLevels: ReturnType<typeof calcFibonacciLevels>;
    indicators: {
        daily: TechnicalIndicators;
        weekly: TechnicalIndicators | null;
        monthly: TechnicalIndicators | null;
    };
    patterns: {
        daily: PatternAnalysis;
        weekly: PatternAnalysis | null;
        monthly: PatternAnalysis | null;
    };
}

/**
 * Analyze a single timeframe
 */
const analyzeTimeframe = (data: OHLCData[]): TimeframeResult => {
    if (!data || data.length < 5) {
        return {
            patterns: [],
            trend: 'neutral',
            strength: 0,
            keyLevels: { support: 0, resistance: 0 },
        };
    }

    const indicators = calcIndicators(data);
    const patterns = analyzePatterns(data);

    const patternNames: string[] = [];
    if (patterns.primary) {
        patternNames.push(patterns.primary.name);
    }
    patterns.secondary.forEach((p) => patternNames.push(p.name));

    // Add trend info
    if (indicators.ma.trend === 'bullish') {
        patternNames.push('Above MAs');
    } else if (indicators.ma.trend === 'bearish') {
        patternNames.push('Below MAs');
    }

    return {
        patterns: patternNames.slice(0, 5),
        trend: patterns.trend.direction as 'bullish' | 'bearish' | 'neutral',
        strength: patterns.trend.strength,
        keyLevels: {
            support: indicators.sr.support,
            resistance: indicators.sr.resistance,
        },
    };
};

/**
 * Determine overall timeframe alignment
 */
const getAlignment = (
    daily: TimeframeResult,
    weekly: TimeframeResult,
    monthly: TimeframeResult
): { alignment: MultiTimeframeAnalysis['alignment']; score: number } => {
    const trends = [daily.trend, weekly.trend, monthly.trend];
    const bullishCount = trends.filter((t) => t === 'bullish').length;
    const bearishCount = trends.filter((t) => t === 'bearish').length;

    if (bullishCount === 3) {
        return { alignment: 'bullish', score: 100 };
    } else if (bearishCount === 3) {
        return { alignment: 'bearish', score: 100 };
    } else if (bullishCount === 0 && bearishCount === 0) {
        return { alignment: 'neutral', score: 50 };
    } else {
        // Mixed signals
        const score = 50 + (bullishCount - bearishCount) * 15;
        return { alignment: 'mixed', score };
    }
};

/**
 * Perform comprehensive technical analysis
 */
export const performComprehensiveTechnicalAnalysis = (
    timeframeData: TimeframeData
): ComprehensiveTechnicalAnalysis => {
    const { daily, weekly, monthly } = timeframeData;

    // Analyze each timeframe
    const dailyResult = analyzeTimeframe(daily);
    const weeklyResult = analyzeTimeframe(weekly);
    const monthlyResult = analyzeTimeframe(monthly);

    // Get alignment
    const { alignment, score: alignmentScore } = getAlignment(dailyResult, weeklyResult, monthlyResult);

    // Calculate indicators for each timeframe
    const dailyIndicators = calcIndicators(daily);
    console.log(`[technicalAnalysis.ts:138] 1D Indicators: RSI ${dailyIndicators.rsi.value.toFixed(1)} (${dailyIndicators.rsi.interpretation}), MACD ${dailyIndicators.macd.trend}, MA ${dailyIndicators.ma.trend}`);

    const weeklyIndicators = weekly.length >= 5 ? calcIndicators(weekly) : null;
    if (weeklyIndicators) {
        console.log(`[technicalAnalysis.ts:142] 1W Indicators: RSI ${weeklyIndicators.rsi.value.toFixed(1)} (${weeklyIndicators.rsi.interpretation}), MACD ${weeklyIndicators.macd.trend}, MA ${weeklyIndicators.ma.trend}`);
    }

    const monthlyIndicators = monthly.length >= 5 ? calcIndicators(monthly) : null;
    if (monthlyIndicators) {
        console.log(`[technicalAnalysis.ts:147] 1M Indicators: RSI ${monthlyIndicators.rsi.value.toFixed(1)} (${monthlyIndicators.rsi.interpretation}), MACD ${monthlyIndicators.macd.trend}, MA ${monthlyIndicators.ma.trend}`);
    }

    // Calculate patterns for each timeframe
    const dailyPatterns = analyzePatterns(daily);
    const weeklyPatterns = weekly.length >= 5 ? analyzePatterns(weekly) : null;
    const monthlyPatterns = monthly.length >= 5 ? analyzePatterns(monthly) : null;

    // Candlestick patterns from daily data
    const candlestickPatterns = getCandlestickPatternNames(daily);

    // Bollinger Bands from daily data
    const prices = daily.map((d) => d.close);
    const bollingerBands = calcBollingerBands(prices);
    const fibonacciLevels = calcFibonacciLevels(prices);

    return {
        multiTimeframe: {
            timeframes: {
                '1D': dailyResult,
                '1W': weeklyResult,
                '1M': monthlyResult,
            },
            alignment,
            alignmentScore,
        },
        candlestickPatterns,
        bollingerBands,
        fibonacciLevels,
        indicators: {
            daily: dailyIndicators,
            weekly: weeklyIndicators,
            monthly: monthlyIndicators,
        },
        patterns: {
            daily: dailyPatterns,
            weekly: weeklyPatterns,
            monthly: monthlyPatterns,
        },
    };
};

/**
 * Get summary of technical analysis for AI prompt
 */
export const getTechnicalSummary = (analysis: ComprehensiveTechnicalAnalysis): string => {
    const { multiTimeframe, candlestickPatterns, bollingerBands, fibonacciLevels, indicators } = analysis;

    const lines: string[] = [
        `MULTI-TIMEFRAME ANALYSIS:`,
        `• Daily Trend: ${multiTimeframe.timeframes['1D'].trend} (${multiTimeframe.timeframes['1D'].strength}%)`,
        `• Weekly Trend: ${multiTimeframe.timeframes['1W'].trend} (${multiTimeframe.timeframes['1W'].strength}%)`,
        `• Monthly Trend: ${multiTimeframe.timeframes['1M'].trend} (${multiTimeframe.timeframes['1M'].strength}%)`,
        `• Overall Alignment: ${multiTimeframe.alignment} (${multiTimeframe.alignmentScore}%)`,
        ``,
        `INDICATORS (Daily):`,
        `• RSI: ${indicators.daily.rsi.value} (${indicators.daily.rsi.interpretation})`,
        `• MACD: ${indicators.daily.macd.trend} (Histogram: ${indicators.daily.macd.histogram})`,
        `• Volume: ${indicators.daily.volume.trend} (${indicators.daily.volume.ratio}x avg)`,
        ``,
        `BOLLINGER BANDS:`,
        `• Upper: ₹${bollingerBands.upper}`,
        `• Middle: ₹${bollingerBands.middle}`,
        `• Lower: ₹${bollingerBands.lower}`,
        `• Position: ${bollingerBands.position} (%B: ${bollingerBands.percentB})`,
        ``,
        `FIBONACCI LEVELS:`,
        fibonacciLevels.levels.map((l) => `• ${l.level}: ₹${l.price}`).join('\n'),
        ``,
        `CANDLESTICK PATTERNS:`,
        candlestickPatterns.length > 0 ? candlestickPatterns.map((p) => `• ${p}`).join('\n') : '• No significant patterns',
        ``,
        `KEY SUPPORT/RESISTANCE:`,
        `• Daily Support: ₹${multiTimeframe.timeframes['1D'].keyLevels.support}`,
        `• Daily Resistance: ₹${multiTimeframe.timeframes['1D'].keyLevels.resistance}`,
    ];

    return lines.join('\n');
};
