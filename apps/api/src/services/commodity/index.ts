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
import { buildCommodityPrompt, type CommodityPromptInput } from './prompt';
import { type Exchange, type ExchangePricing, buildExchangePricing, convertPlanPrices, getExchangeInfo, getSupportedExchanges } from './exchange';

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
 * Run commodity AI analysis directly (Groq → Gemini fallback)
 * Uses custom commodity prompt instead of stock prompt
 */
async function runCommodityAI(promptText: string): Promise<{ result: any; model: string }> {

    // ── Try Groq first ──
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
                        max_tokens: 3000,
                    });
                    const text = completion.choices[0]?.message?.content;
                    if (text) {
                        const parsed = parseAIResponse(text);
                        if (parsed) {
                            console.log(`[Commodity AI] ✅ Groq ${model} success`);
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

    // ── Fallback to Gemini ──
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
                    console.log(`[Commodity AI] ✅ Gemini success`);
                    return { result: parsed, model: 'gemini-2.0-flash' };
                }
            }
        } catch (err) {
            console.warn(`[Commodity AI] Gemini failed:`, (err as Error).message);
        }
    }

    console.warn(`[Commodity AI] ❌ All AI models failed — using system analysis only`);
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
    console.log(`\n[Commodity] ═══════════════════════════════════════`);
    console.log(`[Commodity] 🪙 Analyzing ${COMMODITY_SYMBOLS[key].name} (${key}) on ${exchangeInfo.label} (${language || 'en'})`);
    console.log(`[Commodity] ═══════════════════════════════════════\n`);

    // ── Stage 1: Parallel Data Fetch ──
    console.log(`[Commodity] 📊 Stage 1: Fetching data...`);
    const [dataBundle, newsResult] = await Promise.all([
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
    ]);

    // ── Stage 2: Technical Analysis ──
    console.log(`[Commodity] 📈 Stage 2: Technical analysis (${dataBundle.commodity.history.length} daily bars)...`);
    const indicators = calcIndicators(dataBundle.commodity.history);
    const weeklyIndicators = dataBundle.commodity.weeklyHistory.length >= 10
        ? calcIndicators(dataBundle.commodity.weeklyHistory)
        : undefined;

    // ── Stage 3: Commodity-Specific Analysis ──
    console.log(`[Commodity] 🔍 Stage 3: Commodity-specific analysis...`);
    const seasonality = analyzeSeasonality(key);
    const macro = analyzeMacroContext(dataBundle.commodity, dataBundle.dxy, dataBundle.correlatedPrices);
    const priceVolume = analyzePriceVolume(dataBundle.commodity.history);

    // ── Stage 4: Crash Detection ──
    console.log(`[Commodity] 🚨 Stage 4: Crash detection...`);
    const allHistories = new Map<string, OHLCData[]>();
    allHistories.set(key, dataBundle.commodity.history);
    const highSeverityNewsCount = (newsResult.items || []).filter(
        (n: any) => Math.abs((n.sentimentScore || 50) - 50) > 25
    ).length;
    const crash = detectMarketCrash(dataBundle.commodity, dataBundle.dxy, allHistories, highSeverityNewsCount);

    // ── Stage 5: Confidence Scoring ──
    console.log(`[Commodity] 🎯 Stage 5: Confidence scoring...`);
    const confidence = calculateCommodityConfidence(
        indicators, seasonality, macro, priceVolume, crash, weeklyIndicators
    );
    console.log(`[Commodity] Confidence: ${confidence.score}% | Direction: ${confidence.direction} | Rec: ${confidence.recommendation}`);

    // ── Stage 6: AI Multi-Horizon Analysis ──
    console.log(`[Commodity] 🤖 Stage 6: AI multi-horizon analysis...`);
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
    };

    const promptText = buildCommodityPrompt(promptInput);
    const { result: aiResult, model: aiModel } = await runCommodityAI(promptText);

    // ── Stage 7: Exchange Pricing ──
    console.log(`[Commodity] 💱 Stage 7: Exchange pricing (${exchangeInfo.label})...`);
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

    // Convert multi-horizon plan prices if needed
    const convertedPlan = await convertPlanPrices(
        {
            today: aiResult?.today || buildFallbackToday(confidence, indicators, dataBundle.commodity),
            tomorrow: aiResult?.tomorrow || buildFallbackTomorrow(confidence, indicators, dataBundle.commodity),
            nextWeek: aiResult?.nextWeek || buildFallbackNextWeek(confidence, seasonality),
        },
        key, exchange
    );

    // ── Stage 8: Response Assembly ──
    const elapsed = Date.now() - startTime;
    console.log(`[Commodity] ✅ Analysis complete in ${(elapsed / 1000).toFixed(1)}s (model: ${aiModel}, exchange: ${exchange})`);

    // Average AI + system confidence
    const finalConfidence = aiResult?.confidenceScore
        ? Math.round((aiResult.confidenceScore + confidence.score) / 2)
        : confidence.score;

    return {
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

        exchangePricing,

        metadata: {
            analysisTime: elapsed,
            dataPoints: dataBundle.commodity.history.length,
            aiModel,
            timestamp: new Date().toISOString(),
            exchange,
        },
    };
}

// ── Fallback generators (when AI fails) ──

function buildFallbackToday(
    confidence: CommodityConfidenceResult,
    indicators: any,
    commodity: CommodityPriceData
) {
    return {
        action: confidence.recommendation,
        reasoning: `${commodity.name} at $${commodity.currentPrice.toFixed(2)}. RSI ${indicators.rsi.value.toFixed(0)}, ${indicators.ma.trend} MA trend.`,
        confidence: confidence.score,
        urgency: confidence.score >= 75 ? 'ACT_NOW' : confidence.score >= 55 ? 'MONITOR' : 'WAIT',
        entry: [commodity.currentPrice * 0.998, commodity.currentPrice * 1.002],
        stopLoss: indicators.sr.support,
        target: indicators.sr.resistance,
        risks: ['AI analysis unavailable — use technical levels only'],
        validity: 'Until market close',
    };
}

function buildFallbackTomorrow(
    confidence: CommodityConfidenceResult,
    indicators: any,
    commodity: CommodityPriceData
) {
    return {
        action: `${confidence.recommendation} (if confirmed)`,
        confidence: Math.max(20, confidence.score - 10),
        conditions: [{
            trigger: `Price ${confidence.direction === 'BULLISH' ? 'above' : 'below'} $${indicators.sr.resistance.toFixed(2)} with volume`,
            action: confidence.recommendation,
            entry: [commodity.currentPrice * 0.995, commodity.currentPrice * 1.005],
            stopLoss: indicators.sr.support,
            target: indicators.sr.resistance * 1.01,
        }],
        watchLevels: [indicators.sr.support, indicators.sr.pivot, indicators.sr.resistance],
        newsToWatch: ['Economic data releases', 'USD/DXY movement'],
    };
}

function buildFallbackNextWeek(
    confidence: CommodityConfidenceResult,
    seasonality: SeasonalityResult
) {
    return {
        scenario: confidence.direction === 'BULLISH' ? 'BULLISH' : confidence.direction === 'BEARISH' ? 'BEARISH' : 'RANGE_BOUND',
        probability: Math.max(50, confidence.score - 5),
        reasoning: `System confidence at ${confidence.score}%. ${seasonality.currentMonth.monthName} seasonality: ${seasonality.currentMonth.bias}.`,
        targetRange: [0, 0],
        strategy: confidence.recommendation === 'BUY' ? 'Buy dips to support' : confidence.recommendation === 'SELL' ? 'Sell rallies to resistance' : 'Range trade between S/R',
        keyEvents: [],
    };
}

// Re-export types
export { COMMODITY_SYMBOLS } from './data';
export type { CommodityPromptInput } from './prompt';
export type { Exchange, ExchangePricing, ExchangeInfo } from './exchange';
export { getSupportedExchanges } from './exchange';
