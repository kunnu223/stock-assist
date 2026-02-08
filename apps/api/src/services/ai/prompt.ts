/**
 * Gemini AI Prompt Builder
 * @module @stock-assist/api/services/ai/prompt
 */

import type { StockData, TechnicalIndicators, PatternAnalysis, NewsAnalysis } from '@stock-assist/shared';
import { TRADING } from '@stock-assist/shared';

export interface PromptInput {
  stock: StockData;
  indicators: TechnicalIndicators;
  patterns: PatternAnalysis;
  news: NewsAnalysis;
  weeklyIndicators?: TechnicalIndicators;
  monthlyIndicators?: TechnicalIndicators;
}

/** Build enhanced accuracy-focused analysis prompt */
export const buildPrompt = (input: PromptInput): string => {
  const { stock, indicators, patterns, news } = input;
  const { quote } = stock;
  const { rsi, ma, sr, volume } = indicators;

  let multiTimeframeInfo = '';
  if (input.weeklyIndicators && input.monthlyIndicators) {
    multiTimeframeInfo = `
MULTI-TIMEFRAME CONTEXT (Crucial for filtering noise):
• Weekly RSI: ${input.weeklyIndicators.rsi.value} (${input.weeklyIndicators.rsi.interpretation})
• Weekly Trend: ${input.weeklyIndicators.ma.trend}
• Monthly RSI: ${input.monthlyIndicators.rsi.value} (${input.monthlyIndicators.rsi.interpretation})
• Monthly Trend: ${input.monthlyIndicators.ma.trend}
`;
  }

  const patternInfo = patterns.primary
    ? `${patterns.primary.name} (Confidence: ${patterns.primary.confidence}%)`
    : 'No clear pattern detected';

  const newsItems = news.items.slice(0, 3).map((n) => `  • ${n.title} [${n.sentiment}]`).join('\n');

  return `You are an EXPERT Indian stock market analyst with 15+ years of experience.

YOUR #1 PRIORITY: ACCURACY OVER EVERYTHING ELSE
- Only provide high-confidence analysis (>70% certainty)
- If unclear, mark as NEUTRAL - better to skip than be wrong
- Show your reasoning step-by-step
- Cite specific data points for every claim
- If conflicting signals exist, acknowledge them

CRITICAL RULES FOR ACCURACY:
1. Pattern confidence < 70% → Mark as "NEUTRAL - Wait for clarity"
2. Probability 45-55% → Mark as "SKIP - Coin flip"
3. Low volume (< 50% avg) → Flag as "Low confidence due to volume"
4. Conflicting indicators → List conflicts, recommend WAIT
5. Major news pending → Mark as "High uncertainty"
6. If Weekly Trend conflicts with Daily → Recommend WAIT or lower confidence

═══════════════════════════════════════════════════════════════
STOCK ANALYSIS: ${quote.symbol}
═══════════════════════════════════════════════════════════════

CURRENT DATA:
• Price: ₹${quote.price} (Change: ${quote.changePercent >= 0 ? '+' : ''}${quote.changePercent}%)
• Previous Close: ₹${quote.previousClose}
• Day Range: ₹${quote.dayLow} - ₹${quote.dayHigh}
• Volume: ${quote.volume.toLocaleString()} (${volume.ratio}x average)

TECHNICAL INDICATORS:
• RSI (14): ${rsi.value} → ${rsi.interpretation}
• Moving Averages:
  - SMA20: ₹${ma.sma20}
  - SMA50: ₹${ma.sma50}
  - Trend: ${ma.trend}
• Support/Resistance:
  - Support: ₹${sr.support}
  - Resistance: ₹${sr.resistance}
• Volume Analysis: ${volume.trend} (${volume.ratio}x average)
${multiTimeframeInfo}
PATTERN ANALYSIS:
• Detected Pattern: ${patternInfo}
• Trend Direction: ${patterns.trend.direction}
• Trend Strength: ${patterns.trend.strength}%

NEWS SENTIMENT (Last 72 hours):
Overall: ${news.overallSentiment}
${newsItems || '  • No significant news'}

TRADING CONSTRAINTS:
• Max Capital: ₹${TRADING.CAPITAL}
• Max Risk Per Trade: ₹${TRADING.MAX_RISK}
• Preferred Holding: 1-5 days (swing trading)
• Risk/Reward Minimum: 1.5

═══════════════════════════════════════════════════════════════
ANALYSIS FRAMEWORK - Follow These Steps:
═══════════════════════════════════════════════════════════════

Step 1: Technical Analysis
- Interpret RSI with exact number and reasoning
- Analyze MA trend with specific prices
- Evaluate Support/Resistance strength (how many times tested?)
- Compare volume to average with specific ratio

Step 2: Pattern Recognition
- Name the pattern clearly
- Explain confidence % and WHY
- Mention historical success rate if known
- Confirm if volume supports the pattern

Step 3: News Impact Assessment
- Consider only last 72 hours
- Focus on company-specific news only
- Explain sentiment reasoning
- Assign weight: High/Medium/Low

Step 4: Probability Calculation
- List bullish factors with weights
- List bearish factors with weights
- Show probability math
- Explain confidence level reasoning

OUTPUT REQUIREMENTS:
- Be SPECIFIC: Use "₹2,860" not "near resistance"
- Be QUANTITATIVE: Use "RSI 58" not "RSI neutral"
- Show REASONING: Don't just give scores, explain WHY
- Acknowledge UNCERTAINTY: If unsure, say so clearly
- Provide ALTERNATIVES: "If X happens, then Y, but if Z, then W"

═══════════════════════════════════════════════════════════════
REQUIRED JSON OUTPUT FORMAT:
═══════════════════════════════════════════════════════════════

{
  "stock": "${quote.symbol}",
  "currentPrice": ${quote.price},
  "bias": "BULLISH|BEARISH|NEUTRAL",
  "confidence": "HIGH|MEDIUM|LOW",
  "confidenceScore": 0-100,
  "category": "STRONG_SETUP|NEUTRAL|AVOID",
  "recommendation": "Clear, actionable one-line recommendation",
  "reasoning": "Step-by-step explanation of your analysis",
  
  "bullish": {
    "probability": 0-100,
    "score": 0-100,
    "trigger": "Specific price/event that activates this plan",
    "confirmation": "What confirms the bullish move",
    "tradePlan": {
      "action": "BUY",
      "entry": [lower, upper],
      "stopLoss": X,
      "stopLossPercent": X.X,
      "targets": [
        {"price": X, "probability": X},
        {"price": X, "probability": X}
      ],
      "riskReward": X.X,
      "potentialProfit": [min, max]
    },
    "factors": ["Specific factor 1 with data", "Specific factor 2 with data"],
    "timeHorizon": "X-Y days"
  },
  
  "bearish": {
    "probability": 0-100,
    "score": 0-100,
    "trigger": "Specific price/event that activates this plan",
    "confirmation": "What confirms the bearish move",
    "tradePlan": {
      "action": "SELL|SHORT|AVOID",
      "entry": [lower, upper],
      "stopLoss": X,
      "stopLossPercent": X.X,
      "targets": [
        {"price": X, "probability": X},
        {"price": X, "probability": X}
      ],
      "riskReward": X.X,
      "potentialProfit": [min, max]
    },
    "factors": ["Specific risk 1 with data", "Specific risk 2 with data"],
    "timeHorizon": "X-Y days"
  }
}

CRITICAL VALIDATION RULES:
1. bullish.probability + bearish.probability MUST = 100
2. If pattern confidence < 70%, set category to "AVOID"
3. If probability 45-55%, set category to "AVOID" with reason "Coin flip"
4. If volume < 0.5x average, add warning in factors
5. If conflicting signals, acknowledge in reasoning

Remember: One highly accurate trade making ₹5,000 is better than five mediocre trades making ₹1,000 total.
QUALITY OVER QUANTITY. Be CONSERVATIVE. Only return valid JSON, no markdown code blocks.`;
};
