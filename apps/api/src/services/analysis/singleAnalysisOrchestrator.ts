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
import { composeSignal } from './signalComposer';
import { calculateRiskMetrics } from './riskMetrics';
import { classifyRegime } from './regimeClassifier';
import { evaluateSelectivity } from './tradeSelectivity';
import { evaluateExpectancy } from './expectancy';
import { calibrateConfidence } from './calibration';
import { getModifiersForConditions } from './dataDerivedModifiers';
import { getMarketBreadth } from './breadth';
import { buildUserFriendlyPrompt } from '../ai/enhancedPrompt';
import { analyzeWithEnsemble } from '../ai/ensembleAI';
import { calcADX } from '../indicators/adx';
import { calcATR } from '../indicators';
import { formatAmount } from '../../utils/formatting';
import { saveSignal, updateSignalOutcomes, getEmpiricalProbability } from '../backtest/signalTracker';
import { DailyAnalysis } from '../../models';
import { logger } from '../../config/logger';
import { generateFallbackAnalysis, buildDefaultBullishScenario, buildDefaultBearishScenario, formatPatternsWithStars } from './responseBuilder';


// ═══════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════

/**
 * Sanitize AI-returned scenario (bullish/bearish) trade plan values.
 * AI models often return nonsensical values like stopLoss=100 (flat number)
 * or hardcoded target probabilities (60%/30%). This function validates and
 * replaces bad values with system-calculated ones from S/R levels and ATR.
 */
function sanitizeScenario(
    scenario: Record<string, any>,
    type: 'bullish' | 'bearish',
    currentPrice: number,
    sr: { support: number; resistance: number; s1: number; r1: number },
    atr: number,
    probability: number,
    adjustedConfidence: number,
): Record<string, any> {
    if (!scenario || !scenario.tradePlan) return scenario;

    const plan = { ...scenario.tradePlan };
    const priceFloor = currentPrice * 0.70; // 30% below — any SL below this is nonsense
    const priceCeil = currentPrice * 1.30;  // 30% above

    // ── Stop Loss validation ──
    const rawSL = typeof plan.stopLoss === 'string' ? parseFloat(plan.stopLoss) : plan.stopLoss;
    const slIsInvalid = !rawSL || isNaN(rawSL) || rawSL < priceFloor || rawSL > priceCeil
        || (type === 'bullish' && rawSL >= currentPrice)   // Bullish SL must be below price
        || (type === 'bearish' && rawSL <= currentPrice);  // Bearish SL must be above price

    if (slIsInvalid) {
        if (type === 'bullish') {
            // SL at support - 0.5×ATR buffer
            plan.stopLoss = Number((sr.support - atr * 0.5).toFixed(2));
        } else {
            // SL at resistance + 0.5×ATR buffer
            plan.stopLoss = Number((sr.resistance + atr * 0.5).toFixed(2));
        }
        plan.stopLossPercent = Number((Math.abs(currentPrice - plan.stopLoss) / currentPrice * 100).toFixed(1));
    }

    // ── Entry validation ──
    if (plan.entry) {
        const entries = Array.isArray(plan.entry) ? plan.entry : [plan.entry];
        const validEntries = entries.map((e: any) => {
            const val = typeof e === 'string' ? parseFloat(e) : e;
            if (!val || isNaN(val) || val < priceFloor || val > priceCeil) return currentPrice;
            return val;
        });
        plan.entry = validEntries;
    }

    // ── Target validation & dynamic probabilities ──
    if (plan.targets && Array.isArray(plan.targets)) {
        // Validate target prices are within reasonable range
        plan.targets = plan.targets.map((t: any, idx: number) => {
            const price = typeof t.price === 'string' ? parseFloat(t.price) : t.price;
            let validPrice = price;

            if (!price || isNaN(price) || price < priceFloor || price > priceCeil) {
                // Replace with system-calculated targets
                if (type === 'bullish') {
                    validPrice = idx === 0 ? sr.resistance : sr.r1 || sr.resistance * 1.05;
                } else {
                    validPrice = idx === 0 ? sr.support : sr.s1 || sr.support * 0.95;
                }
            }

            return { ...t, price: Number(validPrice.toFixed(2)) };
        });

        // Dynamic target probabilities based on system confidence + direction
        // Higher confidence = higher T1 probability, lower T2 (more decisive)
        // Direction alignment affects the spread
        const confFactor = adjustedConfidence / 100; // 0.0–1.0
        if (type === 'bullish') {
            const t1Prob = Math.round(Math.min(85, 50 + probability * 0.4 + confFactor * 10));
            const t2Prob = Math.round(Math.max(15, t1Prob - 25 - (1 - confFactor) * 10));
            plan.targets = plan.targets.map((t: any, idx: number) => ({
                ...t,
                probability: idx === 0 ? t1Prob : t2Prob,
            }));
        } else {
            const t1Prob = Math.round(Math.min(85, 50 + probability * 0.4 + confFactor * 10));
            const t2Prob = Math.round(Math.max(15, t1Prob - 25 - (1 - confFactor) * 10));
            plan.targets = plan.targets.map((t: any, idx: number) => ({
                ...t,
                probability: idx === 0 ? t1Prob : t2Prob,
            }));
        }
    }

    // ── Risk:Reward recalculation ──
    const slValue = typeof plan.stopLoss === 'string' ? parseFloat(plan.stopLoss) : plan.stopLoss;
    if (plan.targets && plan.targets.length > 0 && slValue) {
        const t1Price = typeof plan.targets[0].price === 'string' ? parseFloat(plan.targets[0].price) : plan.targets[0].price;
        const risk = Math.abs(currentPrice - slValue);
        const reward = Math.abs(t1Price - currentPrice);
        plan.riskReward = risk > 0 ? Number((reward / risk).toFixed(2)) : 0;
    }

    return { ...scenario, tradePlan: plan };
}

/**
 * Determine final recommendation. System direction model takes priority —
 * it uses weighted technical signals. AI recommendation is only used when
 * the system says HOLD (uncertain) and the AI has a clear directional call.
 */
function sanitizeRecommendation(
    aiRecommendation: string | undefined,
    systemRecommendation: string
): 'BUY' | 'SELL' | 'HOLD' | 'WAIT' {
    const sys = systemRecommendation.toUpperCase().trim() as 'BUY' | 'SELL' | 'HOLD' | 'WAIT';

    // System has a clear directional call → use it (it's based on weighted technical signals)
    if (sys === 'BUY' || sys === 'SELL' || sys === 'WAIT') {
        return sys;
    }

    // System says HOLD → check if AI has a clear directional call
    const raw = (aiRecommendation || '').toUpperCase().trim();
    if (raw === 'BUY' || raw.startsWith('BUY') || raw.includes('BUY ON') || raw.includes('BUY AT')) return 'BUY';
    if (raw === 'SELL' || raw.startsWith('SELL') || raw.includes('SELL AT') || raw.includes('SHORT')) return 'SELL';

    return 'HOLD';
}

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

    // Step 3: Calculate split confidence (v5: pass additional context for richer scoring)
    const confidenceResult = calculateSplitConfidence({
        patterns: technicalAnalysis.patterns.daily,
        news: enhancedNews,
        indicators: technicalAnalysis.indicators.daily,
        fundamentals,
        weeklyIndicators: technicalAnalysis.indicators.weekly || undefined,
        monthlyIndicators: technicalAnalysis.indicators.monthly || undefined,
        regime: regimeResult.regime,
        adxValue: adxResult.adx,
        bollingerPercentB: technicalAnalysis.bollingerBands.percentB,
        candlestickComposite: technicalAnalysis.candlestickAnalysis.compositeScore,
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
    const derivedMods = await getModifiersForConditions(volumeRatio, alignmentScore, adxResult.adx, confidenceResult.direction.direction);
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

    // Candlestick pattern bonus (±20 points max — v5: increased from ±8)
    const candlestickBonus = Math.round(technicalAnalysis.candlestickAnalysis.compositeScore * 20);
    if (candlestickBonus !== 0) {
        logger.debug({ symbol, bias: technicalAnalysis.candlestickAnalysis.dominantBias, composite: technicalAnalysis.candlestickAnalysis.compositeScore, bonus: candlestickBonus }, 'Candlestick bonus applied');
    }

    let qualityBonus = 0;
    if (volumeRatio >= 1.3 && adxResult.adx >= 25 && alignmentScore >= 70) {
        qualityBonus += 12;
        logger.debug({ symbol }, 'Quality bonus: strong volume + ADX + alignment (+12)');
    }
    if (volumeRatio >= 1.5 && (confidenceResult.direction.direction === 'BULLISH' || confidenceResult.direction.direction === 'BEARISH')) {
        qualityBonus += 8;
        logger.debug({ symbol }, 'Quality bonus: high volume with clear direction (+8)');
    }
    if (sectorComparison.verdict === 'STRONG_OUTPERFORMER' && confidenceResult.score >= 60) {
        qualityBonus += 6;
        logger.debug({ symbol }, 'Quality bonus: sector outperformer + strong score (+6)');
    }

    // Phase 1: Signal Card (additive — does not affect existing pipeline)
    const signalCard = composeSignal({
        ticker: symbol,
        smc: technicalAnalysis.smcAnalysis,
        currentPrice: stock.quote.price,
        atr: technicalAnalysis.indicators.daily.atr,
        adxValue: adxResult.adx,
        volumeRatio,
        weeklyTrend: technicalAnalysis.multiTimeframe.timeframes['1W'].trend,
        monthlyTrend: technicalAnalysis.multiTimeframe.timeframes['1M'].trend,
        dailyTrend: technicalAnalysis.multiTimeframe.timeframes['1D'].trend,
        candlestickAnalysis: technicalAnalysis.candlestickAnalysis,
    });
    logger.info({ symbol, status: signalCard.status, conviction: signalCard.convictionScore, direction: signalCard.direction }, 'Signal card composed');

    // Calculate adjusted confidence with ALL gates + data-derived modifiers + v5 quality bonus
    const baseConfidence = confidenceResult.score;

    // Cap total negative modifiers at -15
    const negativeMods = [
        Math.min(0, patternConfluence.confidenceModifier),
        Math.min(0, ftConflict.confidenceAdjustment),
        Math.min(0, sectorComparison.confidenceModifier),
        Math.min(0, volumePenaltyFinal),
        Math.min(0, multiTFPenalty),
        Math.min(0, adxPenalty),
        Math.min(0, breadthModifier),
        Math.min(0, candlestickBonus),
    ];
    const positiveMods = [
        Math.max(0, patternConfluence.confidenceModifier),
        Math.max(0, ftConflict.confidenceAdjustment),
        Math.max(0, sectorComparison.confidenceModifier),
        Math.max(0, volumePenaltyFinal),
        Math.max(0, multiTFPenalty),
        Math.max(0, adxPenalty),
        Math.max(0, breadthModifier),
        Math.max(0, candlestickBonus),
        qualityBonus,
    ];
    const totalNegative = negativeMods.reduce((a, b) => a + b, 0);
    const totalPositive = positiveMods.reduce((a, b) => a + b, 0);
    const cappedNegative = Math.max(-15, totalNegative); // Cap at -15 max penalty

    const adjustedConfidence = Math.max(15, Math.min(95,
        baseConfidence + cappedNegative + totalPositive
    ));
    logger.info({ symbol, base: baseConfidence, adjusted: adjustedConfidence, qualityBonus, totalNegative, cappedNegative, totalPositive }, 'Confidence adjusted');

    // Invert chart alignment for display when direction is bearish
    const directionForDisplay = confidenceResult.direction.direction;
    if (directionForDisplay === 'BEARISH' && confidenceResult.breakdown.technicalAlignment < 40) {
        confidenceResult.breakdown.technicalAlignment = 100 - confidenceResult.breakdown.technicalAlignment;
    }

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
        const negativeBreaking = enhancedNews.breakingNews.some((n: any) => n.sentiment === 'negative');
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
        language,
        // v6: pass all computed data to prompts
        smcAnalysis: technicalAnalysis.smcAnalysis,
        signalCard,
        candlestickAnalysis: technicalAnalysis.candlestickAnalysis,
        bollingerBands: technicalAnalysis.bollingerBands,
        regime: regimeResult,
        atr: atrCurrent,
    };

    // Ensemble AI analysis — pass all available data so AI has full picture
    const ensembleResult = await analyzeWithEnsemble(
        {
            stock,
            indicators: technicalAnalysis.indicators.daily,
            patterns: technicalAnalysis.patterns.daily,
            news: enhancedNews as any,
            weeklyIndicators: technicalAnalysis.indicators.weekly || undefined,
            monthlyIndicators: technicalAnalysis.indicators.monthly || undefined,
            language,
            // Extra context for the prompt
            patternConfluence,
            fundamentals,
            sectorComparison,
            multiTimeframe: technicalAnalysis.multiTimeframe,
            adx: adxResult,
            systemDirection: confidenceResult.direction,
            // v6: pass all computed data to AI prompt
            smcAnalysis: technicalAnalysis.smcAnalysis,
            signalCard,
            candlestickAnalysis: technicalAnalysis.candlestickAnalysis,
            bollingerBands: technicalAnalysis.bollingerBands,
            regime: regimeResult,
            atr: atrCurrent,
        },
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
        bullishProb = Math.max(55, adjustedConfidence);
        bearishProb = 100 - bullishProb;
    } else if (confidenceResult.recommendation === 'SELL') {
        bearishProb = Math.max(55, adjustedConfidence);
        bullishProb = 100 - bearishProb;
    } else {
        // For HOLD/WAIT: use direction model to determine lean
        const dirModel = confidenceResult.direction;
        if (dirModel.direction === 'BULLISH') {
            // System leans bullish — scale by conviction (50-85 range)
            bullishProb = Math.round(Math.max(50, Math.min(85, 50 + dirModel.conviction * 0.35)));
            bearishProb = 100 - bullishProb;
        } else if (dirModel.direction === 'BEARISH') {
            bearishProb = Math.round(Math.max(50, Math.min(85, 50 + dirModel.conviction * 0.35)));
            bullishProb = 100 - bearishProb;
        } else {
            // Truly neutral — use adjusted confidence as a mild lean
            const techScore = adjustedConfidence;
            bullishProb = Math.round(Math.max(35, Math.min(65, techScore)));
            bearishProb = 100 - bullishProb;
        }
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

            // AI sometimes returns full sentences like "WAIT FOR CLARITY DUE TO..."
            recommendation: sanitizeRecommendation(aiAnalysis.recommendation, confidenceResult.recommendation),
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
                    candlestickBonus,
                    qualityBonus,
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
            candlestickAnalysis: {
                patterns: technicalAnalysis.candlestickAnalysis.patterns,
                bullishCount: technicalAnalysis.candlestickAnalysis.bullishCount,
                bearishCount: technicalAnalysis.candlestickAnalysis.bearishCount,
                dominantBias: technicalAnalysis.candlestickAnalysis.dominantBias,
                compositeScore: technicalAnalysis.candlestickAnalysis.compositeScore,
                summary: technicalAnalysis.candlestickAnalysis.summary,
            },
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
            confidence: adjustedConfidence > 75 ? 'HIGH' : adjustedConfidence > 55 ? 'MEDIUM' : 'LOW',
            category: adjustedConfidence >= 65 && (confidenceResult.recommendation === 'BUY' || confidenceResult.recommendation === 'SELL')
                ? 'STRONG_SETUP'
                : adjustedConfidence < 40
                    ? 'AVOID'
                    : 'NEUTRAL',
            // v6: Sanitize AI scenarios — override probability AND validate trade plan values.
            // AI models return nonsensical values (e.g., stopLoss=100, hardcoded 60%/30% targets).
            // sanitizeScenario() validates SL is a real price level, recalculates target probabilities
            // from system direction model, and falls back to S/R levels when AI values are clearly wrong.
            bullish: aiAnalysis.bullish
                ? sanitizeScenario(
                    { ...aiAnalysis.bullish, probability: bullishProb },
                    'bullish', stock.quote.price, sr, atrCurrent, bullishProb, adjustedConfidence
                )
                : defaultBullish,
            bearish: aiAnalysis.bearish
                ? sanitizeScenario(
                    { ...aiAnalysis.bearish, probability: bearishProb },
                    'bearish', stock.quote.price, sr, atrCurrent, bearishProb, adjustedConfidence
                )
                : defaultBearish,

            riskMetrics: {
                expectedReturn: riskMetrics.expectedReturn,
                sharpeRatio: riskMetrics.sharpeRatio,
                maxDrawdown: riskMetrics.maxDrawdown,
                volatility: riskMetrics.volatility,
                riskRewardRatio: riskMetrics.riskRewardRatio,
                winRate: riskMetrics.winRate
            },

            rawPrompt: buildUserFriendlyPrompt(promptInput),

            // Phase 1: Pre-Move Detection Signal Card
            signalCard,
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

    // Trade selectivity override — v6: tightened convergence bypass
    // Only allow bypass when confluence is VERY strong AND confidence is high
    const hasConvergence = patternConfluence.score >= 75 && confidenceResult.direction.conviction >= 55;

    if (!selectivity.passed && (analysis.recommendation === 'BUY' || analysis.recommendation === 'SELL')) {
        const failedGates = selectivity.totalGates - selectivity.passedCount;

        if (hasConvergence && adjustedConfidence >= 65) {
            // v6: Convergence bypass — only with very strong pattern + TF alignment + high confidence
            logger.info({ symbol, reason: selectivity.reason, failedGates, confluence: patternConfluence.score, conviction: confidenceResult.direction.conviction },
                'Selectivity bypassed — strong convergence override');
            analysis.reasoning = analysis.reasoning +
                ` ℹ️ Selectivity gates (${failedGates}) bypassed due to strong pattern confluence (${patternConfluence.score}/100).`;
        } else if (failedGates >= 3) {
            // v6: lowered from 4 to 3 — reject to HOLD sooner
            logger.info({ symbol, reason: selectivity.reason, failedGates }, 'Selectivity rejected — downgrading to HOLD');
            analysis.recommendation = 'HOLD';
            analysis.category = 'NEUTRAL';
            analysis.reasoning = analysis.reasoning +
                ` ⚠️ Trade rejected by selectivity filter (${failedGates} gates failed): ${selectivity.reason}`;
        } else if (adjustedConfidence >= 60) {
            // 1-3 failures with decent confidence → warn only
            logger.info({ symbol, reason: selectivity.reason, failedGates }, 'Selectivity warning — keeping recommendation');
            analysis.reasoning = analysis.reasoning +
                ` ⚠️ Selectivity warning (${failedGates} gate(s)): ${selectivity.reason}`;
        } else {
            logger.info({ symbol, reason: selectivity.reason, failedGates }, 'Selectivity rejected — confidence too low');
            analysis.recommendation = 'HOLD';
            analysis.category = 'NEUTRAL';
            analysis.reasoning = analysis.reasoning +
                ` ⚠️ Trade rejected by selectivity filter: ${selectivity.reason}`;
        }
    }

    // Expectancy filter override — v5: only reject when data is reliable AND expectancy is clearly negative
    if (!expectancyResult.accepted && (analysis.recommendation === 'BUY' || analysis.recommendation === 'SELL')) {
        if (expectancyResult.dataReliable && expectancyResult.expectancy < -0.5) {
            // Strong negative expectancy with reliable data → reject
            logger.info({ symbol, expectancy: expectancyResult.expectancy, reason: expectancyResult.reason }, 'Expectancy rejected — downgrading to HOLD');
            analysis.recommendation = 'HOLD';
            analysis.category = 'NEUTRAL';
            analysis.reasoning = analysis.reasoning +
                ` ⚠️ Trade rejected by expectancy filter: Expectancy ${expectancyResult.expectancy.toFixed(3)}% (negative).`;
        } else {
            // Unreliable data or marginal negative expectancy → warn only
            logger.info({ symbol, expectancy: expectancyResult.expectancy, reliable: expectancyResult.dataReliable }, 'Expectancy warning — insufficient data to reject');
            analysis.reasoning = analysis.reasoning +
                ` ℹ️ Expectancy note: ${expectancyResult.reason}`;
        }
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
