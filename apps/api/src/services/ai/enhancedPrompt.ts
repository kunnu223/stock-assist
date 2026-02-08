/**
 * Enhanced AI Prompt Builder
 * @module @stock-assist/api/services/ai/enhancedPrompt
 */

import type { StockData, TechnicalIndicators, PatternAnalysis } from '@stock-assist/shared';
import { TRADING } from '@stock-assist/shared';
import type { FundamentalData } from '../data/fundamentals';
import type { EnhancedNewsAnalysis } from '../news/enhanced';
import type { ConfidenceResult } from '../analysis/confidenceScoring';

// Re-export types for convenience
export type { EnhancedNewsAnalysis, FundamentalData, ConfidenceResult };

export interface EnhancedPromptInput {
    stock: StockData;
    indicators: TechnicalIndicators;
    patterns: PatternAnalysis;
    news: EnhancedNewsAnalysis;
    fundamentals: FundamentalData;
    technicalSummary: string;
    confidenceResult: ConfidenceResult;
    weeklyIndicators?: TechnicalIndicators;
    monthlyIndicators?: TechnicalIndicators;
}

/**
 * Build comprehensive enhanced analysis prompt
 */
export const buildEnhancedPrompt = (input: EnhancedPromptInput): string => {
    const { stock, indicators, patterns, news, fundamentals, technicalSummary, confidenceResult } = input;
    const { quote } = stock;
    const { rsi, ma, sr, volume, macd } = indicators;

    // News summary
    const newsSection = news.items.length > 0
        ? news.latestHeadlines.slice(0, 5).map((h: string, i: number) => `  ${i + 1}. ${h}`).join('\n')
        : '  • No significant news in last 24 hours';

    // Fundamentals summary
    const fundSection = `• Valuation: ${fundamentals.valuation}
• Growth: ${fundamentals.growth}
• P/E Ratio: ${fundamentals.metrics.peRatio || 'N/A'}
• P/B Ratio: ${fundamentals.metrics.pbRatio || 'N/A'}
• Dividend Yield: ${fundamentals.metrics.dividendYield ? fundamentals.metrics.dividendYield + '%' : 'N/A'}
• Sector Performance: ${fundamentals.sectorComparison}`;

    // Our confidence breakdown
    const confidenceSection = `Pre-calculated Confidence Score: ${confidenceResult.score}/100
Recommendation Hint: ${confidenceResult.recommendation}

Score Breakdown:
• Pattern Strength: ${confidenceResult.breakdown.patternStrength}/100 (25% weight)
• News Sentiment: ${confidenceResult.breakdown.newsSentiment}/100 (20% weight)
• Technical Alignment: ${confidenceResult.breakdown.technicalAlignment}/100 (25% weight)
• Volume Confirmation: ${confidenceResult.breakdown.volumeConfirmation}/100 (15% weight)
• Fundamental Strength: ${confidenceResult.breakdown.fundamentalStrength}/100 (15% weight)

Key Factors:
${confidenceResult.factors.slice(0, 8).map((f: string) => `• ${f}`).join('\n')}`;

    return `You are an EXPERT Indian stock market analyst providing actionable trading recommendations.

═══════════════════════════════════════════════════════════════
COMPREHENSIVE STOCK ANALYSIS: ${quote.symbol}
═══════════════════════════════════════════════════════════════

CURRENT MARKET DATA:
• Current Price: ₹${quote.price}
• Change: ${quote.changePercent >= 0 ? '+' : ''}${quote.changePercent}%
• Day Range: ₹${quote.dayLow} - ₹${quote.dayHigh}
• Previous Close: ₹${quote.previousClose}

${technicalSummary}

PATTERN ANALYSIS:
• Primary Pattern: ${patterns.primary ? `${patterns.primary.name} (${patterns.primary.confidence}% confidence)` : 'No clear pattern'}
• Trend Direction: ${patterns.trend.direction}
• Trend Strength: ${patterns.trend.strength}%
• At Breakout: ${patterns.atBreakout ? 'YES' : 'No'}
• At Breakdown: ${patterns.atBreakdown ? 'YES' : 'No'}

NEWS SENTIMENT (Last 24 hours):
• Overall Sentiment: ${news.sentiment} (Score: ${news.sentimentScore}/100)
• Impact Level: ${news.impactLevel}
Headlines:
${newsSection}

FUNDAMENTAL DATA:
${fundSection}

SYSTEM CONFIDENCE ANALYSIS:
${confidenceSection}

═══════════════════════════════════════════════════════════════
TRADING CONTEXT:
═══════════════════════════════════════════════════════════════
• Max Capital: ₹${TRADING.CAPITAL}
• Max Risk Per Trade: ₹${TRADING.MAX_RISK}
• Preferred Style: Swing Trading (2-10 days)
• Min Risk/Reward: 1.5

═══════════════════════════════════════════════════════════════
YOUR ANALYSIS TASK:
═══════════════════════════════════════════════════════════════

Based on ALL the data above, provide a comprehensive analysis:

1. VALIDATE OR ADJUST the system's confidence score (${confidenceResult.score}/100)
2. CONFIRM OR MODIFY the recommendation (${confidenceResult.recommendation})
3. IDENTIFY the strongest signal (technical or fundamental)
4. LIST specific risks that could invalidate this trade
5. PROVIDE precise entry, targets, and stop-loss levels

CRITICAL RULES:
• Never guarantee 100% accuracy - markets are unpredictable
• If confidence is below 60%, recommend WAIT or HOLD
• If signals conflict (e.g., bullish technicals + negative news), explain the conflict
• Be specific with prices - use exact numbers, not ranges like "around ₹X"
• Consider news impact on short-term price action

═══════════════════════════════════════════════════════════════
REQUIRED JSON OUTPUT FORMAT:
═══════════════════════════════════════════════════════════════

{
  "symbol": "${quote.symbol}",
  "currentPrice": ${quote.price},
  "recommendation": "BUY" | "SELL" | "HOLD" | "WAIT",
  "confidenceScore": 0-100,
  "adjustedFromSystem": true/false,
  "adjustmentReason": "Why you adjusted the system score, if any",
  "timeframe": "intraday" | "short-term" | "swing" | "long-term",
  
  "analysis": {
    "strongestSignal": "Description of the most reliable signal",
    "signalType": "technical" | "fundamental" | "news" | "combined",
    "conflicts": ["List any conflicting signals"],
    "technicalSummary": "Brief technical outlook",
    "newsSummary": "Brief news impact assessment"
  },
  
  "priceTargets": {
    "entry": ${quote.price},
    "target1": 0,
    "target2": 0,
    "stopLoss": 0,
    "riskReward": 0
  },
  
  "risks": ["Risk 1", "Risk 2", "Risk 3"],
  
  "reasoning": "Step-by-step explanation of your analysis and why you made this recommendation",
  
  "bias": "BULLISH" | "BEARISH" | "NEUTRAL",
  "confidence": "HIGH" | "MEDIUM" | "LOW",
  "category": "STRONG_SETUP" | "NEUTRAL" | "AVOID",
  
  "bullish": {
    "probability": 0,
    "score": 0,
    "trigger": "Entry trigger condition",
    "confirmation": "What confirms the move",
    "tradePlan": {
      "action": "BUY",
      "entry": [${sr.support}, ${sr.resistance}],
      "stopLoss": ${sr.support * 0.98},
      "stopLossPercent": 2.0,
      "targets": [{"price": 0, "probability": 0}],
      "riskReward": 1.5,
      "potentialProfit": [0, 0]
    },
    "factors": ["Factor 1", "Factor 2"],
    "timeHorizon": "3-7 days"
  },
  
  "bearish": {
    "probability": 0,
    "score": 0,
    "trigger": "Bearish trigger",
    "confirmation": "Bearish confirmation",
    "tradePlan": {
      "action": "SELL" | "AVOID",
      "entry": [0, 0],
      "stopLoss": 0,
      "stopLossPercent": 0,
      "targets": [{"price": 0, "probability": 0}],
      "riskReward": 0,
      "potentialProfit": [0, 0]
    },
    "factors": ["Risk factor 1", "Risk factor 2"],
    "timeHorizon": "1-5 days"
  }
}

VALIDATION RULES:
1. bullish.probability + bearish.probability MUST = 100
2. Only return valid JSON, no markdown code blocks
3. Be specific with all price levels
4. Include at least 3 risks
5. Explain your reasoning clearly`;
};
