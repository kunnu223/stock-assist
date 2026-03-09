/**
 * Single Stock Analysis Orchestrator
 * Coordinates the full analysis pipeline for a single stock
 * Extracted from analyze.ts route handler for single responsibility
 * @module @stock-assist/api/services/analysis/singleAnalysisOrchestrator
 */

import { getStockData } from '../data';
import { fetchEnhancedNews } from '../news/enhanced';
import { fetchFundamentals } from '../data/fundamentals';
import { compareSector } from '../data';
import { performComprehensiveTechnicalAnalysis, getTechnicalSummary, calculateSplitConfidence, calculatePatternConfluence, detectFundamentalTechnicalConflict } from './index';
import { calculateRiskMetrics } from './riskMetrics';
import { classifyRegime } from './regimeClassifier';
import { evaluateSelectivity } from './tradeSelectivity';
import { evaluateExpectancy } from './expectancy';
import { calibrateConfidence } from './calibration';
import { getModifiersForConditions } from './dataDerivedModifiers';
import { getMarketBreadth } from './breadth';
import { buildEnhancedPrompt, buildUserFriendlyPrompt } from '../ai/enhancedPrompt';
import { analyzeWithEnsemble } from '../ai/ensembleAI';
import { calcADX } from '../indicators/adx';
import { calcATR } from '../indicators';
import { formatAmount, formatPercent } from '../../utils/formatting';
import { saveSignal, updateSignalOutcomes, getEmpiricalProbability } from '../backtest/signalTracker';
import { DailyAnalysis } from '../../models';
import { logger } from '../../config/logger';
import { generateFallbackAnalysis, buildDefaultBullishScenario, buildDefaultBearishScenario, formatPatternsWithStars } from './responseBuilder';
import type { StockData } from '@stock-assist/shared';

// ═══════════════════════════════════════════════════════════════
// MAIN ORCHESTRATOR
// ═══════════════════════════════════════════════════════════════

export interface SingleAnalysisResult {
    success: boolean;
    processingTime: string;
    analysis: Record<string, unknown>;
}

/**
 * Run the full single-stock analysis pipeline.
 * This is the core orchestration function extracted from the /single route handler.
 */
export async function analyzeSingleStock(symbol: string, language: string = 'en'): Promise<SingleAnalysisResult> {
    const start = Date.now();

    // Step 1+2: Parallel fetch of data
    logger.info({ symbol }, 'Starting parallel data fetch');
    const [stock, enhancedNews, fundamentals] = await Promise.all([
        getStockData(symbol, 90).then(data => {
            logger.debug({ symbol, bars: data.history.length }, 'Stock data fetched');
            return data;
        }),
        fetchEnhancedNews(symbol).then(res => {
            logger.debug({ symbol, headlines: res.latestHeadlines.length, impact: res.impactLevel }, 'News analysis complete');
            return res;
        }),
        fetchFundamentals(symbol).then(res => {
            logger.debug({ symbol, valuation: res.valuation, growth: res.growth }, 'Fundamentals fetched');
            return res;
        })
    ]);

    // Technical analysis runs synchronously on already-fetched data
    const technicalAnalysis = performComprehensiveTechnicalAnalysis({
        daily: stock.history,
        weekly: stock.timeframes?.weekly || [],
        monthly: stock.timeframes?.monthly || []
    });
    logger.debug({ symbol }, 'Technical analysis complete');

    // ADX trend strength
    const adxResult = calcADX(stock.history);
    logger.debug({ symbol, adx: adxResult.adx, trendStrength: adxResult.trendStrength }, 'ADX calculated');

    // Classify market regime
    const atrValues = stock.history.slice(-20).map((_, i, arr) => {
        if (i === 0) return 0;
        const bar = arr[i];
        const prev = arr[i - 1];
        return Math.max(bar.high - bar.low, Math.abs(bar.high - prev.close), Math.abs(bar.low - prev.close));
    }).filter(v => v > 0);
    const atrCurrent = calcATR(stock.history);
    const atrMean = atrValues.length > 0 ? atrValues.reduce((a, b) => a + b, 0) / atrValues.length : atrCurrent;

    const regimeResult = classifyRegime({
        adxValue: adxResult.adx,
        atrCurrent,
        atrMean,
        volumeRatio: technicalAnalysis.indicators.daily.volume.ratio,
        newsImpact: enhancedNews.impactLevel,
        hasBreakingNews: enhancedNews.breakingNews?.length > 0,
        alignmentScore: technicalAnalysis.multiTimeframe.alignmentScore || 50
    });
    logger.debug({ symbol, regime: regimeResult.regime, confidence: regimeResult.confidence }, 'Regime classified');

    logger.info({ symbol, elapsed: ((Date.now() - start) / 1000).toFixed(1) }, 'Data fetch complete');

    // Step 3: Calculate split confidence
    const confidenceResult = calculateSplitConfidence({
        patterns: technicalAnalysis.patterns.daily,
        news: enhancedNews,
        indicators: technicalAnalysis.indicators.daily,
        fundamentals,
        weeklyIndicators: technicalAnalysis.indicators.weekly || undefined,
        monthlyIndicators: technicalAnalysis.indicators.monthly || undefined,
        regime: regimeResult.regime
    });
    logger.debug({ symbol, score: confidenceResult.score, recommendation: confidenceResult.recommendation, direction: confidenceResult.direction.direction }, 'Confidence calculated');

    // Pattern confluence across timeframes
    const patternConfluence = calculatePatternConfluence({
        '1D': technicalAnalysis.patterns.daily,
        '1W': technicalAnalysis.patterns.weekly || technicalAnalysis.patterns.daily,
        '1M': technicalAnalysis.patterns.monthly || technicalAnalysis.patterns.daily
    });
    logger.debug({ symbol, confluenceScore: patternConfluence.score, agreement: patternConfluence.agreement }, 'Pattern confluence calculated');

    // Fundamental-technical conflicts
    const volumeRatio = technicalAnalysis.indicators.daily.volume.ratio;
    const alignmentScore = technicalAnalysis.multiTimeframe.alignmentScore || 50;

    const ftConflict = detectFundamentalTechnicalConflict(
        {
            bias: confidenceResult.recommendation === 'BUY' ? 'BULLISH' : confidenceResult.recommendation === 'SELL' ? 'BEARISH' : 'NEUTRAL',
            confidenceScore: confidenceResult.score,
            alignmentScore: alignmentScore,
            volumeRatio: volumeRatio
        },
        fundamentals
    );
    logger.debug({ symbol, hasConflict: ftConflict.hasConflict, conflictType: ftConflict.conflictType }, 'FT conflict check done');

    // Sector comparison
    const sectorComparison = await compareSector(stock.symbol, stock.quote.changePercent);
    logger.debug({ symbol, verdict: sectorComparison.verdict, outperformance: sectorComparison.outperformance }, 'Sector comparison done');

    // Condition variables
    const isBullishBreakout = confidenceResult.recommendation === 'BUY' && stock.quote.changePercent > 1;
    const isBearishBreakout = confidenceResult.recommendation === 'SELL' && stock.quote.changePercent < -1;
    const volumeGatePassed = volumeRatio >= 1.2;

    // Data-derived modifiers
    const derivedMods = await getModifiersForConditions(volumeRatio, alignmentScore, adxResult.adx);
    const volumePenaltyFinal = (isBullishBreakout || isBearishBreakout) && volumeRatio < 1.5
        ? -10 : derivedMods.volumeModifier;
    const multiTFPenalty = derivedMods.multiTFModifier;
    const adxPenalty = derivedMods.adxModifier;
    logger.debug({ symbol, source: derivedMods.source, vol: volumePenaltyFinal, mtf: multiTFPenalty, adx: adxPenalty }, 'Modifiers calculated');

    // Market breadth modifier
    const breadth = await getMarketBreadth();
    const breadthModifier = confidenceResult.direction.direction === 'BULLISH' ? breadth.modifier : 0;
    if (breadthModifier !== 0) {
        logger.debug({ symbol, zone: breadth.zone, breadth: breadth.breadth, modifier: breadthModifier }, 'Breadth modifier applied');
    }

    // Calculate adjusted confidence with ALL gates + data-derived modifiers
    const baseConfidence = confidenceResult.score;
    const adjustedConfidence = Math.max(15, Math.min(95,
        baseConfidence +
        patternConfluence.confidenceModifier +
        ftConflict.confidenceAdjustment +
        sectorComparison.confidenceModifier +
        volumePenaltyFinal +
        multiTFPenalty +
        adxPenalty +
        breadthModifier
    ));
    logger.info({ symbol, base: baseConfidence, adjusted: adjustedConfidence }, 'Confidence adjusted');

    // Trade selectivity filter
    const ftSeverity = ftConflict.hasConflict
        ? (Math.abs(ftConflict.confidenceAdjustment) >= 10 ? 'high' as const
            : Math.abs(ftConflict.confidenceAdjustment) >= 5 ? 'medium' as const
                : 'low' as const)
        : 'none' as const;

    const selectivity = evaluateSelectivity({
        adx: adxResult.adx,
        adxHistory: adxResult.adxHistory,
        alignmentScore,
        volumeRatio,
        ftConflictSeverity: ftSeverity,
        macdDivergence: technicalAnalysis.indicators.daily.macd.divergence,
        currentPrice: stock.quote.price,
        vwap: technicalAnalysis.indicators.daily.vwap
    });
    logger.debug({ symbol, passed: selectivity.passed, gates: `${selectivity.passedCount}/${selectivity.totalGates}`, reason: selectivity.reason }, 'Selectivity evaluated');

    // Risk metrics
    const direction = confidenceResult.recommendation === 'BUY' ? 'bullish' : confidenceResult.recommendation === 'SELL' ? 'bearish' : 'neutral';
    const riskMetrics = calculateRiskMetrics(
        stock.history,
        technicalAnalysis.indicators.daily,
        adjustedConfidence,
        direction
    );
    logger.debug({ symbol, expectedReturn: riskMetrics.expectedReturn, sharpe: riskMetrics.sharpeRatio }, 'Risk metrics calculated');

    // Empirical probability lookup
    const empiricalProb = await getEmpiricalProbability(
        regimeResult.regime,
        alignmentScore,
        adxResult.adx,
        volumeRatio
    );
    logger.debug({ symbol, available: empiricalProb.available, message: empiricalProb.message }, 'Empirical probability looked up');

    // Expectancy filter
    const expectancyResult = evaluateExpectancy(empiricalProb);
    logger.debug({ symbol, accepted: expectancyResult.accepted, reason: expectancyResult.reason }, 'Expectancy evaluated');

    // Confidence calibration
    const calibration = await calibrateConfidence(adjustedConfidence);
    if (calibration.wasCalibratable) {
        logger.debug({ symbol, original: adjustedConfidence, calibrated: calibration.calibrated, delta: calibration.delta, bucket: calibration.bucketUsed }, 'Confidence calibrated');
    }

    // Breaking news override
    let breakingNewsOverride = false;
    if (enhancedNews.breakingImpact === 'HIGH' && enhancedNews.breakingNews.length > 0) {
        const negativeBreaking = enhancedNews.breakingNews.some((n: Record<string, unknown>) => n.sentiment === 'negative');
        if (negativeBreaking) {
            breakingNewsOverride = true;
            logger.warn({ symbol }, 'Breaking negative news detected — capping bullish probability');
        }
    }

    // Generate technical summary for AI
    const technicalSummary = getTechnicalSummary(technicalAnalysis);

    // Build enhanced prompt and get AI analysis via ENSEMBLE
    const promptInput = {
        stock,
        indicators: technicalAnalysis.indicators.daily,
        patterns: technicalAnalysis.patterns.daily,
        news: enhancedNews,
        fundamentals,
        technicalSummary,
        confidenceResult,
        weeklyIndicators: technicalAnalysis.indicators.weekly || undefined,
        monthlyIndicators: technicalAnalysis.indicators.monthly || undefined,
        weeklyPatterns: technicalAnalysis.patterns.weekly || undefined,
        monthlyPatterns: technicalAnalysis.patterns.monthly || undefined,
        patternConfluence,
        ftConflict,
        sectorComparison,
        multiTimeframe: technicalAnalysis.multiTimeframe,
        language
    };
    const enhancedPrompt = buildEnhancedPrompt(promptInput);

    // Ensemble AI analysis
    const ensembleResult = await analyzeWithEnsemble(
        { stock, indicators: technicalAnalysis.indicators.daily, patterns: technicalAnalysis.patterns.daily, news: enhancedNews as any, language },
        adjustedConfidence
    );
    let aiAnalysis: Record<string, any> = ensembleResult?.analysis || {};

    // Fallback if AI fails
    if (!ensembleResult?.analysis) {
        logger.warn({ symbol }, 'AI analysis failed, using system confidence');
        aiAnalysis = generateFallbackAnalysis(stock, confidenceResult, technicalAnalysis, fundamentals);
    } else {
        // Validate recommendation format
        if (typeof aiAnalysis.recommendation === 'object') {
            logger.warn({ symbol }, 'AI returned object for recommendation — extracting');
            const recObj = aiAnalysis.recommendation as Record<string, string>;
            aiAnalysis.recommendation = recObj.trade || recObj.action || recObj.signal || confidenceResult.recommendation;
        }
        if (typeof aiAnalysis.confidenceScore === 'object') {
            const confObj = aiAnalysis.confidenceScore as Record<string, number>;
            aiAnalysis.confidenceScore = confObj.score || confObj.confidence || adjustedConfidence;
        }
        if (typeof aiAnalysis.bias === 'object') {
            const biasObj = aiAnalysis.bias as Record<string, string>;
            aiAnalysis.bias = biasObj.bias || biasObj.trend || (confidenceResult.recommendation === 'BUY' ? 'BULLISH' : 'BEARISH');
        }
        if (typeof aiAnalysis.timeframe === 'object') {
            aiAnalysis.timeframe = 'swing';
        }
    }

    // Calculate dynamic probabilities
    const sr = technicalAnalysis.indicators.daily.sr;
    let bullishProb: number;
    let bearishProb: number;
    if (confidenceResult.recommendation === 'BUY') {
        bullishProb = adjustedConfidence;
        bearishProb = 100 - bullishProb;
    } else if (confidenceResult.recommendation === 'SELL') {
        bearishProb = adjustedConfidence;
        bullishProb = 100 - bearishProb;
    } else {
        const techScore = confidenceResult.breakdown.technicalAlignment;
        bullishProb = Math.round(Math.max(15, Math.min(85, techScore)));
        bearishProb = 100 - bullishProb;
    }

    const defaultBullish = buildDefaultBullishScenario(stock, sr, bullishProb, confidenceResult.breakdown.technicalAlignment);
    const defaultBearish = buildDefaultBearishScenario(stock, sr, bearishProb, confidenceResult.breakdown.technicalAlignment);

    // Build response
    const response: SingleAnalysisResult = {
        success: true,
        processingTime: `${((Date.now() - start) / 1000).toFixed(1)}s`,
        analysis: {
            stock: stock.symbol,
            currentPrice: formatAmount(stock.quote.price),
            recommendation: aiAnalysis.recommendation || confidenceResult.recommendation,
            confidenceScore: adjustedConfidence,
            timeframe: aiAnalysis.timeframe || 'swing',

            highlights: {
                badge: patternConfluence.score > 80 ? '🎯 MULTI-TIMEFRAME CONFLUENCE' : undefined,
                primaryFactor: patternConfluence.score > 75
                    ? `Multi-timeframe pattern agreement (${patternConfluence.bullishTimeframes.join(' + ')})`
                    : sectorComparison.verdict === 'STRONG_OUTPERFORMER'
                        ? 'Sector Outperformance'
                        : fundamentals.valuation !== 'overvalued' && confidenceResult.score > 70
                            ? 'Undervalued with technical strength'
                            : 'Technical alignment',
                supportingFactors: [
                    fundamentals.valuation !== 'overvalued' ? `Valuation: ${fundamentals.valuation} (PE ${fundamentals.metrics.peRatio})` : null,
                    enhancedNews.sentiment === 'positive' ? 'Positive News Sentiment' : null,
                    (sectorComparison.outperformance !== null && sectorComparison.outperformance > 0) ? `Sector Outperformance (+${sectorComparison.outperformance.toFixed(1)}%)` : null
                ].filter(Boolean)
            },

            accuracyMetrics: {
                baseConfidence: confidenceResult.score,
                adjustedConfidence,
                modifiers: {
                    patternConfluence: patternConfluence.confidenceModifier,
                    fundamentalTechnical: ftConflict.confidenceAdjustment,
                    sectorComparison: sectorComparison.confidenceModifier,
                    volumeGate: volumePenaltyFinal,
                    multiTimeframeGate: multiTFPenalty,
                    adxFilter: adxPenalty,
                    breadth: breadthModifier,
                    modifierSource: derivedMods.source,
                },
                qualityGates: {
                    volumeValidated: volumeGatePassed,
                    volumeRatio: Number(volumeRatio.toFixed(2)),
                    multiTimeframeAligned: alignmentScore >= 65,
                    alignedTimeframes: alignmentScore,
                    adxTrendStrength: adxResult.trendStrength,
                    adxValue: adxResult.adx,
                    adxDirection: adxResult.trendDirection
                },
                ensemble: {
                    role: 'qualitative-only',
                    modelUsed: ensembleResult?.modelUsed || 'fallback',
                    agreement: ensembleResult?.agreement || 'N/A'
                },
                patternConfluence: {
                    score: patternConfluence.score,
                    agreement: patternConfluence.agreement,
                    conflicts: patternConfluence.conflicts
                },
                sectorComparison: {
                    verdict: sectorComparison.verdict,
                    outperformance: sectorComparison.outperformance,
                    recommendation: sectorComparison.recommendation
                },
                fundamentalTechnical: {
                    hasConflict: ftConflict.hasConflict,
                    conflictType: ftConflict.conflictType,
                    recommendation: ftConflict.recommendation
                },
                regime: {
                    type: regimeResult.regime,
                    confidence: regimeResult.confidence,
                    description: regimeResult.description,
                    weights: regimeResult.weights
                },
                marketBreadth: {
                    breadth: breadth.breadth,
                    zone: breadth.zone,
                    modifier: breadthModifier,
                    description: breadth.description,
                },
                selectivity: {
                    passed: selectivity.passed,
                    reason: selectivity.reason,
                    rejectedBy: selectivity.rejectedBy,
                    passedCount: selectivity.passedCount,
                    totalGates: selectivity.totalGates,
                    gates: selectivity.gateResults
                },
                breakingNews: {
                    count: enhancedNews.breakingNews.length,
                    impact: enhancedNews.breakingImpact,
                    override: breakingNewsOverride
                },
                empirical: {
                    available: empiricalProb.available,
                    conditionHash: empiricalProb.conditionHash,
                    conditionLabel: empiricalProb.conditionLabel,
                    sampleSize: empiricalProb.sampleSize,
                    winRate: empiricalProb.winRate,
                    expectancy: empiricalProb.expectancy,
                    reliable: empiricalProb.reliable,
                    message: empiricalProb.message,
                },
                directionModel: {
                    direction: confidenceResult.direction.direction,
                    conviction: confidenceResult.direction.conviction,
                    bullishSignals: confidenceResult.direction.bullishSignals,
                    bearishSignals: confidenceResult.direction.bearishSignals,
                    signalDetails: confidenceResult.direction.signalDetails,
                },
                strengthModel: {
                    strength: confidenceResult.strength.strength,
                    regime: confidenceResult.strength.regime,
                },
                expectancyFilter: {
                    accepted: expectancyResult.accepted,
                    expectancy: expectancyResult.expectancy,
                    riskRewardRatio: expectancyResult.riskRewardRatio,
                    dataReliable: expectancyResult.dataReliable,
                    reason: expectancyResult.reason,
                },
                calibration: {
                    original: calibration.original,
                    calibrated: calibration.calibrated,
                    delta: calibration.delta,
                    bucketUsed: calibration.bucketUsed,
                    wasCalibratable: calibration.wasCalibratable,
                }
            },

            technicalPatterns: {
                '1D': formatPatternsWithStars(technicalAnalysis.multiTimeframe.timeframes['1D']),
                '1W': formatPatternsWithStars(technicalAnalysis.multiTimeframe.timeframes['1W']),
                '1M': formatPatternsWithStars(technicalAnalysis.multiTimeframe.timeframes['1M']),
                alignment: technicalAnalysis.multiTimeframe.alignment
            },
            indicators: {
                RSI: formatAmount(technicalAnalysis.indicators.daily.rsi.value),
                RSIInterpretation: technicalAnalysis.indicators.daily.rsi.interpretation,
                MACD: technicalAnalysis.indicators.daily.macd.trend,
                volumeTrend: technicalAnalysis.indicators.daily.volume.trend,
                bollingerPosition: technicalAnalysis.bollingerBands.position
            },
            news: {
                sentiment: enhancedNews.sentiment,
                sentimentScore: enhancedNews.sentimentScore,
                latestHeadlines: enhancedNews.latestHeadlines.slice(0, 3),
                impactLevel: enhancedNews.impactLevel
            },
            fundamentals: {
                valuation: fundamentals.valuation,
                growth: fundamentals.growth,
                peRatio: formatAmount(fundamentals.metrics.peRatio)
            },
            candlestickPatterns: technicalAnalysis.candlestickPatterns,
            priceTargets: aiAnalysis.priceTargets ? {
                ...aiAnalysis.priceTargets,
                entry: formatAmount(aiAnalysis.priceTargets.entry),
                target1: formatAmount(aiAnalysis.priceTargets.target1),
                target2: formatAmount(aiAnalysis.priceTargets.target2),
                stopLoss: formatAmount(aiAnalysis.priceTargets.stopLoss),
                riskReward: formatAmount(aiAnalysis.priceTargets.riskReward)
            } : {
                entry: formatAmount(stock.quote.price),
                target1: formatAmount(sr.resistance),
                target2: formatAmount(sr.resistance * 1.05),
                stopLoss: formatAmount(sr.support),
                riskReward: 1.5
            },
            risks: aiAnalysis.risks || ['Market volatility', 'Sector rotation', 'Global economic factors'],
            reasoning: aiAnalysis.reasoning || `Based on ${technicalAnalysis.multiTimeframe.alignment} multi-timeframe alignment and ${confidenceResult.score}% confidence score`,
            validUntil: new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString(),
            confidenceBreakdown: confidenceResult.breakdown,
            bias: aiAnalysis.bias || (confidenceResult.recommendation === 'BUY' ? 'BULLISH' : confidenceResult.recommendation === 'SELL' ? 'BEARISH' : 'NEUTRAL'),
            confidence: adjustedConfidence > 70 ? 'HIGH' : adjustedConfidence > 50 ? 'MEDIUM' : 'LOW',
            category: adjustedConfidence > 65 && (confidenceResult.recommendation === 'BUY' || confidenceResult.recommendation === 'SELL')
                ? 'STRONG_SETUP'
                : adjustedConfidence < 40
                    ? 'AVOID'
                    : 'NEUTRAL',
            bullish: aiAnalysis.bullish || defaultBullish,
            bearish: aiAnalysis.bearish || defaultBearish,

            riskMetrics: {
                expectedReturn: riskMetrics.expectedReturn,
                sharpeRatio: riskMetrics.sharpeRatio,
                maxDrawdown: riskMetrics.maxDrawdown,
                volatility: riskMetrics.volatility,
                riskRewardRatio: riskMetrics.riskRewardRatio,
                winRate: riskMetrics.winRate
            },

            rawPrompt: buildUserFriendlyPrompt(promptInput)
        }
    };

    // Apply breaking news override
    const analysis = response.analysis as Record<string, any>;
    if (breakingNewsOverride && analysis.bullish && (analysis.bullish as Record<string, any>).probability > 45) {
        logger.info({ symbol, from: (analysis.bullish as Record<string, any>).probability, to: 45 }, 'Applying probability cap due to negative breaking news');
        (analysis.bullish as Record<string, any>).probability = 45;
        if (analysis.recommendation === 'BUY') {
            analysis.recommendation = 'HOLD';
            analysis.bias = 'NEUTRAL';
        }
    }

    // Trade selectivity override
    if (!selectivity.passed && (analysis.recommendation === 'BUY' || analysis.recommendation === 'SELL')) {
        logger.info({ symbol, reason: selectivity.reason }, 'Selectivity rejected — downgrading to HOLD');
        analysis.recommendation = 'HOLD';
        analysis.category = 'NEUTRAL';
        analysis.reasoning = analysis.reasoning +
            ` ⚠️ Trade rejected by selectivity filter: ${selectivity.reason}`;
    }

    // Expectancy filter override
    if (!expectancyResult.accepted && (analysis.recommendation === 'BUY' || analysis.recommendation === 'SELL')) {
        logger.info({ symbol, expectancy: expectancyResult.expectancy, reason: expectancyResult.reason }, 'Expectancy rejected — downgrading to HOLD');
        analysis.recommendation = 'HOLD';
        analysis.category = 'NEUTRAL';
        analysis.reasoning = analysis.reasoning +
            ` ⚠️ Trade rejected by expectancy filter: Expectancy ${expectancyResult.expectancy.toFixed(3)}% (negative). Win rate ${expectancyResult.winRate}% is misleading.`;
    }

    logger.info({ symbol, processingTime: response.processingTime }, 'Enhanced analysis complete');

    // Store in DailyAnalysis History (fire-and-forget)
    DailyAnalysis.findOneAndUpdate(
        { symbol, date: (() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; })() },
        {
            symbol,
            date: (() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; })(),
            confidenceScore: adjustedConfidence,
            bullishProb: (analysis.bullish as Record<string, any>)?.probability || 0,
            bearishProb: (analysis.bearish as Record<string, any>)?.probability || 0,
            analysis: analysis
        },
        { upsert: true, new: true }
    ).then(() => logger.debug({ symbol }, 'Daily analysis history updated'))
        .catch((err: unknown) => logger.warn({ symbol, err }, 'Failed to save daily analysis'));

    // Signal tracking — fire-and-forget
    const rec = analysis.recommendation;
    if (rec === 'BUY' || rec === 'SELL') {
        const srLevels = technicalAnalysis.indicators.daily.sr;
        const signalEntry = stock.quote.price;
        const signalTarget = rec === 'BUY' ? srLevels.resistance : srLevels.support;
        const signalSL = rec === 'BUY' ? srLevels.support : srLevels.resistance;

        const adxRegimeStr = adxResult.adx >= 25 ? 'strong' as const : adxResult.adx >= 15 ? 'weak' as const : 'choppy' as const;

        Promise.all([
            saveSignal({
                symbol,
                direction: rec,
                confidence: adjustedConfidence,
                baseConfidence: confidenceResult.score,
                adxValue: adxResult.adx,
                adxRegime: adxRegimeStr,
                volumeRatio: technicalAnalysis.indicators.daily.volume.ratio,
                volumeConfirmed: volumeGatePassed,
                alignmentScore,
                patternType: technicalAnalysis.patterns.daily?.primary?.name || null,
                patternConfluence: patternConfluence.score,
                sectorStrength: sectorComparison.verdict || 'unknown',
                sectorModifier: sectorComparison.confidenceModifier,
                rsiValue: technicalAnalysis.indicators.daily.rsi.value,
                fundamentalConflict: ftConflict.hasConflict,
                ftModifier: ftConflict.confidenceAdjustment,
                regime: regimeResult.regime,
                modifiers: {
                    volume: volumePenaltyFinal,
                    multiTF: multiTFPenalty,
                    adx: adxPenalty,
                    confluence: patternConfluence.confidenceModifier,
                    ft: ftConflict.confidenceAdjustment,
                    sector: sectorComparison.confidenceModifier,
                },
                entryPrice: signalEntry,
                targetPrice: signalTarget,
                stopLoss: signalSL,
            }),
            updateSignalOutcomes(symbol, stock.history)
        ]).catch((err: unknown) => logger.error({ err }, 'SignalTracker error'));
    }

    return response;
}
