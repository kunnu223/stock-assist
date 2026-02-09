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
import * as fs from 'fs';
import * as path from 'path';
import { DailyAnalysis } from '../models';

// Enhanced analysis imports
import { fetchEnhancedNews } from '../services/news/enhanced';
import { fetchFundamentals } from '../services/data/fundamentals';
import { performComprehensiveTechnicalAnalysis, getTechnicalSummary, calculateConfidence, calculatePatternConfluence, detectFundamentalTechnicalConflict } from '../services/analysis';
import { buildEnhancedPrompt } from '../services/ai/enhancedPrompt';
import { analyzeWithGroq } from '../services/ai/groq';
import { compareSector } from '../services/data';
import { formatAmount, formatPercent, safeNumber } from '../utils/formatting';
import type { StockData } from '@stock-assist/shared';
import type { ConfidenceResult } from '../services/analysis/confidenceScoring';
import type { FundamentalData } from '../services/data/fundamentals';

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
    const { symbol } = req.body;

    if (!symbol) {
        return res.status(400).json({ success: false, error: 'Symbol required' });
    }

    const start = Date.now();
    console.log(`[Analyze] 🚀 Enhanced analysis for: ${symbol}`);

    try {
        // Step 1:        // Step 2: Parallel fetch of data
        console.log(`[analyze.ts:137] 🚀 Starting parallel data fetch for ${symbol}...`);
        const [stock, technicalAnalysis, enhancedNews, fundamentals] = await Promise.all([
            // 1. Basic stock data (Quote + History + Multi-timeframe)
            getStockData(symbol).then(data => {
                console.log(`[analyze.ts:140] ✅ Stock data fetched for ${symbol}`);
                return data;
            }),

            // 2. Comprehensive Technical Analysis
            getStockData(symbol).then(data => {
                const res = performComprehensiveTechnicalAnalysis({
                    daily: data.history,
                    weekly: data.timeframes?.weekly || [],
                    monthly: data.timeframes?.monthly || []
                });
                console.log(`[analyze.ts:145] ✅ Technical analysis complete (Indicators: ${res.indicators.daily ? 'YES' : 'NO'}, Patterns: ${res.patterns.daily ? 'YES' : 'NO'})`);
                return res;
            }),

            // 3. Enhanced News Analysis
            fetchEnhancedNews(symbol).then(res => {
                console.log(`[analyze.ts:150] ✅ News analysis complete (${res.latestHeadlines.length} items, Impact: ${res.impactLevel})`);
                return res;
            }),

            // 4. Fundamental Analysis
            fetchFundamentals(symbol).then(res => {
                console.log(`[analyze.ts:155] ✅ Fundamentals fetched (Valuation: ${res.valuation}, Growth: ${res.growth})`);
                return res;
            })
        ]);

        console.log(`[Analyze] Data fetched in ${((Date.now() - start) / 1000).toFixed(1)}s`);
        console.log(`[Analyze] Technical analysis: alignment=${technicalAnalysis.multiTimeframe.alignment}`);

        // Step 3: Calculate base confidence score
        const confidenceResult = calculateConfidence({
            patterns: technicalAnalysis.patterns.daily,
            news: enhancedNews,
            indicators: technicalAnalysis.indicators.daily,
            fundamentals,
            weeklyIndicators: technicalAnalysis.indicators.weekly || undefined,
            monthlyIndicators: technicalAnalysis.indicators.monthly || undefined
        });
        console.log(`[analyze.ts:167] 📊 Base Confidence Calculated: ${confidenceResult.score}/100 → ${confidenceResult.recommendation}`);

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

        // NEW: Calculate adjusted confidence score
        const baseConfidence = confidenceResult.score;
        const adjustedConfidence = Math.max(0, Math.min(100,
            baseConfidence +
            patternConfluence.confidenceModifier +
            ftConflict.confidenceAdjustment +
            sectorComparison.confidenceModifier
        ));
        console.log(`[analyze.ts:202] 🎯 Final Confidence: ${baseConfidence}% → ${adjustedConfidence}% (Adjusted)`);

        // NEW: Breaking news override
        let breakingNewsOverride = false;
        if (enhancedNews.breakingImpact === 'HIGH' && enhancedNews.breakingNews.length > 0) {
            const negativeBreaking = enhancedNews.breakingNews.some(n => n.sentiment === 'negative');
            if (negativeBreaking) {
                breakingNewsOverride = true;
                console.log(`[analyze.ts:210] ⚠️ Breaking negative news detected - capping bullish probability`);
            }
        }

        // Step 4: Generate technical summary for AI
        const technicalSummary = getTechnicalSummary(technicalAnalysis);

        // Step 5: Build enhanced prompt and get AI analysis
        const enhancedPrompt = buildEnhancedPrompt({
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
            multiTimeframe: technicalAnalysis.multiTimeframe
        });

        // Use enhanced AI analysis
        let aiAnalysis = await analyzeWithEnhancedPrompt(enhancedPrompt, stock.symbol);

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

        // Default bullish/bearish scenarios
        const sr = technicalAnalysis.indicators.daily.sr;
        const defaultBullish = {
            probability: confidenceResult.recommendation === 'BUY' ? 65 : 40,
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
            probability: confidenceResult.recommendation === 'SELL' ? 65 : 35,
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
                confidenceScore: aiAnalysis.confidenceScore || adjustedConfidence, // Use adjusted confidence
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

                // NEW: Accuracy metrics
                accuracyMetrics: {
                    baseConfidence: confidenceResult.score,
                    adjustedConfidence,
                    modifiers: {
                        patternConfluence: patternConfluence.confidenceModifier,
                        fundamentalTechnical: ftConflict.confidenceAdjustment,
                        sectorComparison: sectorComparison.confidenceModifier
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
                    breakingNews: {
                        count: enhancedNews.breakingNews.length,
                        impact: enhancedNews.breakingImpact,
                        override: breakingNewsOverride
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
                confidence: confidenceResult.score > 70 ? 'HIGH' : confidenceResult.score > 50 ? 'MEDIUM' : 'LOW',
                category: confidenceResult.score > 65 && (confidenceResult.recommendation === 'BUY' || confidenceResult.recommendation === 'SELL')
                    ? 'STRONG_SETUP'
                    : confidenceResult.score < 40
                        ? 'AVOID'
                        : 'NEUTRAL',
                bullish: aiAnalysis.bullish || defaultBullish,
                bearish: aiAnalysis.bearish || defaultBearish
            }
        };

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

const AI_CACHE = new Map<string, { data: any, timestamp: number }>();
const CACHE_TTL = 1 * 60 * 1000; // 1 minute (as requested)

/**
 * Enhanced AI analysis using Groq with custom prompt and model rotation
 */
async function analyzeWithEnhancedPrompt(prompt: string, symbol: string): Promise<any> {
    // Check cache first
    if (AI_CACHE.has(symbol)) {
        const { data, timestamp } = AI_CACHE.get(symbol)!;
        if (Date.now() - timestamp < CACHE_TTL) {
            console.log(`[EnhancedAI] ⚡ Returning cached analysis for ${symbol}`);
            return data;
        }
        AI_CACHE.delete(symbol); // Expired
    }

    const Groq = (await import('groq-sdk')).default;
    const key = process.env.GROQ_API_KEY;

    if (!key || key === 'demo-key') {
        console.log('[EnhancedAI] No valid API key, skipping AI analysis');
        return null;
    }

    const client = new Groq({ apiKey: key });

    // Models to try in order of preference
    // Only using verified active models to prevent 400 Decommissioned errors
    const models = [
        'llama-3.3-70b-versatile', // Primary
        'llama-3.1-8b-instant',    // Fast fallback
        'llama3-8b-8192'           // Legacy fallback
    ];

    for (const model of models) {
        try {
            console.log(`[EnhancedAI] Analyzing ${symbol} with ${model}...`);

            const completion = await client.chat.completions.create({
                model: model,
                messages: [
                    {
                        role: 'system',
                        content: 'You are a professional stock market analyst. Respond only with valid JSON. No markdown code blocks.'
                    },
                    {
                        role: 'user',
                        content: prompt
                    }
                ],
                temperature: 0.1, // Lower temperature for consistency
                max_tokens: 3000,
            });

            const text = completion.choices[0]?.message?.content;
            if (!text) {
                console.warn(`[EnhancedAI] Empty response from ${model} for ${symbol}`);
                continue; // Try next model
            }

            // Parse JSON from response
            const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
            const start = cleaned.indexOf('{');
            const end = cleaned.lastIndexOf('}');

            if (start === -1 || end === -1) {
                console.warn(`[EnhancedAI] Invalid JSON structure from ${model}`);
                console.debug(`[EnhancedAI] Raw output: ${text.substring(0, 100)}...`);
                continue; // Try next model
            }

            try {
                const parsed = JSON.parse(cleaned.substring(start, end + 1));
                console.log(`[EnhancedAI] ✅ Successfully analyzed ${symbol} using ${model}`);

                // Store in cache
                AI_CACHE.set(symbol, { data: parsed, timestamp: Date.now() });

                // Optional: cleanup old cache entries if too large
                if (AI_CACHE.size > 100) {
                    const oldest = AI_CACHE.keys().next().value;
                    if (oldest) AI_CACHE.delete(oldest);
                }

                return parsed;
            } catch (jsonErr) {
                console.warn(`[EnhancedAI] JSON parse error from ${model}:`, (jsonErr as Error).message);
                // console.debug(`[EnhancedAI] Failed JSON: ${cleaned}`);
                continue;
            }

        } catch (error) {
            const msg = (error as Error).message;
            console.warn(`[EnhancedAI] ⚠️ Failed with ${model}: ${msg}`);

            // If it's a rate limit or server error, try next model.
            // If it's an invalid API key, stop.
            if (msg.includes('401') || msg.includes('API key')) {
                console.error('[EnhancedAI] Invalid API key, stopping.');
                return null;
            }
        }
    }

    console.error(`[EnhancedAI] ❌ All models failed for ${symbol}`);
    return null;
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
