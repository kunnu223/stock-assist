/**
 * AI Service - Main export
 * @module @stock-assist/api/services/ai
 */

import type { StockAnalysis } from '@stock-assist/shared';
import { analyzeWithGroq } from './groq';
import { analyzeWithGemini } from './gemini';
import type { PromptInput } from './prompt';

/** Analyze stock using AI (with fallback) */
export const analyzeWithAI = async (input: PromptInput): Promise<StockAnalysis> => {
    // Try Groq first (faster, better rate limits)
    const groqResult = await analyzeWithGroq(input);
    if (groqResult) {
        return groqResult;
    }

    // Fallback to Gemini
    console.log(`[AI Service] Groq failed, trying Gemini for ${input.stock.symbol}`);
    const geminiResult = await analyzeWithGemini(input);
    if (geminiResult) {
        return geminiResult;
    }

    console.log(`[AI Service] Using Fallback analysis for ${input.stock.symbol}`);
    // Fallback: generate basic analysis without AI
    return generateFallback(input);
};

/** Generate fallback analysis */
const generateFallback = (input: PromptInput): StockAnalysis => {
    const { stock, indicators, patterns } = input;
    const { quote } = stock;
    const { rsi, ma, sr } = indicators;

    let bullScore = 50, bearScore = 50;

    if (rsi.value > 50) bullScore += 10;
    else bearScore += 10;

    if (ma.trend === 'bullish') bullScore += 15;
    else if (ma.trend === 'bearish') bearScore += 15;

    if (patterns.primary?.type === 'bullish') bullScore += 20;
    else if (patterns.primary?.type === 'bearish') bearScore += 20;

    const total = bullScore + bearScore;
    const bullProb = Math.round((bullScore / total) * 100);
    const bearProb = 100 - bullProb;

    const bias = bullProb > 60 ? 'BULLISH' : bearProb > 60 ? 'BEARISH' : 'NEUTRAL';

    return {
        stock: quote.symbol,
        currentPrice: quote.price,
        bias,
        confidence: 'LOW',
        confidenceScore: Math.max(bullProb, bearProb),
        category: 'NEUTRAL',
        recommendation: `Watch ${sr.resistance} resistance and ${sr.support} support`,
        bullish: {
            probability: bullProb,
            score: bullScore,
            trigger: `Break above ₹${sr.resistance}`,
            confirmation: 'Close above with volume',
            tradePlan: {
                action: 'BUY',
                entry: [sr.resistance, sr.resistance * 1.01],
                stopLoss: sr.support,
                stopLossPercent: 1.5,
                targets: [{ price: sr.resistance * 1.02, probability: 60 }],
                riskReward: 1.5,
                potentialProfit: [100, 300],
            },
            factors: [ma.trend, patterns.trend.direction],
            timeHorizon: '2-5 days',
        },
        bearish: {
            probability: bearProb,
            score: bearScore,
            trigger: `Break below ₹${sr.support}`,
            confirmation: 'Close below with volume',
            tradePlan: {
                action: 'AVOID',
                entry: [sr.support * 0.99, sr.support],
                stopLoss: sr.resistance,
                stopLossPercent: 1.5,
                targets: [{ price: sr.support * 0.98, probability: 50 }],
                riskReward: 1.2,
                potentialProfit: [50, 150],
            },
            factors: ['Support breakdown risk'],
            timeHorizon: '1-3 days',
        },
        newsSentiment: 'neutral',
    };
};

export { analyzeWithGroq } from './groq';
export { analyzeWithGemini } from './gemini';
export { buildPrompt, type PromptInput } from './prompt';
