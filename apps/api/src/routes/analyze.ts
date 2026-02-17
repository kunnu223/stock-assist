/**
 * Analyze Routes
 * @module @stock-assist/api/routes/analyze
 */

import { Router, Request, Response } from 'express';
import { getStockData, getMultipleStocks } from '../services/data';
import { calcIndicators } from '../services/indicators';
import { analyzePatterns } from '../services/patterns';
import { fetchNews } from '../services/news';
import { analyzeWithAI } from '../services/ai';
import { DEFAULT_WATCHLIST } from '@stock-assist/shared';
import { validateStockData, validateAIResponse, calculateAverageVolume } from '../utils/validation';
import { shouldTrade, checkRedFlags } from '../utils/tradeDecision';
import { savePrediction, applyCalibration } from '../services/backtest';
import { checkTimeframeAlignment, getAlignmentSummary } from '../utils/timeframeAlignment';
import { DailyAnalysis } from '../models';

// Enhanced analysis imports
import { fetchEnhancedNews } from '../services/news/enhanced';
import { fetchFundamentals } from '../services/data/fundamentals';
import { performComprehensiveTechnicalAnalysis, getTechnicalSummary, calculateSplitConfidence, calculatePatternConfluence, detectFundamentalTechnicalConflict } from '../services/analysis';
import { buildEnhancedPrompt, buildUserFriendlyPrompt } from '../services/ai/enhancedPrompt';
import { analyzeWithEnsemble } from '../services/ai/ensembleAI';
import { compareSector } from '../services/data';
import { calcADX } from '../services/indicators/adx';
import { calcATR } from '../services/indicators';
import { formatAmount, formatPercent } from '../utils/formatting';
import type { StockData } from '@stock-assist/shared';
import type { SplitConfidenceResult, ConfidenceResult } from '../services/analysis/confidenceScoring';
import type { FundamentalData } from '../services/data/fundamentals';
import { calculateRiskMetrics } from '../services/analysis/riskMetrics';
import { classifyRegime } from '../services/analysis/regimeClassifier';
import { saveSignal, updateSignalOutcomes, getSignalStats, getEmpiricalProbability } from '../services/backtest/signalTracker';
import { evaluateSelectivity } from '../services/analysis/tradeSelectivity';
import { evaluateExpectancy } from '../services/analysis/expectancy';
import { calibrateConfidence } from '../services/analysis/calibration';
import { getRegimeLearningStatus } from '../services/analysis/regimeClassifier';
import { getModifiersForConditions, getDerivedModifiers } from '../services/analysis/dataDerivedModifiers';
import { getMarketBreadth } from '../services/analysis/breadth';

export const analyzeRouter = Router();

/** GET /api/analyze/stocks - Morning screening */
analyzeRouter.get('/stocks', async (_req: Request, res: Response) => {
    const start = Date.now();

    try {
        console.log(`[Analyze] Fetching data for stocks: ${DEFAULT_WATCHLIST.join(', ')}`);
        const stocks = await getMultipleStocks(DEFAULT_WATCHLIST);
        console.log(`[Analyze] Successfully fetched data for ${stocks.length} stocks`);

        const results: any[] = [];

        // Time budget to ensure we return before 60s timeout
        const TIME_BUDGET_MS = 50000; // 50 seconds

        // Circuit Breaker: If we get consecutive AI failures (likely rate limit), stop asking AI to save time
        let consecutiveAIFailures = 0;
        let skipAI = false;

        // Process sequentially with delay to respect strict rate limits of gemini-2.0-flash
        for (const stock of stocks) {

            // Check if we are running out of time
            if (Date.now() - start > TIME_BUDGET_MS) {
                console.warn(`[Analyze] ⏳ Time budget exceeded (${((Date.now() - start) / 1000).toFixed(1)}s). Skipping remaining stocks.`);
                break;
            }

            // Execute analysis
            const result = await processStock(stock, skipAI);
            results.push(result);

            // Update Circuit Breaker
            if (!skipAI) {
                const aiFailed = result.warnings?.some((w: string) => w.includes('AI analysis not available'));
                if (aiFailed) {
                    consecutiveAIFailures++;
                    console.warn(`[Analyze] ⚠️ Consecutive AI Failure #${consecutiveAIFailures} for ${stock.symbol}`);
                } else {
                    consecutiveAIFailures = 0; // Reset on success
                }

                if (consecutiveAIFailures >= 2) {
                    console.warn('[Analyze] 🛑 Circuit Breaker triggered! Disabling AI for remaining stocks to prevent timeout.');
                    skipAI = true;
                }
            }

            // Add a small delay between requests (Groq has better rate limits than Gemini)
            if (!skipAI && (Date.now() - start < TIME_BUDGET_MS - 5000)) {
                await new Promise(resolve => setTimeout(resolve, 500)); // 500ms delay (was 2s for Gemini)
            }
        }

        const strongSetups = results.filter((r) => r.category === 'STRONG_SETUP');
        const avoid = results.filter((r) => r.category === 'AVOID');
        const neutral = results.filter((r) => r.category === 'NEUTRAL');

        console.log(`[Analyze] ✅ Screening complete - Strong: ${strongSetups.length}, Neutral: ${neutral.length}, Avoid: ${avoid.length}`);

        res.json({
            success: true,
            date: new Date().toISOString().split('T')[0],
            processingTime: `${((Date.now() - start) / 1000).toFixed(1)}s`,
            totalStocks: results.length,
            circuitBreakerTriggered: skipAI,
            strongSetups,
            neutral,
            avoid,
        });
    } catch (error) {
        console.error('[Analyze] ❌ Screening error:', error);
        res.status(500).json({
            success: false,
            error: String(error),
            message: 'Morning screening failed'
        });
    }
});

/** POST /api/analyze/single - Enhanced single stock analysis */
analyzeRouter.post('/single', async (req: Request, res: Response) => {
    const { symbol, language } = req.body;

    if (!symbol) {
        return res.status(400).json({ success: false, error: 'Symbol required' });
    }

    const start = Date.now();
    console.log(`[Analyze] 🚀 Enhanced analysis for: ${symbol} (${language || 'en'})`);

    try {
        // Step 1+2: Parallel fetch of data (fixed: single getStockData call)
        console.log(`[Analyze] 🚀 Starting parallel data fetch for ${symbol}...`);
        const [stock, enhancedNews, fundamentals] = await Promise.all([
            getStockData(symbol, 90).then(data => {  // 90 days for ADX + better indicator accuracy
                console.log(`[Analyze] ✅ Stock data fetched for ${symbol} (${data.history.length} daily bars)`);
                return data;
            }),
            fetchEnhancedNews(symbol).then(res => {
                console.log(`[Analyze] ✅ News analysis complete (${res.latestHeadlines.length} items, Impact: ${res.impactLevel})`);
                return res;
            }),
            fetchFundamentals(symbol).then(res => {
                console.log(`[Analyze] ✅ Fundamentals fetched (Valuation: ${res.valuation}, Growth: ${res.growth})`);
                return res;
            })
        ]);

        // Technical analysis runs synchronously on already-fetched data (no duplicate call)
        const technicalAnalysis = performComprehensiveTechnicalAnalysis({
            daily: stock.history,
            weekly: stock.timeframes?.weekly || [],
            monthly: stock.timeframes?.monthly || []
        });
        console.log(`[Analyze] ✅ Technical analysis complete`);

        // ADX trend strength (new indicator)
        const adxResult = calcADX(stock.history);
        console.log(`[Analyze] 📈 ADX: ${adxResult.adx} (${adxResult.trendStrength}), +DI=${adxResult.plusDI}, -DI=${adxResult.minusDI}`);

        // Step 2.5: Classify market regime
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
        console.log(`[Analyze] 🏛️ Regime: ${regimeResult.regime} (${regimeResult.confidence}% confidence) — ${regimeResult.description}`);

        console.log(`[Analyze] Data fetched in ${((Date.now() - start) / 1000).toFixed(1)}s`);
        console.log(`[Analyze] Technical analysis: alignment=${technicalAnalysis.multiTimeframe.alignment}`);

        // Step 3: Calculate split confidence (Phase B: direction + strength separated)
        const confidenceResult = calculateSplitConfidence({
            patterns: technicalAnalysis.patterns.daily,
            news: enhancedNews,
            indicators: technicalAnalysis.indicators.daily,
            fundamentals,
            weeklyIndicators: technicalAnalysis.indicators.weekly || undefined,
            monthlyIndicators: technicalAnalysis.indicators.monthly || undefined,
            regime: regimeResult.regime
        });
        console.log(`[Analyze] 📊 Confidence: ${confidenceResult.score}/100 → ${confidenceResult.recommendation} | Direction: ${confidenceResult.direction.direction} (conviction: ${confidenceResult.direction.conviction}%, bull:${confidenceResult.direction.bullishSignals} bear:${confidenceResult.direction.bearishSignals})`);

        // NEW: Step 3.5: Calculate pattern confluence across timeframes
        console.log(`[analyze.ts:170] 🔄 Calculating pattern confluence...`);
        const patternConfluence = calculatePatternConfluence({
            '1D': technicalAnalysis.patterns.daily,
            '1W': technicalAnalysis.patterns.weekly || technicalAnalysis.patterns.daily, // Fallback
            '1M': technicalAnalysis.patterns.monthly || technicalAnalysis.patterns.daily // Fallback
        });
        console.log(`[analyze.ts:176] 🧩 Confluence Score: ${patternConfluence.score}/100, Agreement: ${patternConfluence.agreement}, Modifier: ${patternConfluence.confidenceModifier}%`);

        // NEW: Step 3.6: Detect fundamental-technical conflicts
        console.log(`[analyze.ts:179] 🔍 Checking fundamental-technical conflicts...`);
        const ftConflict = detectFundamentalTechnicalConflict(
            {
                bias: confidenceResult.recommendation === 'BUY' ? 'BULLISH' : confidenceResult.recommendation === 'SELL' ? 'BEARISH' : 'NEUTRAL',
                confidenceScore: confidenceResult.score
            },
            fundamentals
        );
        console.log(`[analyze.ts:187] 💰 Fundamental Conflict: ${ftConflict.hasConflict ? 'YES' : 'NO'} (${ftConflict.conflictType}), Modifier: ${ftConflict.confidenceAdjustment}%`);

        // NEW: Step 3.7: Sector comparison
        console.log(`[analyze.ts:190] 🏢 Comparing with sector...`);
        const sectorComparison = await compareSector(stock.symbol, stock.quote.changePercent);
        console.log(`[analyze.ts:192] 📉 Sector Verdict: ${sectorComparison.verdict}, Outperformance: ${sectorComparison.outperformance}%, Modifier: ${sectorComparison.confidenceModifier}%`);

        // Condition variables used by modifiers, selectivity, and signal tracking
        const volumeRatio = technicalAnalysis.indicators.daily.volume.ratio;
        const alignmentScore = technicalAnalysis.multiTimeframe.alignmentScore || 50;
        const isBullishBreakout = confidenceResult.recommendation === 'BUY' && stock.quote.changePercent > 1;
        const isBearishBreakout = confidenceResult.recommendation === 'SELL' && stock.quote.changePercent < -1;
        const volumeGatePassed = volumeRatio >= 1.2;

        // Phase D #8: Data-derived modifiers (replace static +8%/-10% with empirical values)
        const derivedMods = await getModifiersForConditions(volumeRatio, alignmentScore, adxResult.adx);
        const volumePenaltyFinal = (isBullishBreakout || isBearishBreakout) && volumeRatio < 1.5
            ? -10 : derivedMods.volumeModifier;
        const multiTFPenalty = derivedMods.multiTFModifier;
        const adxPenalty = derivedMods.adxModifier;
        console.log(`[Analyze] 📐 Modifiers (${derivedMods.source}): vol=${volumePenaltyFinal}, mtf=${multiTFPenalty}, adx=${adxPenalty}`);

        // Phase E #10: Market breadth modifier
        const breadth = await getMarketBreadth();
        const breadthModifier = confidenceResult.direction.direction === 'BULLISH' ? breadth.modifier : 0;
        if (breadthModifier !== 0) {
            console.log(`[Analyze] 🌐 Breadth ${breadth.zone}: ${breadth.breadth}% above 50DMA → ${breadthModifier > 0 ? '+' : ''}${breadthModifier}%`);
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
        console.log(`[Analyze] 🎯 Confidence: ${baseConfidence}% → ${adjustedConfidence}% (vol:${volumePenaltyFinal}, mtf:${multiTFPenalty}, adx:${adxPenalty}, breadth:${breadthModifier}, confluence:${patternConfluence.confidenceModifier}, ft:${ftConflict.confidenceAdjustment}, sector:${sectorComparison.confidenceModifier})`);

        // NEW: Trade selectivity filter — reject marginal setups
        const ftSeverity = ftConflict.hasConflict
            ? (Math.abs(ftConflict.confidenceAdjustment) >= 10 ? 'high' as const
                : Math.abs(ftConflict.confidenceAdjustment) >= 5 ? 'medium' as const
                    : 'low' as const)
            : 'none' as const;

        const selectivity = evaluateSelectivity({
            adx: adxResult.adx,
            adxHistory: adxResult.adxHistory,   // Phase E #11: pass ADX history for acceleration check
            alignmentScore,
            volumeRatio,
            ftConflictSeverity: ftSeverity,
        });
        console.log(`[Analyze] 🛡️ Selectivity: ${selectivity.passed ? 'PASSED' : 'REJECTED'} (${selectivity.passedCount}/${selectivity.totalGates} gates) — ${selectivity.reason}`);

        // NEW: Calculate risk metrics
        const direction = confidenceResult.recommendation === 'BUY' ? 'bullish' : confidenceResult.recommendation === 'SELL' ? 'bearish' : 'neutral';
        const riskMetrics = calculateRiskMetrics(
            stock.history,
            technicalAnalysis.indicators.daily,
            adjustedConfidence,
            direction
        );
        console.log(`[Analyze] 📊 Risk: ExpReturn=${riskMetrics.expectedReturn}%, Sharpe=${riskMetrics.sharpeRatio}, WinRate=${riskMetrics.winRate}%, MaxDD=${riskMetrics.maxDrawdown}%`);

        // Phase A: Empirical probability lookup (condition-set hashing)
        const empiricalProb = await getEmpiricalProbability(
            regimeResult.regime,
            alignmentScore,
            adxResult.adx,
            volumeRatio
        );
        if (empiricalProb.available) {
            console.log(`[Analyze] 📈 Empirical: ${empiricalProb.message}`);
        } else {
            console.log(`[Analyze] ℹ️ Empirical: ${empiricalProb.message}`);
        }

        // Phase B #4: Expectancy filter — reject trades with negative expectancy
        const expectancyResult = evaluateExpectancy(empiricalProb);
        console.log(`[Analyze] 💰 Expectancy: ${expectancyResult.reason}`);

        // Phase C #5: Confidence calibration — adjust confidence based on historical accuracy
        const calibration = await calibrateConfidence(adjustedConfidence);
        if (calibration.wasCalibratable) {
            console.log(`[Analyze] 🎯 Calibration: ${adjustedConfidence}% → ${calibration.calibrated}% (delta: ${calibration.delta > 0 ? '+' : ''}${calibration.delta}%, bucket: ${calibration.bucketUsed})`);
        } else {
            console.log(`[Analyze] ℹ️ Calibration: Not enough data (bucket: ${calibration.bucketUsed})`);
        }

        // Breaking news override
        let breakingNewsOverride = false;
        if (enhancedNews.breakingImpact === 'HIGH' && enhancedNews.breakingNews.length > 0) {
            const negativeBreaking = enhancedNews.breakingNews.some(n => n.sentiment === 'negative');
            if (negativeBreaking) {
                breakingNewsOverride = true;
                console.log(`[Analyze] ⚠️ Breaking negative news detected - capping bullish probability`);
            }
        }

        // Step 4: Generate technical summary for AI
        const technicalSummary = getTechnicalSummary(technicalAnalysis);

        // Step 5: Build enhanced prompt and get AI analysis via ENSEMBLE
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

        // NEW: Ensemble AI (Groq + Gemini in parallel)
        const ensembleResult = await analyzeWithEnsemble(
            { stock, indicators: technicalAnalysis.indicators.daily, patterns: technicalAnalysis.patterns.daily, news: enhancedNews as any, language },
            adjustedConfidence
        );
        let aiAnalysis: any = ensembleResult?.analysis || null;

        // Fallback if AI fails or returns invalid recommendation
        if (!aiAnalysis) {
            console.warn(`[Analyze] AI analysis failed, using system confidence`);
            aiAnalysis = generateFallbackAnalysis(stock, confidenceResult, technicalAnalysis, fundamentals);
        } else {
            // Validate recommendation format (Fix for "Objects are not valid as a React child")
            if (typeof aiAnalysis.recommendation === 'object') {
                console.warn(`[Analyze] ⚠️ AI returned object for recommendation:`, aiAnalysis.recommendation);
                // Extract trade/action from object
                const recObj = aiAnalysis.recommendation as any;
                aiAnalysis.recommendation = recObj.trade || recObj.action || recObj.signal || confidenceResult.recommendation;
            }
            if (typeof aiAnalysis.confidenceScore === 'object') {
                const confObj = aiAnalysis.confidenceScore as any;
                aiAnalysis.confidenceScore = confObj.score || confObj.confidence || adjustedConfidence;
            }
            if (typeof aiAnalysis.bias === 'object') {
                const biasObj = aiAnalysis.bias as any;
                aiAnalysis.bias = biasObj.bias || biasObj.trend || (confidenceResult.recommendation === 'BUY' ? 'BULLISH' : 'BEARISH');
            }
            if (typeof aiAnalysis.timeframe === 'object') {
                aiAnalysis.timeframe = 'swing'; // Default if complex object
            }
        }

        // Default bullish/bearish scenarios — probabilities tied to adjusted confidence
        const sr = technicalAnalysis.indicators.daily.sr;

        // Calculate dynamic probabilities — no artificial clamps (v5.0 IMMEDIATE fix #1)
        // Let adjustedConfidence map naturally: no floors, no ceilings, no +10 bias
        let bullishProb: number;
        let bearishProb: number;
        if (confidenceResult.recommendation === 'BUY') {
            bullishProb = adjustedConfidence;
            bearishProb = 100 - bullishProb;
        } else if (confidenceResult.recommendation === 'SELL') {
            bearishProb = adjustedConfidence;
            bullishProb = 100 - bearishProb;
        } else {
            // HOLD/WAIT — slight bias from technicals
            const techScore = confidenceResult.breakdown.technicalAlignment;
            bullishProb = Math.round(Math.max(15, Math.min(85, techScore)));
            bearishProb = 100 - bullishProb;
        }

        const defaultBullish = {
            probability: bullishProb,
            score: confidenceResult.breakdown.technicalAlignment,
            trigger: `Break above ₹${sr.resistance}`,
            confirmation: 'Close above with volume',
            tradePlan: {
                action: 'BUY',
                entry: [formatAmount(stock.quote.price), formatAmount(sr.resistance)],
                stopLoss: formatAmount(sr.support),
                stopLossPercent: formatPercent((stock.quote.price - sr.support) / stock.quote.price * 100),
                targets: [
                    { price: formatAmount(sr.resistance), probability: 70 },
                    { price: formatAmount(sr.resistance * 1.05), probability: 50 }
                ],
                riskReward: formatAmount(1.5),
                potentialProfit: [formatAmount(500), formatAmount(1500)]
            },
            factors: ['Technical setup', 'Volume confirmation'],
            timeHorizon: '3-7 days'
        };

        const defaultBearish = {
            probability: bearishProb,
            score: 100 - confidenceResult.breakdown.technicalAlignment,
            trigger: `Break below ₹${sr.support}`,
            confirmation: 'Close below with volume',
            tradePlan: {
                action: 'AVOID',
                entry: [formatAmount(sr.support * 0.98), formatAmount(sr.support)],
                stopLoss: formatAmount(sr.resistance),
                stopLossPercent: formatPercent((sr.resistance - stock.quote.price) / stock.quote.price * 100),
                targets: [
                    { price: formatAmount(sr.support), probability: 60 },
                    { price: formatAmount(sr.support * 0.95), probability: 40 }
                ],
                riskReward: formatAmount(1.2),
                potentialProfit: [formatAmount(200), formatAmount(800)]
            },
            factors: ['Downside risk', 'Support breakdown'],
            timeHorizon: '1-5 days'
        };

        // Step 6: Build enhanced response
        const response = {
            success: true,
            processingTime: `${((Date.now() - start) / 1000).toFixed(1)}s`,
            analysis: {
                stock: stock.symbol,
                currentPrice: formatAmount(stock.quote.price),
                recommendation: aiAnalysis.recommendation || confidenceResult.recommendation,
                confidenceScore: adjustedConfidence, // ALWAYS use system-adjusted confidence
                timeframe: aiAnalysis.timeframe || 'swing',

                // NEW: Highlights and Badges (User Request)
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

                // Accuracy metrics + quality gates
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
                    // Phase E #10: Market breadth
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
                    // Phase A: Empirical probability from condition-set hashing
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
                    // Phase B #3: Direction/Probability split model output
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
                    // Phase B #4: Expectancy filter result
                    expectancyFilter: {
                        accepted: expectancyResult.accepted,
                        expectancy: expectancyResult.expectancy,
                        riskRewardRatio: expectancyResult.riskRewardRatio,
                        dataReliable: expectancyResult.dataReliable,
                        reason: expectancyResult.reason,
                    },
                    // Phase C #5: Confidence calibration
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

                // Risk metrics
                riskMetrics: {
                    expectedReturn: riskMetrics.expectedReturn,
                    sharpeRatio: riskMetrics.sharpeRatio,
                    maxDrawdown: riskMetrics.maxDrawdown,
                    volatility: riskMetrics.volatility,
                    riskRewardRatio: riskMetrics.riskRewardRatio,
                    winRate: riskMetrics.winRate
                },

                // Raw AI prompt (user-friendly version) for manual use with other AI tools
                rawPrompt: buildUserFriendlyPrompt(promptInput)
            }
        };

        // Apply breaking news override capping
        if (breakingNewsOverride && response.analysis.bullish && response.analysis.bullish.probability > 45) {
            console.log(`[Analyze] Applying probability cap for ${symbol} due to negative breaking news: ${response.analysis.bullish.probability}% -> 45%`);
            response.analysis.bullish.probability = 45;
            // Also update bias if it was strongly bullish
            if (response.analysis.recommendation === 'BUY') {
                response.analysis.recommendation = 'HOLD';
                response.analysis.bias = 'NEUTRAL';
            }
        }

        // Trade selectivity override — reject marginal setups
        if (!selectivity.passed && (response.analysis.recommendation === 'BUY' || response.analysis.recommendation === 'SELL')) {
            console.log(`[Analyze] 🛡️ Selectivity rejected ${symbol}: ${selectivity.reason} → downgrading to HOLD`);
            response.analysis.recommendation = 'HOLD';
            response.analysis.category = 'NEUTRAL';
            response.analysis.reasoning = response.analysis.reasoning +
                ` ⚠️ Trade rejected by selectivity filter: ${selectivity.reason}`;
        }

        // Phase B #4: Expectancy filter override — reject trades with negative expectancy
        if (!expectancyResult.accepted && (response.analysis.recommendation === 'BUY' || response.analysis.recommendation === 'SELL')) {
            console.log(`[Analyze] 💰 Expectancy rejected ${symbol}: ${expectancyResult.reason} → downgrading to HOLD`);
            response.analysis.recommendation = 'HOLD';
            response.analysis.category = 'NEUTRAL';
            response.analysis.reasoning = response.analysis.reasoning +
                ` ⚠️ Trade rejected by expectancy filter: Expectancy ${expectancyResult.expectancy.toFixed(3)}% (negative). Win rate ${expectancyResult.winRate}% is misleading.`;
        }

        console.log(`[Analyze] ✅ Enhanced analysis complete for ${symbol} in ${response.processingTime}`);

        // Store in DailyAnalysis History (One record per stock per day)
        try {
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            await DailyAnalysis.findOneAndUpdate(
                { symbol, date: today },
                {
                    symbol,
                    date: today,
                    confidenceScore: response.analysis.confidenceScore,
                    bullishProb: response.analysis.bullish?.probability || 0,
                    bearishProb: response.analysis.bearish?.probability || 0,
                    analysis: response.analysis
                },
                { upsert: true, new: true }
            );
            console.log(`[Analyze] 🏛️ Daily analysis history updated for ${symbol}`);
        } catch (dbError) {
            console.warn(`[Analyze] ⚠️ Failed to save daily analysis for ${symbol}:`, dbError);
        }

        // Signal tracking — save every actionable signal for statistical analysis (fire-and-forget)
        const rec = response.analysis.recommendation;
        if (rec === 'BUY' || rec === 'SELL') {
            const sr = technicalAnalysis.indicators.daily.sr;
            const signalEntry = stock.quote.price;
            const signalTarget = rec === 'BUY' ? sr.resistance : sr.support;
            const signalSL = rec === 'BUY' ? sr.support : sr.resistance;

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
            ]).catch(err => console.error(`[SignalTracker] Error:`, err));
        }

        res.json(response);

    } catch (error) {
        console.error('[Analyze] ❌ Enhanced analysis error:', error);
        res.status(500).json({
            success: false,
            error: String(error),
            message: 'Enhanced analysis failed. Please try again.'
        });
    }
});

/**
 * GET /api/analyze/history - Fetch historical analysis with filters
 */
analyzeRouter.get('/history', async (req: Request, res: Response) => {
    try {
        const { symbol, startDate, endDate, minConfidence, minBullish, minBearish } = req.query;

        const query: any = {};

        if (symbol) query.symbol = { $regex: new RegExp(symbol as string, 'i') };

        if (startDate || endDate) {
            query.date = {};
            if (startDate) query.date.$gte = new Date(startDate as string);
            if (endDate) query.date.$lte = new Date(endDate as string);
        }

        if (minConfidence) query.confidenceScore = { $gte: Number(minConfidence) };
        if (minBullish) query.bullishProb = { $gte: Number(minBullish) };
        if (minBearish) query.bearishProb = { $gte: Number(minBearish) };

        const history = await DailyAnalysis.find(query)
            .sort({ date: -1, symbol: 1 })
            .limit(100); // Sanity limit

        res.json({
            success: true,
            count: history.length,
            data: history
        });
    } catch (error) {
        console.error('[Analyze] ❌ History fetch error:', error);
        res.status(500).json({ success: false, error: String(error) });
    }
});

/**
 * GET /api/analyze/signal-stats - Signal tracking statistics & win-rate matrix
 */
analyzeRouter.get('/signal-stats', async (_req: Request, res: Response) => {
    try {
        const stats = await getSignalStats();

        // Phase C: Include regime learning status and calibration
        const [regimeLearning, calibrationResult] = await Promise.all([
            getRegimeLearningStatus(),
            import('../services/analysis/calibration').then(m => m.getConfidenceCalibration()),
        ]);

        res.json({
            success: true,
            ...stats,
            // Phase C #7: Regime self-learning progress
            regimeLearning: regimeLearning.regimes,
            // Phase C #5: Confidence calibration table
            confidenceCalibration: {
                ready: calibrationResult.ready,
                totalResolved: calibrationResult.totalResolved,
                quality: calibrationResult.calibrationQuality,
                overallAccuracy: calibrationResult.overallAccuracy,
                buckets: calibrationResult.buckets,
                recommendations: calibrationResult.recommendations,
            },
            // Phase D #8: Data-derived modifier status
            derivedModifiers: await getDerivedModifiers().then(r => ({
                ready: r.ready,
                modifiers: r.modifiers,
                totalSignals: r.totalSignals,
                message: r.message,
            })),
            // Phase E #10: Market breadth
            marketBreadth: await getMarketBreadth().then(b => ({
                breadth: b.breadth,
                zone: b.zone,
                aboveCount: b.aboveCount,
                totalEvaluated: b.totalEvaluated,
                cachedAt: b.cachedAt,
            })).catch(() => ({ breadth: null, zone: 'UNKNOWN', message: 'Failed to fetch breadth' })),
            message: stats.ready
                ? `Statistical engine ready with ${stats.resolved} resolved signals`
                : `Need ${300 - stats.resolved} more resolved signals for statistical engine (currently ${stats.resolved}/300)`
        });
    } catch (error) {
        console.error('[Analyze] ❌ Signal stats error:', error);
        res.status(500).json({ success: false, error: String(error) });
    }
});

/**
 * Helper: Analyze a single stock (for batch processing)
 */
async function processStock(stock: any, skipAI: boolean = false): Promise<any> {
    console.log(`[Analyze] Processing ${stock.symbol}... ${skipAI ? '(AI Skipped)' : ''}`);
    try {
        // Validate stock data quality
        const avgVolume = calculateAverageVolume(stock.history);
        const dataValidation = validateStockData({
            symbol: stock.symbol,
            history: stock.history,
            avgVolume
        });

        if (!dataValidation.isValid) {
            console.error(`[Analyze] ❌ Data validation failed for ${stock.symbol}:`, dataValidation.errors);
            return {
                stock: stock.symbol,
                category: 'AVOID',
                bias: 'NEUTRAL',
                confidence: 'LOW',
                recommendation: `Data quality issues: ${dataValidation.errors.join(', ')}`,
                errors: dataValidation.errors
            };
        }

        const indicators = calcIndicators(stock.history);

        // Calculate multi-timeframe indicators
        const weeklyIndicators = stock.timeframes?.weekly ? calcIndicators(stock.timeframes.weekly) : undefined;
        const monthlyIndicators = stock.timeframes?.monthly ? calcIndicators(stock.timeframes.monthly) : undefined;

        // Check multi-timeframe alignment
        const alignment = checkTimeframeAlignment(indicators, weeklyIndicators, monthlyIndicators);
        const alignmentSummary = getAlignmentSummary(indicators, weeklyIndicators, monthlyIndicators);
        console.log(`[Analyze] 📊 ${stock.symbol} Timeframe Alignment: ${alignmentSummary}`);

        const patterns = analyzePatterns(stock.history);
        const news = await fetchNews(stock.symbol);

        let aiResponse = null;

        if (!skipAI) {
            console.log(`[Analyze] Running AI analysis for ${stock.symbol}...`);
            aiResponse = await analyzeWithAI({
                stock,
                indicators,
                patterns,
                news,
                weeklyIndicators,
                monthlyIndicators
            });
        } else {
            // Mock null response to trigger cleanup logic
            aiResponse = null;
        }

        if (!aiResponse) {
            const reason = skipAI ? 'AI Skipped (Circuit Breaker)' : 'AI unavailable (Rate Limit/Demo Mode)';
            if (!skipAI) console.warn(`[Analyze] ⚠️ ${reason} for ${stock.symbol}`);

            // Check red flags (technicals only)
            const redFlags = checkRedFlags({
                bias: 'NEUTRAL', // Default
                confidence: 'LOW',
                explanation: reason,
                indicators,
                pattern: patterns.primary,
                news
            });

            // Construct technical-only response
            // We need to return a valid object that frontend accepts
            return {
                stock: stock.symbol,
                category: 'NEUTRAL', // Default to neutral if no AI
                tradeDecision: {
                    shouldTrade: false,
                    reason: reason
                },
                bias: 'NEUTRAL',
                confidence: 'LOW',
                recommendation: reason,
                warnings: ['AI analysis not available', reason],
                redFlags: redFlags.failedChecks,
                validationPassed: true,
                indicators,
                pattern: patterns.primary,
                news,
                timeframeAlignment: alignment
            };
        }

        // Validate AI response
        const aiValidation = validateAIResponse(aiResponse, stock.symbol);
        if (!aiValidation.isValid) {
            console.error(`[Analyze] ❌ AI validation failed for ${stock.symbol}:`, aiValidation.errors);
            return {
                stock: stock.symbol,
                category: 'AVOID',
                bias: 'NEUTRAL',
                confidence: 'LOW',
                recommendation: `AI response validation failed`,
                errors: aiValidation.errors
            };
        }

        // Apply probability calibration
        let calibratedResponse: any = aiResponse;
        try {
            calibratedResponse = await applyCalibration(aiResponse);
        } catch (calError) {
            console.warn(`[Analyze] ⚠️ Calibration failed for ${stock.symbol}, using raw AI response:`, calError);
        }

        // Apply trade decision logic (using calibrated response)
        const decision = shouldTrade({
            ...calibratedResponse,
            indicators,
            pattern: patterns.primary
        });

        // Merge all warnings
        const allWarnings = [
            ...dataValidation.warnings,
            ...aiValidation.warnings,
            ...decision.warnings
        ];

        // Check red flags
        const redFlags = checkRedFlags({
            ...calibratedResponse,
            indicators,
            pattern: patterns.primary,
            news
        });

        // Build final analysis result
        const analysis = {
            ...calibratedResponse,
            category: decision.category,
            tradeDecision: {
                shouldTrade: decision.shouldTrade,
                reason: decision.reason
            },
            redFlags: redFlags.failedChecks,
            warnings: allWarnings,
            validationPassed: dataValidation.isValid && aiValidation.isValid,
            timeframeAlignment: alignment
        };

        // Auto-save prediction for backtest tracking (only for strong setups)
        if (decision.category === 'STRONG_SETUP') {
            savePrediction(analysis).catch(err => {
                console.warn(`[Analyze] ⚠️ Failed to save prediction for ${stock.symbol}:`, err);
            });
        }

        console.log(`[Analyze] ✅ Completed ${stock.symbol} - Category: ${decision.category}`);
        return analysis;

    } catch (err) {
        console.error(`[Analyze] ❌ Error processing ${stock.symbol}:`, err);
        return {
            stock: stock.symbol,
            category: 'AVOID',
            bias: 'NEUTRAL',
            confidence: 'LOW',
            recommendation: `Analysis failed: ${err}`,
            error: String(err)
        };
    }
}



/**
 * Generate fallback analysis when AI is unavailable
 */
function generateFallbackAnalysis(
    stock: StockData,
    confidence: ConfidenceResult,
    technicalAnalysis: any,
    fundamentals: FundamentalData
): any {
    const indicators = technicalAnalysis.indicators.daily;
    const sr = indicators.sr;

    return {
        symbol: stock.symbol,
        currentPrice: stock.quote.price,
        recommendation: confidence.recommendation,
        confidenceScore: confidence.score,
        timeframe: 'swing',
        bias: confidence.recommendation === 'BUY' ? 'BULLISH'
            : confidence.recommendation === 'SELL' ? 'BEARISH'
                : 'NEUTRAL',
        confidence: confidence.score > 70 ? 'HIGH' : confidence.score > 50 ? 'MEDIUM' : 'LOW',
        category: confidence.score > 65 ? 'STRONG_SETUP' : confidence.score < 40 ? 'AVOID' : 'NEUTRAL',
        priceTargets: {
            entry: stock.quote.price,
            target1: sr.resistance,
            target2: sr.r1,
            stopLoss: sr.support,
            riskReward: ((sr.resistance - stock.quote.price) / (stock.quote.price - sr.support)).toFixed(2)
        },
        risks: [
            'Market volatility',
            'Sector rotation risk',
            'AI analysis unavailable - using system confidence only'
        ],
        reasoning: `System confidence: ${confidence.score}/100. ` +
            `Technical alignment: ${technicalAnalysis.multiTimeframe.alignment}. ` +
            `News sentiment: ${confidence.breakdown.newsSentiment}/100. ` +
            `Fundamentals: ${fundamentals.valuation} valuation with ${fundamentals.growth} growth.`,
        bullish: {
            probability: confidence.recommendation === 'BUY' ? 65 : 40,
            score: confidence.breakdown.technicalAlignment,
            trigger: `Break above ₹${sr.resistance}`,
            confirmation: 'Close above with volume',
            tradePlan: {
                action: 'BUY',
                entry: [stock.quote.price, sr.resistance],
                stopLoss: sr.support,
                stopLossPercent: ((stock.quote.price - sr.support) / stock.quote.price * 100).toFixed(1),
                targets: [
                    { price: sr.resistance, probability: 70 },
                    { price: sr.r1, probability: 50 }
                ],
                riskReward: 1.5,
                potentialProfit: [500, 1500]
            },
            factors: confidence.factors.filter((f: string) =>
                f.toLowerCase().includes('bullish') || f.toLowerCase().includes('above')
            ),
            timeHorizon: '3-7 days'
        },
        bearish: {
            probability: confidence.recommendation === 'SELL' ? 65 : 35,
            score: 100 - confidence.breakdown.technicalAlignment,
            trigger: `Break below ₹${sr.support}`,
            confirmation: 'Close below with volume',
            tradePlan: {
                action: 'AVOID',
                entry: [sr.s1, sr.support],
                stopLoss: sr.resistance,
                stopLossPercent: ((sr.resistance - stock.quote.price) / stock.quote.price * 100).toFixed(1),
                targets: [
                    { price: sr.support, probability: 60 },
                    { price: sr.s1, probability: 40 }
                ],
                riskReward: 1.2,
                potentialProfit: [200, 800]
            },
            factors: confidence.factors.filter((f: string) =>
                f.toLowerCase().includes('bearish') || f.toLowerCase().includes('below')
            ),
            timeHorizon: '1-5 days'
        }
    };
}

/**
 * Helper: Format patterns with stars based on strength
 */
function formatPatternsWithStars(tf: any): string[] {
    if (!tf || !tf.patterns || tf.patterns.length === 0) return ['No significant patterns'];

    // Map strength to stars
    const strength = tf.strength || 50;
    const stars = strength > 80 ? '⭐⭐⭐' : strength > 60 ? '⭐⭐' : strength > 40 ? '⭐' : '';

    return tf.patterns.map((p: string) => `${p} ${stars}`.trim());
}
