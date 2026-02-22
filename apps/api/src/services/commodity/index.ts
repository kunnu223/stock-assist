/**
 * Commodity Analysis Orchestrator
 * Coordinates all commodity analysis services
 * @module @stock-assist/api/services/commodity
 */

import Groq from 'groq-sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { calcIndicators } from '../indicators';
import { fetchEnhancedNews } from '../news/enhanced';
import type { OHLCData } from '@stock-assist/shared';

import { fetchCommodityData, COMMODITY_SYMBOLS, type CommodityDataBundle, type CommodityPriceData } from './data';
import { analyzeSeasonality, type SeasonalityResult } from './seasonality';
import { analyzeMacroContext, type MacroContext } from './macroContext';
import { detectMarketCrash, type CrashDetectionResult } from './crashDetection';
import { analyzePriceVolume, calculateCommodityConfidence, type PriceVolumeSignal, type CommodityConfidenceResult } from './indicators';
import { buildCommodityPrompt, buildUserFriendlyCommodityPrompt, type CommodityPromptInput } from './prompt';
import { type Exchange, type ExchangePricing, buildExchangePricing, convertPlanPrices, getExchangeInfo, getSupportedExchanges } from './exchange';
import { CommodityPrediction, CommodityPredictionStatus } from '../../models';

export interface CommodityAnalysisResult {
    commodity: string;
    name: string;
    category: string;
    currentPrice: number;
    change: number;
    changePercent: number;
    confidence: number;
    direction: string;
    recommendation: string;
    summary: string;

    signalStrength: {
        stars: 1 | 2 | 3 | 4 | 5;
        aligned: number;
        total: number;
        label: string;
    };

    tradeability: {
        canTrade: boolean;
        reason: string;
        suggestion: string;
    };

    accuracy: {
        total: number;
        winRate: number;
        pnl: number;
    };

    macroContext: {
        usd: {
            value: number;
            change: number;
            trend30d: string;
            impact: string;
        };
        ratios: Array<{ name: string; ratio: number; interpretation: string; signal: string }>;
        overallBias: string;
    };

    commodityIndicators: {
        seasonality: {
            currentMonth: string;
            bias: string;
            winRate: number;
            explanation: string;
            nextMonth: string;
            nextMonthBias: string;
            quarterOutlook: string;
        };
        priceVolume: {
            signal: string;
            description: string;
        };
        confidenceBreakdown: {
            technical: number;
            seasonality: number;
            macro: number;
            priceVolume: number;
            crashRisk: number;
        };
        factors: string[];
    };

    multiHorizonPlan: {
        today: any;
        tomorrow: any;
        nextWeek: any;
    };

    crashDetection: {
        overallRisk: string;
        probability: number;
        signals: Array<{
            name: string;
            triggered: boolean;
            severity: string;
            description: string;
        }>;
        recommendations: string[];
    };

    technicals: {
        rsi: number;
        rsiInterpretation: string;
        macdTrend: string;
        maTrend: string;
        support: number;
        resistance: number;
        atr: number;
        volumeTrend: string;
    };

    newsSentiment: string;

    rawPrompt?: string;

    exchangePricing: ExchangePricing;

    metadata: {
        analysisTime: number;
        dataPoints: number;
        aiModel: string;
        timestamp: string;
        exchange: string;
    };
}

/**
 * Parse AI JSON response
 */
function parseAIResponse(text: string): any | null {
    try {
        let clean = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        const start = clean.indexOf('{');
        const end = clean.lastIndexOf('}');
        if (start === -1 || end === -1) return null;
        return JSON.parse(clean.substring(start, end + 1));
    } catch {
        return null;
    }
}

/**
 * Run commodity AI analysis directly (Groq â†’ Gemini fallback)
 * Uses custom commodity prompt instead of stock prompt
 */
async function runCommodityAI(promptText: string): Promise<{ result: any; model: string }> {

    // â”€â”€ Try Groq first â”€â”€
    const groqKey = process.env.GROQ_API_KEY;
    if (groqKey && groqKey !== 'demo-key') {
        const models = ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant'];
        try {
            const client = new Groq({ apiKey: groqKey });
            for (const model of models) {
                try {
                    console.log(`[Commodity AI] Trying Groq ${model}...`);
                    const completion = await client.chat.completions.create({
                        model,
                        messages: [
                            { role: 'system', content: 'You are an expert commodity futures analyst. Respond ONLY with valid JSON. No markdown.' },
                            { role: 'user', content: promptText },
                        ],
                        temperature: 0.25,
                        max_tokens: 4500,
                    });
                    const text = completion.choices[0]?.message?.content;
                    if (text) {
                        const parsed = parseAIResponse(text);
                        if (parsed) {
                            console.log(`[Commodity AI] âœ… Groq ${model} success`);
                            return { result: parsed, model: `groq-${model}` };
                        }
                    }
                } catch (err) {
                    const msg = (err as Error).message;
                    if (msg.includes('429')) continue; // Rate limit, try next
                    if (msg.includes('401')) break;    // Bad key, stop
                    console.warn(`[Commodity AI] Groq ${model} failed: ${msg}`);
                }
            }
        } catch (err) {
            console.warn(`[Commodity AI] Groq init failed:`, (err as Error).message);
        }
    }

    // â”€â”€ Fallback to Gemini â”€â”€
    const geminiKey = process.env.GEMINI_API_KEY;
    if (geminiKey && geminiKey !== 'demo-key') {
        try {
            console.log(`[Commodity AI] Falling back to Gemini...`);
            const genAI = new GoogleGenerativeAI(geminiKey);
            const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
            const result = await model.generateContent(promptText);
            const text = result.response.text();
            if (text) {
                const parsed = parseAIResponse(text);
                if (parsed) {
                    console.log(`[Commodity AI] âœ… Gemini success`);
                    return { result: parsed, model: 'gemini-2.0-flash' };
                }
            }
        } catch (err) {
            console.warn(`[Commodity AI] Gemini failed:`, (err as Error).message);
        }
    }

    console.warn(`[Commodity AI] âŒ All AI models failed â€” using system analysis only`);
    return { result: null, model: 'none' };
}

/**
 * Main orchestrator: analyze a commodity
 * @param symbol - Commodity symbol (GOLD, SILVER, etc.)
 * @param exchange - Exchange variant: COMEX (default), MCX, SPOT
 * @param language - Language code (en, hi)
 */
export async function analyzeCommodity(symbol: string, exchange: Exchange = 'COMEX', language?: string): Promise<CommodityAnalysisResult> {
    const startTime = Date.now();
    const key = symbol.toUpperCase().replace(/\s+/g, '');

    if (!COMMODITY_SYMBOLS[key]) {
        throw new Error(`Unsupported commodity: ${symbol}. Supported: ${Object.keys(COMMODITY_SYMBOLS).join(', ')}`);
    }

    const exchangeInfo = getExchangeInfo(exchange, key);
    console.log(`\n[Commodity] â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•`);
    console.log(`[Commodity] ðŸª™ Analyzing ${COMMODITY_SYMBOLS[key].name} (${key}) on ${exchangeInfo.label} (${language || 'en'})`);
    console.log(`[Commodity] â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•\n`);

    // â”€â”€ Stage 1: Parallel Data Fetch â”€â”€
    console.log(`[Commodity] ðŸ“Š Stage 1: Fetching data...`);
    const [dataBundle, newsResult, accuracyStats] = await Promise.all([
        fetchCommodityData(key),
        fetchEnhancedNews(key).catch(() => ({
            items: [] as any[],
            breakingNews: [] as any[],
            recentNews: [] as any[],
            breakingImpact: 'NONE' as const,
            sentiment: 'neutral' as const,
            sentimentScore: 50,
            impactLevel: 'low' as const,
            latestHeadlines: [] as string[],
            dataFreshness: 0,
        })),
        fetchAccuracyStats(key)
    ]);

    // â”€â”€ Stage 2: Technical Analysis â”€â”€
    console.log(`[Commodity] ðŸ“ˆ Stage 2: Technical analysis (${dataBundle.commodity.history.length} daily bars)...`);
    const indicators = calcIndicators(dataBundle.commodity.history);
    const weeklyIndicators = dataBundle.commodity.weeklyHistory.length >= 10
        ? calcIndicators(dataBundle.commodity.weeklyHistory)
        : undefined;

    // â”€â”€ Stage 3: Commodity-Specific Analysis â”€â”€
    console.log(`[Commodity] ðŸ” Stage 3: Commodity-specific analysis...`);
    const seasonality = analyzeSeasonality(key);
    const macro = analyzeMacroContext(dataBundle.commodity, dataBundle.dxy, dataBundle.correlatedPrices);
    const priceVolume = analyzePriceVolume(dataBundle.commodity.history);

    // â”€â”€ Stage 4: Crash Detection â”€â”€
    console.log(`[Commodity] ðŸš¨ Stage 4: Crash detection...`);
    const allHistories = new Map<string, OHLCData[]>();
    allHistories.set(key, dataBundle.commodity.history);
    const highSeverityNewsCount = (newsResult.items || []).filter(
        (n: any) => Math.abs((n.sentimentScore || 50) - 50) > 25
    ).length;
    const crash = detectMarketCrash(dataBundle.commodity, dataBundle.dxy, allHistories, highSeverityNewsCount);

    // â”€â”€ Stage 5: Confidence Scoring â”€â”€
    console.log(`[Commodity] ðŸŽ¯ Stage 5: Confidence scoring...`);
    const confidence = calculateCommodityConfidence(
        indicators, seasonality, macro, priceVolume, crash, weeklyIndicators
    );
    console.log(`[Commodity] Confidence: ${confidence.score}% | Direction: ${confidence.direction} | Rec: ${confidence.recommendation}`);

    // â”€â”€ Stage 6: Exchange Pricing (moved before AI so prompt gets correct currency) â”€â”€
    console.log(`[Commodity] ðŸ’± Stage 6: Exchange pricing (${exchangeInfo.label})...`);
    const exchangePricing = await buildExchangePricing(
        key, exchange,
        {
            currentPrice: dataBundle.commodity.currentPrice,
            change: dataBundle.commodity.change,
            changePercent: dataBundle.commodity.changePercent,
            dayHigh: dataBundle.commodity.dayHigh,
            dayLow: dataBundle.commodity.dayLow,
        },
        {
            support: indicators.sr.support,
            resistance: indicators.sr.resistance,
            atr: indicators.atr,
        }
    );

    // â”€â”€ Stage 7: AI Multi-Horizon Analysis â”€â”€
    console.log(`[Commodity] ðŸ¤– Stage 7: AI multi-horizon analysis...`);
    const newsHeadlines = (newsResult.latestHeadlines || []).slice(0, 5);
    const promptInput: CommodityPromptInput = {
        commodity: dataBundle.commodity,
        dxy: dataBundle.dxy,
        indicators,
        weeklyIndicators,
        seasonality,
        macro,
        priceVolume,
        confidence,
        crash,
        newsHeadlines,
        language,
        exchange,
        exchangePricing: exchange !== 'COMEX' ? {
            currencySymbol: exchangePricing.currencySymbol,
            currency: exchangePricing.currency,
            unit: exchangePricing.unit,
            price: exchangePricing.price,
            dayHigh: exchangePricing.dayHigh,
            dayLow: exchangePricing.dayLow,
            support: exchangePricing.support,
            resistance: exchangePricing.resistance,
            atr: exchangePricing.atr,
        } : undefined,
    };

    const promptText = buildCommodityPrompt(promptInput);
    const { result: aiResult, model: aiModel } = await runCommodityAI(promptText);

    // Build the multi-horizon plan
    const fallbackToday = buildFallbackToday(confidence, indicators, dataBundle.commodity);
    const fallbackTomorrow = buildFallbackTomorrow(confidence, indicators, dataBundle.commodity);
    const fallbackNextWeek = buildFallbackNextWeek(confidence, seasonality);

    // Fill nextWeek targetRange from actual data
    const price = dataBundle.commodity.currentPrice;
    const atr = indicators.atr || price * 0.015;
    if (fallbackNextWeek.targetRange[0] === 0) {
        fallbackNextWeek.targetRange = [
            Math.round((price - atr * 3) * 100) / 100,
            Math.round((price + atr * 3) * 100) / 100,
        ];
    }
    if (fallbackNextWeek.planB.recoveryTarget === 0) {
        fallbackNextWeek.planB.recoveryTarget = Math.round(price * 100) / 100;
    }

    const usedAiToday = !!aiResult?.today;
    const usedAiTomorrow = !!aiResult?.tomorrow;
    const usedAiNextWeek = !!aiResult?.nextWeek;

    const rawPlan = {
        today: aiResult?.today || fallbackToday,
        tomorrow: aiResult?.tomorrow || fallbackTomorrow,
        nextWeek: aiResult?.nextWeek || fallbackNextWeek,
    };

    // Convert prices for non-COMEX exchanges:
    // - If AI responded: AI already gave prices in the target currency (we fed it INR data), skip conversion
    // - If fallback: Prices are in USD (from COMEX data), need conversion
    const needsConversion = exchange !== 'COMEX' && (!usedAiToday || !usedAiTomorrow || !usedAiNextWeek);
    const convertedPlan = needsConversion
        ? await convertPlanPrices(rawPlan, key, exchange)
        : rawPlan;

    // â”€â”€ Stage 8: Response Assembly â”€â”€
    const elapsed = Date.now() - startTime;
    console.log(`[Commodity] âœ… Analysis complete in ${(elapsed / 1000).toFixed(1)}s (model: ${aiModel}, exchange: ${exchange})`);

    // Fix #1: Reconcile AI + system scores (not naive average)
    let finalConfidence: number;
    if (aiResult?.confidenceScore) {
        const aiScore = aiResult.confidenceScore;
        const sysScore = confidence.score;
        const aiDirection = (aiResult.overallBias || '').toUpperCase();
        const sysDirection = confidence.direction;

        // If both agree on direction, boost confidence
        if (aiDirection === sysDirection) {
            finalConfidence = Math.round(Math.max(aiScore, sysScore) * 0.7 + Math.min(aiScore, sysScore) * 0.3);
        }
        // If they disagree on direction, penalize heavily
        else if (aiDirection && aiDirection !== 'NEUTRAL' && sysDirection !== 'NEUTRAL') {
            finalConfidence = Math.round(Math.min(aiScore, sysScore) * 0.6);
            confidence.factors.push('\u26a0\ufe0f AI and system disagree on direction \u2014 confidence reduced');
        }
        // One is neutral — lean toward the decisive one but moderate
        else {
            finalConfidence = Math.round((aiScore + sysScore) / 2 * 0.85);
        }
        finalConfidence = Math.max(15, Math.min(95, finalConfidence));
    } else {
        finalConfidence = confidence.score;
    }

    const analysisResult: CommodityAnalysisResult = {
        commodity: key,
        name: COMMODITY_SYMBOLS[key].name,
        category: COMMODITY_SYMBOLS[key].category,
        currentPrice: exchangePricing.price,
        change: exchangePricing.change,
        changePercent: exchangePricing.changePercent,
        confidence: finalConfidence,
        direction: aiResult?.overallBias || confidence.direction,
        recommendation: confidence.recommendation,
        summary: aiResult?.summary || `${COMMODITY_SYMBOLS[key].name} analysis: ${confidence.direction} with ${confidence.score}% confidence`,

        signalStrength: confidence.signalStrength,
        tradeability: confidence.tradeability,
        accuracy: accuracyStats,

        macroContext: {
            usd: {
                value: dataBundle.dxy.currentValue,
                change: dataBundle.dxy.change,
                trend30d: dataBundle.dxy.trend30d,
                impact: macro.usdCorrelation.impact,
            },
            ratios: macro.ratios.map(r => ({ name: r.name, ratio: r.ratio, interpretation: r.interpretation, signal: r.signal })),
            overallBias: macro.overallBias,
        },

        commodityIndicators: {
            seasonality: {
                currentMonth: seasonality.currentMonth.monthName,
                bias: seasonality.currentMonth.bias,
                winRate: seasonality.currentMonth.winRate,
                explanation: seasonality.currentMonth.explanation,
                nextMonth: seasonality.nextMonth.monthName,
                nextMonthBias: seasonality.nextMonth.bias,
                quarterOutlook: seasonality.quarterOutlook,
            },
            priceVolume: {
                signal: priceVolume.signal,
                description: priceVolume.description,
            },
            confidenceBreakdown: confidence.breakdown,
            factors: confidence.factors,
        },

        multiHorizonPlan: convertedPlan,

        crashDetection: {
            overallRisk: crash.overallRisk,
            probability: crash.probability,
            signals: crash.signals.map(s => ({
                name: s.name,
                triggered: s.triggered,
                severity: s.severity,
                description: s.description,
            })),
            recommendations: crash.recommendations,
        },

        technicals: {
            rsi: indicators.rsi.value,
            rsiInterpretation: indicators.rsi.interpretation,
            macdTrend: indicators.macd.trend,
            maTrend: indicators.ma.trend,
            support: exchangePricing.support,
            resistance: exchangePricing.resistance,
            atr: exchangePricing.atr,
            volumeTrend: indicators.volume.trend,
        },

        newsSentiment: aiResult?.newsSentiment || newsResult.sentiment || 'neutral',

        // User-friendly prompt for copying to other AI tools
        rawPrompt: buildUserFriendlyCommodityPrompt(promptInput),

        exchangePricing,

        metadata: {
            analysisTime: elapsed,
            dataPoints: dataBundle.commodity.history.length,
            aiModel,
            timestamp: new Date().toISOString(),
            exchange,
        },
    };

    // Auto-save actionable prediction & Update pending ones (fire-and-forget)
    Promise.all([
        saveCommodityPrediction(analysisResult),
        updatePendingPredictions(key, dataBundle.commodity.history)
    ]).catch(err => console.error('[Commodity] Backtest update error:', err));

    return analysisResult;
}

/**
 * Save actionable prediction for backtesting
 */
async function saveCommodityPrediction(result: CommodityAnalysisResult) {
    // Only save strictly actionable signals
    if (result.recommendation === 'HOLD' || result.recommendation === 'WAIT') return;
    if (!result.tradeability.canTrade) return;

    try {
        const todayPlan = result.multiHorizonPlan.today;
        if (!todayPlan) return;

        // Calculate entry average if range
        const entry = Array.isArray(todayPlan.entry)
            ? (todayPlan.entry[0] + todayPlan.entry[1]) / 2
            : todayPlan.entry;

        await CommodityPrediction.create({
            symbol: result.commodity,
            exchange: result.metadata.exchange,
            direction: result.direction,
            recommendation: result.recommendation,
            confidence: result.confidence,
            signalStars: result.signalStrength.stars,
            entryPrice: entry,
            targetPrice: todayPlan.target,
            stopLoss: todayPlan.stopLoss,
            status: CommodityPredictionStatus.PENDING,
        });
    } catch (error) {
        // Silent fail if DB not connected
    }
}

/**
 * Fetch historical accuracy stats for a commodity
 */
async function fetchAccuracyStats(symbol: string) {
    try {
        const stats = await CommodityPrediction.aggregate([
            { $match: { symbol: symbol, status: { $ne: 'PENDING' } } },
            {
                $group: {
                    _id: null,
                    total: { $sum: 1 },
                    wins: { $sum: { $cond: [{ $eq: ['$status', 'TARGET_HIT'] }, 1, 0] } },
                    avgPnl: { $avg: '$pnlPercent' }
                }
            }
        ]);
        if (stats.length > 0 && stats[0]) {
            return {
                total: stats[0].total,
                winRate: stats[0].total > 0 ? Math.round((stats[0].wins / stats[0].total) * 100) : 0,
                pnl: Math.round((stats[0].avgPnl || 0) * 100) / 100
            };
        }
    } catch (e) { }
    return { total: 0, winRate: 0, pnl: 0 };
}



/**
 * Check and update pending predictions based on fresh history
 */
async function updatePendingPredictions(symbol: string, history: OHLCData[]) {
    try {
        const pending = await CommodityPrediction.find({
            symbol,
            status: CommodityPredictionStatus.PENDING
        });

        const EXPIRY_DAYS = 7; // Fix #3: Expire after 7 trading days

        for (const pred of pending) {
            // Find history bars since prediction date
            const relevantBars = history.filter(bar => new Date(bar.date) > pred.date);

            // Fix #3: Expire old predictions (7 trading days = ~10 calendar days)
            if (relevantBars.length >= EXPIRY_DAYS) {
                const lastBar = relevantBars[relevantBars.length - 1];
                pred.status = CommodityPredictionStatus.EXPIRED;
                pred.outcomePrice = lastBar.close;
                pred.outcomeDate = new Date(lastBar.date);
                pred.pnlPercent = pred.direction === 'BULLISH'
                    ? ((lastBar.close - pred.entryPrice) / pred.entryPrice) * 100
                    : ((pred.entryPrice - lastBar.close) / pred.entryPrice) * 100;
                await pred.save();
                continue;
            }

            if (relevantBars.length === 0) continue;

            for (const bar of relevantBars) {
                // Check Target
                if (pred.direction === 'BULLISH') {
                    if (bar.high >= pred.targetPrice) {
                        pred.status = CommodityPredictionStatus.TARGET_HIT;
                        pred.outcomePrice = pred.targetPrice;
                        pred.outcomeDate = new Date(bar.date);
                        pred.pnlPercent = ((pred.targetPrice - pred.entryPrice) / pred.entryPrice) * 100;
                        await pred.save();
                        break;
                    }
                    if (bar.low <= pred.stopLoss) {
                        pred.status = CommodityPredictionStatus.STOP_HIT;
                        pred.outcomePrice = pred.stopLoss;
                        pred.outcomeDate = new Date(bar.date);
                        pred.pnlPercent = ((pred.stopLoss - pred.entryPrice) / pred.entryPrice) * 100;
                        await pred.save();
                        break;
                    }
                } else if (pred.direction === 'BEARISH') {
                    if (bar.low <= pred.targetPrice) {
                        pred.status = CommodityPredictionStatus.TARGET_HIT;
                        pred.outcomePrice = pred.targetPrice;
                        pred.outcomeDate = new Date(bar.date);
                        pred.pnlPercent = ((pred.entryPrice - pred.targetPrice) / pred.entryPrice) * 100;
                        await pred.save();
                        break;
                    }
                    if (bar.high >= pred.stopLoss) {
                        pred.status = CommodityPredictionStatus.STOP_HIT;
                        pred.outcomePrice = pred.stopLoss;
                        pred.outcomeDate = new Date(bar.date);
                        pred.pnlPercent = ((pred.entryPrice - pred.stopLoss) / pred.entryPrice) * 100;
                        await pred.save();
                        break;
                    }
                }
            }
        }
    } catch (e) {
        console.error(`[Backtest] Error updating ${symbol}:`, e);
    }
}

function buildFallbackToday(
    confidence: CommodityConfidenceResult,
    indicators: any,
    commodity: CommodityPriceData
) {
    const price = commodity.currentPrice;
    const atr = indicators.atr || price * 0.015;
    const isBullish = confidence.direction === 'BULLISH';

    // Fix #6: Wider entry range for commodity volatility (was ±0.15 ATR)
    const entryLow = price - atr * 0.3;
    const entryHigh = price + atr * 0.3;
    const stopLoss = isBullish ? price - atr * 1.2 : price + atr * 1.2;
    const target = isBullish ? price + atr * 2.0 : price - atr * 2.0;

    const rsiVal = indicators.rsi?.value?.toFixed(0) || '50';
    const maTrend = indicators.ma?.trend || 'Neutral';

    return {
        action: confidence.recommendation,
        reasoning: `${commodity.name} current price at key level. RSI ${rsiVal} (${indicators.rsi?.interpretation || 'neutral'}), ${maTrend} MA trend. System confidence ${confidence.score}%.`,
        confidence: confidence.score,
        urgency: confidence.score >= 75 ? 'ACT_NOW' : confidence.score >= 55 ? 'MONITOR' : 'WAIT',
        entry: [Math.round(entryLow * 100) / 100, Math.round(entryHigh * 100) / 100],
        stopLoss: Math.round(stopLoss * 100) / 100,
        target: Math.round(target * 100) / 100,
        risks: ['AI analysis unavailable â€” fallback levels based on technicals only'],
        validity: 'Until market close',
        planB: {
            scenario: `Price moves ${(atr / price * 100).toFixed(1)}% against position (1 ATR)`,
            action: 'HOLD',
            reasoning: 'Within normal ATR volatility range â€” hold unless key support/resistance breaks',
            recoveryTarget: Math.round(price * 100) / 100,
            maxLoss: `${(atr * 1.5 / price * 100).toFixed(1)}% of position`,
            timeline: '1-2 trading sessions',
            steps: [
                `If drops < ${(atr * 0.5 / price * 100).toFixed(1)}%: Hold â€” normal intraday volatility`,
                `If drops ${(atr * 0.5 / price * 100).toFixed(1)}-${(atr / price * 100).toFixed(1)}%: Tighten stop to entry level`,
                `If drops > ${(atr * 1.5 / price * 100).toFixed(1)}%: Exit immediately â€” max loss reached`,
            ],
        },
    };
}

function buildFallbackTomorrow(
    confidence: CommodityConfidenceResult,
    indicators: any,
    commodity: CommodityPriceData
) {
    const price = commodity.currentPrice;
    const atr = indicators.atr || price * 0.015;
    const isBullish = confidence.direction === 'BULLISH';

    const triggerLevel = isBullish ? price + atr * 0.3 : price - atr * 0.3;
    const entryLow = price - atr * 0.2;
    const entryHigh = price + atr * 0.2;
    const stopLoss = isBullish ? price - atr * 1.2 : price + atr * 1.2;
    const target = isBullish ? price + atr * 2.5 : price - atr * 2.5;

    return {
        action: `${confidence.recommendation} (if confirmed)`,
        confidence: Math.max(20, confidence.score - 10),
        conditions: [{
            trigger: `Price ${isBullish ? 'sustains above' : 'breaks below'} ${Math.round(triggerLevel * 100) / 100} with volume`,
            action: confidence.recommendation,
            entry: [Math.round(entryLow * 100) / 100, Math.round(entryHigh * 100) / 100],
            stopLoss: Math.round(stopLoss * 100) / 100,
            target: Math.round(target * 100) / 100,
        }],
        watchLevels: [
            Math.round((price - atr) * 100) / 100,
            Math.round(price * 100) / 100,
            Math.round((price + atr) * 100) / 100,
        ],
        newsToWatch: ['Economic data releases', 'USD/DXY movement'],
        planB: {
            scenario: 'Previous trade moved against you overnight',
            action: 'EXIT',
            reasoning: 'If today\'s thesis failed, cut losses early on next session open',
            recoveryTarget: Math.round(price * 100) / 100,
            maxLoss: `${(atr * 1.5 / price * 100).toFixed(1)}% of position`,
            timeline: 'First 30 minutes of trading session',
            steps: [
                'On open: Check if price gapped against your position',
                `If within ${(atr * 0.5 / price * 100).toFixed(1)}% of entry: Hold with tighter stop`,
                `If beyond ${(atr * 1.5 / price * 100).toFixed(1)}%: Exit on first retracement`,
            ],
        },
    };
}

function buildFallbackNextWeek(
    confidence: CommodityConfidenceResult,
    seasonality: SeasonalityResult
) {
    // Estimate some price levels from confidence
    // We don't have price here, so keep generic
    return {
        scenario: confidence.direction === 'BULLISH' ? 'BULLISH' : confidence.direction === 'BEARISH' ? 'BEARISH' : 'RANGE_BOUND',
        probability: Math.max(50, confidence.score - 5),
        reasoning: `System confidence at ${confidence.score}%. ${seasonality.currentMonth.monthName} seasonality: ${seasonality.currentMonth.bias}. ${seasonality.currentMonth.explanation}`,
        targetRange: [0, 0], // Will be filled by caller
        strategy: confidence.recommendation === 'BUY' ? 'Buy dips near support levels' : confidence.recommendation === 'SELL' ? 'Sell rallies near resistance levels' : 'Range trade between support and resistance',
        keyEvents: [],
        planB: {
            scenario: 'Weekly thesis breaks down â€” trend reversal detected',
            action: 'REDUCE',
            reasoning: 'If weekly direction reverses, reduce position size by 50% and reassess',
            recoveryTarget: 0, // Will be filled by caller
            maxLoss: '3-5% of total position',
            timeline: '1-2 weeks',
            steps: [
                'Day 1-2 of reversal: Reduce position by 25%',
                'Day 3 of continued reversal: Reduce another 25%',
                'If reversal extends beyond 5 sessions: Exit remaining and wait for new setup',
            ],
        },
    };
}

// Re-export types
export { COMMODITY_SYMBOLS } from './data';
export type { CommodityPromptInput } from './prompt';
export type { Exchange, ExchangePricing, ExchangeInfo } from './exchange';
export { getSupportedExchanges } from './exchange';
