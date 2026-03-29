/**
 * Response Builder — constructs analysis response shapes
 * Extracted from analyze.ts for single responsibility
 * @module @stock-assist/api/services/analysis/responseBuilder
 */

import type { StockData } from '@stock-assist/shared';
import type { ConfidenceResult } from './confidenceScoring';
import type { FundamentalData } from '../data/fundamentals';
import { formatAmount, formatPercent } from '../../utils/formatting';

// ═══════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════

export interface TradePlan {
    action: string;
    entry: (string | number)[];
    stopLoss: string | number;
    stopLossPercent: string | number;
    targets: Array<{ price: string | number; probability: number }>;
    riskReward: string | number;
    potentialProfit: (string | number)[];
}

export interface Scenario {
    probability: number;
    score: number;
    trigger: string;
    confirmation: string;
    tradePlan: TradePlan;
    factors: string[];
    timeHorizon: string;
}

export interface FallbackAnalysis {
    symbol: string;
    currentPrice: number;
    recommendation: string;
    confidenceScore: number;
    timeframe: string;
    bias: string;
    confidence: string;
    category: string;
    priceTargets: {
        entry: number;
        target1: number;
        target2: number;
        stopLoss: number;
        riskReward: string;
    };
    risks: string[];
    reasoning: string;
    bullish: Scenario;
    bearish: Scenario;
}

// ═══════════════════════════════════════════════════════════════
// SCENARIO BUILDERS
// ═══════════════════════════════════════════════════════════════

/** Build default bullish scenario from technical data */
export function buildDefaultBullishScenario(
    stock: StockData,
    sr: { support: number; resistance: number },
    bullishProb: number,
    techAlignmentScore: number
): Scenario {
    return {
        probability: bullishProb,
        score: techAlignmentScore,
        trigger: `Break above ₹${sr.resistance}`,
        confirmation: 'Close above with volume',
        tradePlan: {
            action: 'BUY',
            entry: [formatAmount(stock.quote.price), formatAmount(sr.resistance)],
            stopLoss: formatAmount(sr.support),
            stopLossPercent: formatPercent((stock.quote.price - sr.support) / stock.quote.price * 100),
            targets: [
                { price: formatAmount(sr.resistance), probability: Math.round(Math.min(85, 50 + bullishProb * 0.4)) },
                { price: formatAmount(sr.resistance * 1.05), probability: Math.round(Math.max(20, bullishProb * 0.5)) }
            ],
            riskReward: formatAmount(
                (sr.resistance - stock.quote.price) > 0 && (stock.quote.price - sr.support) > 0
                    ? (sr.resistance - stock.quote.price) / (stock.quote.price - sr.support)
                    : 1.5
            ),
            potentialProfit: [formatAmount(500), formatAmount(1500)]
        },
        factors: ['Technical setup', 'Volume confirmation'],
        timeHorizon: '3-7 days'
    };
}

/** Build default bearish scenario from technical data */
export function buildDefaultBearishScenario(
    stock: StockData,
    sr: { support: number; resistance: number },
    bearishProb: number,
    techAlignmentScore: number
): Scenario {
    return {
        probability: bearishProb,
        score: 100 - techAlignmentScore,
        trigger: `Break below ₹${sr.support}`,
        confirmation: 'Close below with volume',
        tradePlan: {
            action: 'AVOID',
            entry: [formatAmount(sr.support * 0.98), formatAmount(sr.support)],
            stopLoss: formatAmount(sr.resistance),
            stopLossPercent: formatPercent((sr.resistance - stock.quote.price) / stock.quote.price * 100),
            targets: [
                { price: formatAmount(sr.support), probability: Math.round(Math.min(85, 50 + bearishProb * 0.4)) },
                { price: formatAmount(sr.support * 0.95), probability: Math.round(Math.max(20, bearishProb * 0.5)) }
            ],
            riskReward: formatAmount(
                (stock.quote.price - sr.support) > 0 && (sr.resistance - stock.quote.price) > 0
                    ? (stock.quote.price - sr.support) / (sr.resistance - stock.quote.price)
                    : 1.2
            ),
            potentialProfit: [formatAmount(200), formatAmount(800)]
        },
        factors: ['Downside risk', 'Support breakdown'],
        timeHorizon: '1-5 days'
    };
}

// ═══════════════════════════════════════════════════════════════
// FALLBACK ANALYSIS
// ═══════════════════════════════════════════════════════════════

/** Generate fallback analysis when AI is unavailable */
export function generateFallbackAnalysis(
    stock: StockData,
    confidence: ConfidenceResult,
    technicalAnalysis: Record<string, any>,
    fundamentals: FundamentalData
): FallbackAnalysis {
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

// ═══════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════

/** Format patterns with stars based on strength */
export function formatPatternsWithStars(tf: Record<string, any> | undefined): string[] {
    if (!tf || !tf.patterns || tf.patterns.length === 0) return ['No significant patterns'];

    const strength = tf.strength || 50;
    const stars = strength > 80 ? '⭐⭐⭐' : strength > 60 ? '⭐⭐' : strength > 40 ? '⭐' : '';

    return tf.patterns.map((p: string) => `${p} ${stars}`.trim());
}
