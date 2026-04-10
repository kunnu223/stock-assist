/**
 * Historical Backtester — runs the existing analysis pipeline on historical data
 * WITHOUT AI calls, news, fundamentals, or DB saves.
 * This isolates your system algorithms for reproducible backtesting.
 * @module @stock-assist/api/services/backtest/historicalBacktester
 */

import type { OHLCData } from '@stock-assist/shared';
import { performComprehensiveTechnicalAnalysis } from '../analysis/technicalAnalysis';
import { calculateSplitConfidence } from '../analysis/confidenceScoring';
import type { EnhancedNewsAnalysis, FundamentalData } from '../analysis/confidenceScoring';
import { calculatePatternConfluence } from '../analysis/patternConfluence';
import { detectFundamentalTechnicalConflict } from '../analysis/fundamentalTechnical';
import { composeSignal } from '../analysis/signalComposer';
import { calculateEntryZone } from '../analysis/entryZone';
import { classifyRegime } from '../analysis/regimeClassifier';
import { calcADX } from '../indicators/adx';
import { calcATR, buildMACDHistogramArray, macdHistogramMomentum, volumeTrend } from '../indicators';
import { calcBollingerBands } from '../indicators/bollinger';
import { detectRSIDivergence } from '../indicators/rsi';

// ═══════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════

/** All boolean/bucketed conditions captured at signal time for stack analysis */
export interface BacktestConditions {
    // Regime
    regime: string;
    isStrongTrend: boolean;
    isTransition: boolean;
    // Trend alignment
    weeklyAligned: boolean;
    allTimeframesAligned: boolean;
    alignmentScore: number;
    // Volume
    volumeHigh: boolean;
    volumeConfirmed: boolean;
    volumeIncreasing: boolean;
    volumeRatio: number;
    // Indicators
    rsiValue: number;
    rsiInZone: boolean;
    macdBullish: boolean;
    macdAccelerating: boolean;
    emaCrossover: boolean;
    maTrend: string;
    macdTrend: string;
    macdMomentum: string;
    volumeTrend: string;
    rsiDivergence: string;
    // Patterns
    hasStrongPattern: boolean;
    primaryPattern: string | null;
    patternWeight: number;
    // SMC
    hasOrderBlock: boolean;
    hasCHoCH: boolean;
    hasLiquiditySweep: boolean;
    smcConfluenceCount: number;
    // Divergence
    noBearishDivergence: boolean;
    // Fundamentals
    noFTConflict: boolean;
    // Extra
    adxValue: number;
    weeklyTrend: string;
    bollingerSqueeze: boolean;
}

export interface BacktestAnalysisResult {
    recommendation: 'BUY' | 'SELL' | 'HOLD' | 'WAIT';
    confidence: number;
    regime: string;
    entryPrice: number;
    targetPrice: number;
    stopLoss: number;
    riskReward: number;
    conditions: BacktestConditions;
}

// ═══════════════════════════════════════════════════════════════
// NEUTRAL STUBS (skip AI, news, fundamentals)
// ═══════════════════════════════════════════════════════════════

const NEUTRAL_NEWS: EnhancedNewsAnalysis = {
    items: [],
    sentiment: 'neutral',
    sentimentScore: 50,
    impactLevel: 'low',
    latestHeadlines: [],
    dataFreshness: 0,
};

const NEUTRAL_FUNDAMENTALS: FundamentalData = {
    valuation: 'unknown',
    growth: 'unknown',
    metrics: {
        peRatio: null,
        pbRatio: null,
        marketCap: null,
        dividendYield: null,
        eps: null,
        bookValue: null,
    },
    sectorComparison: 'unknown',
};

// ═══════════════════════════════════════════════════════════════
// MAIN FUNCTION
// ═══════════════════════════════════════════════════════════════

/**
 * Run the full analysis pipeline on historical data (backtest mode).
 * Skips: AI, news, fundamentals, sector comparison, market breadth, DB saves, Telegram.
 * Uses: indicators, patterns, SMC, regime, confidence scoring, entry zone, signal composer.
 */
export interface NullReasonCounters {
    insufficientData: number;
    holdRecommendation: number;
    fallbackBadRR: number;
    invalidPrices: number;
    badPriceMath: number;
}

export function runAnalysisOnHistoricalData(
    symbol: string,
    dailyData: OHLCData[],
    weeklyData: OHLCData[],
    nullReasons?: NullReasonCounters,
): BacktestAnalysisResult | null {
    if (dailyData.length < 100) {
        if (nullReasons) nullReasons.insufficientData++;
        return null;
    }

    // Step 1: Full technical analysis (indicators + patterns + SMC)
    const technicalAnalysis = performComprehensiveTechnicalAnalysis({
        daily: dailyData,
        weekly: weeklyData,
        monthly: [], // Skip monthly in backtest
    });

    // Step 2: ADX
    const adxResult = calcADX(dailyData);

    // Step 3: ATR
    const atrCurrent = calcATR(dailyData);
    const atrValues = dailyData.slice(-20).map((_, i, arr) => {
        if (i === 0) return 0;
        const bar = arr[i];
        const prev = arr[i - 1];
        return Math.max(bar.high - bar.low, Math.abs(bar.high - prev.close), Math.abs(bar.low - prev.close));
    }).filter(v => v > 0);
    const atrMean = atrValues.length > 0 ? atrValues.reduce((a, b) => a + b, 0) / atrValues.length : atrCurrent;

    // Step 4: ADX slope for TRANSITION detection
    const adxPrev = dailyData.length > 15
        ? calcADX(dailyData.slice(0, -1)).adx
        : adxResult.adx;

    // Step 5: Bollinger bandwidth + squeeze detection
    const dailyPrices = dailyData.map(d => d.close);
    const bbBandwidth = technicalAnalysis.bollingerBands.bandwidth;
    const bbHistory = dailyData.slice(-120);
    let bbAvgBandwidth = bbBandwidth;
    if (bbHistory.length >= 30) {
        const bbPrices = bbHistory.map(d => d.close);
        const widths: number[] = [];
        for (let j = 20; j <= bbPrices.length; j += 10) {
            const slice = bbPrices.slice(0, j);
            const bb = calcBollingerBands(slice);
            widths.push(bb.bandwidth);
        }
        if (widths.length > 0) {
            bbAvgBandwidth = widths.reduce((a, b) => a + b, 0) / widths.length;
        }
    }

    // Step 6: Regime classification
    const regimeResult = classifyRegime({
        adxValue: adxResult.adx,
        adxPrevValue: adxPrev,
        atrCurrent,
        atrMean,
        volumeRatio: technicalAnalysis.indicators.daily.volume.ratio,
        newsImpact: 'low',
        hasBreakingNews: false,
        alignmentScore: technicalAnalysis.multiTimeframe.alignmentScore || 50,
        bollingerBandwidth: bbBandwidth,
        bollingerAvgBandwidth: bbAvgBandwidth,
    });

    // Step 7: Phase 2 momentum signals
    const dailyVolumes = dailyData.map(d => d.volume);
    const histArray = buildMACDHistogramArray(dailyPrices);
    const macdHistMomentum = macdHistogramMomentum(histArray);
    const volTrend = volumeTrend(dailyVolumes);
    const rsiDiv = detectRSIDivergence(dailyPrices);

    // Step 8: Confidence scoring (split model)
    const confidenceResult = calculateSplitConfidence({
        patterns: technicalAnalysis.patterns.daily,
        news: NEUTRAL_NEWS,
        indicators: technicalAnalysis.indicators.daily,
        fundamentals: NEUTRAL_FUNDAMENTALS,
        weeklyIndicators: technicalAnalysis.indicators.weekly || undefined,
        regime: regimeResult.regime,
        adxValue: adxResult.adx,
        bollingerPercentB: technicalAnalysis.bollingerBands.percentB,
        candlestickComposite: technicalAnalysis.candlestickAnalysis.compositeScore,
        macdHistogramMomentum: macdHistMomentum,
        volumeTrend: volTrend,
        rsiDivergence: rsiDiv,
    });

    // Step 9: Pattern confluence
    const patternConfluence = calculatePatternConfluence({
        '1D': technicalAnalysis.patterns.daily,
        '1W': technicalAnalysis.patterns.weekly || technicalAnalysis.patterns.daily,
        '1M': technicalAnalysis.patterns.daily, // No monthly in backtest
    });

    // Step 10: Fundamental-technical conflict (always none in backtest)
    const ftConflict = detectFundamentalTechnicalConflict(
        {
            bias: confidenceResult.recommendation === 'BUY' ? 'BULLISH' : confidenceResult.recommendation === 'SELL' ? 'BEARISH' : 'NEUTRAL',
            confidenceScore: confidenceResult.score,
            alignmentScore: technicalAnalysis.multiTimeframe.alignmentScore || 50,
            volumeRatio: technicalAnalysis.indicators.daily.volume.ratio,
        },
        NEUTRAL_FUNDAMENTALS
    );

    // Step 11: Signal composer (SMC-based conviction)
    const signalCard = composeSignal({
        ticker: symbol,
        smc: technicalAnalysis.smcAnalysis,
        currentPrice: dailyData[dailyData.length - 1].close,
        atr: technicalAnalysis.indicators.daily.atr,
        adxValue: adxResult.adx,
        volumeRatio: technicalAnalysis.indicators.daily.volume.ratio,
        weeklyTrend: technicalAnalysis.multiTimeframe.timeframes['1W'].trend,
        monthlyTrend: technicalAnalysis.multiTimeframe.timeframes['1M'].trend,
        dailyTrend: technicalAnalysis.multiTimeframe.timeframes['1D'].trend,
        candlestickAnalysis: technicalAnalysis.candlestickAnalysis,
    });

    // Step 12: Apply confidence modifiers (same logic as orchestrator)
    const volumeRatio = technicalAnalysis.indicators.daily.volume.ratio;
    const alignmentScore = technicalAnalysis.multiTimeframe.alignmentScore || 50;
    const volumeGatePassed = volumeRatio >= 1.2;

    // Static modifiers (skip data-derived + market breadth in backtest)
    const volumePenalty = volumeRatio < 1.2 ? -10 : volumeRatio < 1.0 ? -15 : 0;
    const multiTFPenalty = alignmentScore < 40 ? -12 : alignmentScore < 60 ? -6 : 0;
    const adxPenalty = adxResult.adx < 15 ? -10 : adxResult.adx < 20 ? -5 : 0;

    const candlestickBonus = Math.round(technicalAnalysis.candlestickAnalysis.compositeScore * 20);
    let qualityBonus = 0;
    if (volumeRatio >= 1.3 && adxResult.adx >= 25 && alignmentScore >= 70) qualityBonus += 12;
    if (volumeRatio >= 1.5) qualityBonus += 8;

    const negativeMods = [
        Math.min(0, patternConfluence.confidenceModifier),
        Math.min(0, ftConflict.confidenceAdjustment),
        Math.min(0, volumePenalty),
        Math.min(0, multiTFPenalty),
        Math.min(0, adxPenalty),
        Math.min(0, candlestickBonus),
    ];
    const positiveMods = [
        Math.max(0, patternConfluence.confidenceModifier),
        Math.max(0, ftConflict.confidenceAdjustment),
        Math.max(0, volumePenalty),
        Math.max(0, multiTFPenalty),
        Math.max(0, adxPenalty),
        Math.max(0, candlestickBonus),
        qualityBonus,
    ];
    const cappedNegative = Math.max(-15, negativeMods.reduce((a, b) => a + b, 0));
    const totalPositive = positiveMods.reduce((a, b) => a + b, 0);

    const adjustedConfidence = Math.max(15, Math.min(95,
        confidenceResult.score + cappedNegative + totalPositive
    ));

    const rec = confidenceResult.recommendation;
    if (rec !== 'BUY' && rec !== 'SELL') {
        if (nullReasons) nullReasons.holdRecommendation++;
        return null;
    }

    // Step 13: Entry zone from SMC
    const direction = rec === 'BUY' ? 'bullish' as const : 'bearish' as const;
    const entryZone = calculateEntryZone(
        technicalAnalysis.smcAnalysis,
        dailyData[dailyData.length - 1].close,
        atrCurrent,
        direction
    );

    // Fallback entry/target/SL if no SMC zone
    const currentPrice = dailyData[dailyData.length - 1].close;
    let entryPrice: number;
    let targetPrice: number;
    let stopLoss: number;
    let riskReward: number;

    if (entryZone && entryZone.isValid) {
        entryPrice = (entryZone.entryZoneLow + entryZone.entryZoneHigh) / 2;
        targetPrice = entryZone.target1;
        stopLoss = entryZone.stopLoss;
        riskReward = entryZone.riskReward;
    } else {
        // ── ATR FALLBACK ──
        // SMC zone unavailable (no nearby OB/sweep). Use a clean ATR-based
        // structure with a fixed 2:1 R:R. This lets us actually measure the
        // confidence scorer's edge instead of dropping 58% of would-be signals
        // because S/R math can't produce a valid R:R unless price is glued to
        // support/resistance.
        entryPrice = currentPrice;
        const stopDistance = atrCurrent * 1.5;
        const rewardDistance = atrCurrent * 3.0;
        if (rec === 'BUY') {
            stopLoss = Number((entryPrice - stopDistance).toFixed(2));
            targetPrice = Number((entryPrice + rewardDistance).toFixed(2));
        } else {
            stopLoss = Number((entryPrice + stopDistance).toFixed(2));
            targetPrice = Number((entryPrice - rewardDistance).toFixed(2));
        }
        riskReward = 2.0;
    }

    // Validate prices
    if (entryPrice <= 0 || stopLoss <= 0 || targetPrice <= 0) {
        if (nullReasons) nullReasons.invalidPrices++;
        return null;
    }
    if (rec === 'BUY' && (stopLoss >= entryPrice || targetPrice <= entryPrice)) {
        if (nullReasons) nullReasons.badPriceMath++;
        return null;
    }
    if (rec === 'SELL' && (stopLoss <= entryPrice || targetPrice >= entryPrice)) {
        if (nullReasons) nullReasons.badPriceMath++;
        return null;
    }

    // Step 14: Build conditions snapshot
    const weeklyTrend = technicalAnalysis.multiTimeframe.timeframes['1W'].trend;
    const dailyTrend = technicalAnalysis.multiTimeframe.timeframes['1D'].trend;
    const isBuy = rec === 'BUY';

    const conditions: BacktestConditions = {
        regime: regimeResult.regime,
        isStrongTrend: adxResult.adx > 25,
        isTransition: regimeResult.regime === 'TRANSITION',
        weeklyAligned: isBuy ? weeklyTrend === 'bullish' : weeklyTrend === 'bearish',
        allTimeframesAligned: technicalAnalysis.multiTimeframe.alignment === (isBuy ? 'bullish' : 'bearish'),
        alignmentScore,
        volumeHigh: volumeRatio > 1.5,
        volumeConfirmed: volumeGatePassed,
        volumeIncreasing: volTrend === 'increasing',
        volumeRatio,
        rsiValue: technicalAnalysis.indicators.daily.rsi.value,
        rsiInZone: technicalAnalysis.indicators.daily.rsi.value >= 40 && technicalAnalysis.indicators.daily.rsi.value <= 60,
        macdBullish: isBuy
            ? technicalAnalysis.indicators.daily.macd.trend === 'bullish'
            : technicalAnalysis.indicators.daily.macd.trend === 'bearish',
        macdAccelerating: macdHistMomentum === 'accelerating',
        emaCrossover: isBuy
            ? technicalAnalysis.indicators.daily.ma.ema9 > technicalAnalysis.indicators.daily.ma.ema21
            : technicalAnalysis.indicators.daily.ma.ema9 < technicalAnalysis.indicators.daily.ma.ema21,
        maTrend: technicalAnalysis.indicators.daily.ma.trend,
        macdTrend: technicalAnalysis.indicators.daily.macd.trend,
        macdMomentum: macdHistMomentum,
        volumeTrend: volTrend,
        rsiDivergence: rsiDiv,
        hasStrongPattern: (technicalAnalysis.patterns.daily.primary?.confidence ?? 0) >= 0.58,
        primaryPattern: technicalAnalysis.patterns.daily.primary?.name ?? null,
        patternWeight: technicalAnalysis.patterns.daily.primary?.confidence ?? 0,
        hasOrderBlock: signalCard ? signalCard.smcSummary.unmitigatedOBCount > 0 : false,
        hasCHoCH: signalCard ? signalCard.smcSummary.chochDetected : false,
        hasLiquiditySweep: signalCard ? signalCard.smcSummary.sweepDetected : false,
        smcConfluenceCount: signalCard ? [
            signalCard.smcSummary.unmitigatedOBCount > 0,
            signalCard.smcSummary.chochDetected,
            signalCard.smcSummary.sweepDetected,
        ].filter(Boolean).length : 0,
        noBearishDivergence: isBuy ? rsiDiv !== 'bearish' : rsiDiv !== 'bullish',
        noFTConflict: !ftConflict.hasConflict,
        adxValue: adxResult.adx,
        weeklyTrend,
        bollingerSqueeze: regimeResult.regime === 'TRANSITION',
    };

    return {
        recommendation: rec,
        confidence: adjustedConfidence,
        regime: regimeResult.regime,
        entryPrice: Number(entryPrice.toFixed(2)),
        targetPrice: Number(targetPrice.toFixed(2)),
        stopLoss: Number(stopLoss.toFixed(2)),
        riskReward,
        conditions,
    };
}
