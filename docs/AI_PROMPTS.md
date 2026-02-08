taskkill /F /IM node.exe /T
# 🤖 AI Prompts Documentation

> Prompt engineering guide for the dual strategy analysis system

---

## Table of Contents

1. [Overview](#overview)
2. [Morning Screening Prompt](#morning-screening-prompt)
3. [Single Stock Analysis Prompt](#single-stock-analysis-prompt)
4. [Trade Review Prompt](#trade-review-prompt)
5. [Prompt Best Practices](#prompt-best-practices)
6. [Response Parsing](#response-parsing)

---

## Overview

The AI is the brain of this system. It receives:
- Technical indicators (RSI, MA, Support/Resistance)
- Pattern detection results
- Recent news headlines
- Market context

And returns:
- Overall bias (Bullish/Bearish/Neutral)
- Two complete trade plans (bullish & bearish scenarios)
- Confidence levels and probabilities

---

## Morning Screening Prompt

### System Prompt

```
You are an EXPERT Indian stock market analyst with 15+ years of experience.

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

ANALYSIS FRAMEWORK:
Step 1: Technical Analysis
- RSI interpretation with exact number
- MA trend with specific prices
- Support/Resistance with test count
- Volume vs average (specific ratio)

Step 2: Pattern Recognition
- Name the pattern
- Confidence % (must explain why)
- Historical success rate if known
- Volume confirmation status

Step 3: News Impact
- Only last 72 hours
- Company-specific only
- Sentiment with reasoning
- Weight: High/Medium/Low

Step 4: Probability Calculation
- Bullish factors (list with weights)
- Bearish factors (list with weights)
- Final probability with math shown
- Confidence level with reasoning

OUTPUT REQUIREMENTS:
- Be specific: "₹2,860" not "near resistance"
- Be quantitative: "RSI 58" not "RSI neutral"
- Show reasoning: Don't just give scores, explain WHY
- Acknowledge uncertainty: If unsure, say so
- Provide alternatives: "If X happens, then Y, but if Z, then W"

CAPITAL CONSTRAINTS:
- Max capital: ₹15,000
- Max risk per trade: ₹500
- Preferred holding: 1-5 days
- Risk/Reward minimum: 1.5

Remember: One highly accurate trade making ₹5,000 is better than 
five mediocre trades making ₹1,000 total. QUALITY OVER QUANTITY.
```

### User Prompt Template

```
Analyze these {count} stocks for today's trading session.

DATE: {current_date}
MARKET CONTEXT:
- Nifty 50: {nifty_level} ({nifty_change}%)
- Market Sentiment: {sentiment}
- FII Activity: {fii_activity}

STOCKS TO ANALYZE:

{for each stock}
═══════════════════════════════════════════════════════════════
STOCK: {symbol}
Current Price: ₹{current_price}
Previous Close: ₹{previous_close}
Change: {change}%

TECHNICAL INDICATORS:
- RSI (14): {rsi}
- 20-day MA: ₹{ma20}
- 50-day MA: ₹{ma50}
- Support Level: ₹{support}
- Resistance Level: ₹{resistance}
- Volume Trend: {volume_trend}
- Volume vs Avg: {volume_ratio}x

PATTERN DETECTED:
- Pattern: {pattern_name}
- Confidence: {pattern_confidence}%
- Description: {pattern_description}

RECENT NEWS (last 3 days):
{for each news}
- [{date}] {headline} (Sentiment: {sentiment})
{end for}
═══════════════════════════════════════════════════════════════
{end for}

REQUIRED OUTPUT FORMAT (JSON):
{
  "analysisDate": "{date}",
  "marketOverview": "Brief market context",
  "stocks": [
    {
      "stock": "SYMBOL",
      "currentPrice": 0000.00,
      "overallBias": "BULLISH|BEARISH|NEUTRAL",
      "confidence": "HIGH|MEDIUM|LOW",
      "category": "STRONG_SETUP|AVOID|NEUTRAL",
      "recommendation": "One line action recommendation",
      
      "bullishScenario": {
        "probability": 00,
        "score": 00,
        "trigger": "Specific price trigger",
        "tradePlan": {
          "action": "BUY",
          "entry": [lower, upper],
          "stopLoss": 0000,
          "targets": [
            {"price": 0000, "probability": 00},
            {"price": 0000, "probability": 00}
          ],
          "riskReward": 0.00,
          "potentialProfit": [min, max]
        },
        "supportingFactors": ["factor1", "factor2"],
        "timeHorizon": "X-Y days"
      },
      
      "bearishScenario": {
        "probability": 00,
        "score": 00,
        "trigger": "Specific price trigger",
        "tradePlan": {
          "action": "SELL|SHORT|AVOID",
          "entry": [lower, upper],
          "stopLoss": 0000,
          "targets": [
            {"price": 0000, "probability": 00},
            {"price": 0000, "probability": 00}
          ],
          "riskReward": 0.00,
          "potentialProfit": [min, max],
          "buybackZone": [lower, upper]
        },
        "riskFactors": ["risk1", "risk2"],
        "timeHorizon": "X-Y days"
      }
    }
  ],
  
  "summary": {
    "strongSetups": ["STOCK1", "STOCK2"],
    "avoid": ["STOCK3"],
    "neutral": ["STOCK4", "STOCK5"]
  }
}

Analyze all stocks and provide the complete JSON response.
```

---

## Single Stock Analysis Prompt

### User Prompt Template

```
Provide a DETAILED dual-strategy analysis for this single stock.

═══════════════════════════════════════════════════════════════
STOCK: {symbol}
ANALYSIS TIME: {timestamp}
═══════════════════════════════════════════════════════════════

PRICE DATA:
- Current Price: ₹{current_price}
- Day Open: ₹{open}
- Day High: ₹{high}
- Day Low: ₹{low}
- Previous Close: ₹{previous_close}
- Change: {change} ({change_percent}%)

TECHNICAL INDICATORS:
- RSI (14): {rsi}
- RSI Interpretation: {rsi_interpretation}
- 20-day MA: ₹{ma20}
- 50-day MA: ₹{ma50}
- 200-day MA: ₹{ma200}
- MA Trend: {ma_trend}
- Support Level: ₹{support}
- Resistance Level: ₹{resistance}
- Pivot Point: ₹{pivot}
- Fibonacci Levels: {fib_levels}

VOLUME ANALYSIS:
- Today's Volume: {volume}
- Average Volume (20d): {avg_volume}
- Volume Ratio: {volume_ratio}x
- Volume Trend: {volume_trend}

PATTERN ANALYSIS:
- Primary Pattern: {pattern_name}
- Pattern Confidence: {pattern_confidence}%
- Pattern Description: {pattern_description}
- Expected Move: {expected_move}

RECENT NEWS (last 24-48 hours):
{for each news}
[{timestamp}] {source}: {headline}
Sentiment: {sentiment} | Impact: {impact}
{end for}

MARKET CONTEXT:
- Nifty 50: {nifty_level} ({nifty_change}%)
- Sector ({sector}): {sector_trend}
- FII Activity: {fii_activity}
- DII Activity: {dii_activity}
- Global Cues: {global_cues}

TRADING CONSTRAINTS:
- Capital: ₹15,000
- Max Risk: ₹500 per trade
- Preferred Timeframe: 1-5 days (swing trading)

═══════════════════════════════════════════════════════════════

Provide COMPREHENSIVE dual-strategy analysis in the following JSON format:

{
  "stock": "{symbol}",
  "currentPrice": 0000.00,
  "analysisTime": "{timestamp}",
  
  "overallBias": "BULLISH|BEARISH|NEUTRAL",
  "confidence": "HIGH|MEDIUM|LOW",
  "confidenceScore": 00,
  "recommendation": "Clear, actionable recommendation in one sentence",
  
  "keyLevelsToWatch": {
    "immediateSupport": 0000,
    "strongSupport": 0000,
    "immediateResistance": 0000,
    "strongResistance": 0000,
    "pivotPoint": 0000
  },
  
  "bullishScenario": {
    "probability": 00,
    "score": 00,
    "trigger": "Specific price/event that activates this plan",
    "confirmation": "What confirms the bullish move",
    
    "tradePlan": {
      "action": "BUY",
      "entryZone": [lower, upper],
      "idealEntry": 0000,
      "stopLoss": 0000,
      "stopLossPercent": 0.0,
      "targets": [
        {"level": "Target 1", "price": 0000, "probability": 00, "profit": "₹XXX per share"},
        {"level": "Target 2", "price": 0000, "probability": 00, "profit": "₹XXX per share"}
      ],
      "riskReward": 0.00,
      "suggestedQuantity": 0,
      "maxCapitalRequired": 0000,
      "maxRisk": 0000,
      "potentialProfit": [min, max]
    },
    
    "supportingFactors": [
      "Detailed factor 1 with explanation",
      "Detailed factor 2 with explanation"
    ],
    
    "timeHorizon": "X-Y trading days",
    "bestTimeToEnter": "Specific timing advice",
    "exitStrategy": "When and how to exit"
  },
  
  "bearishScenario": {
    "probability": 00,
    "score": 00,
    "trigger": "Specific price/event that activates this plan",
    "confirmation": "What confirms the bearish move",
    
    "tradePlan": {
      "action": "SELL_HOLDINGS|SHORT|AVOID_BUYING",
      "entryZone": [lower, upper],
      "idealEntry": 0000,
      "stopLoss": 0000,
      "stopLossPercent": 0.0,
      "targets": [
        {"level": "Target 1", "price": 0000, "probability": 00},
        {"level": "Target 2", "price": 0000, "probability": 00}
      ],
      "riskReward": 0.00,
      "buybackZone": [lower, upper],
      "potentialProfit": [min, max]
    },
    
    "riskFactors": [
      "Detailed risk 1 with explanation",
      "Detailed risk 2 with explanation"
    ],
    
    "timeHorizon": "X-Y trading days",
    "warningSignals": ["signal1", "signal2"],
    "protectiveAction": "What to do if holding this stock"
  },
  
  "patternAnalysis": {
    "pattern": "{pattern_name}",
    "confidence": 00,
    "description": "What this pattern means",
    "historicalAccuracy": "How often this pattern works",
    "expectedOutcome": "What typically happens next"
  },
  
  "newsImpact": {
    "overallSentiment": "POSITIVE|NEGATIVE|NEUTRAL",
    "keyDevelopments": ["development1", "development2"],
    "potentialCatalysts": ["catalyst1", "catalyst2"]
  },
  
  "finalVerdict": {
    "shouldTrade": true|false,
    "primaryScenario": "bullish|bearish",
    "actionToday": "Specific action for today",
    "waitFor": "What trigger to wait for before acting"
  }
}
```

---

## Trade Review Prompt

### User Prompt Template

```
Review this completed trade and provide learning insights.

═══════════════════════════════════════════════════════════════
TRADE DETAILS:
═══════════════════════════════════════════════════════════════
Stock: {symbol}
Direction: {LONG|SHORT}
Entry Date: {entry_date}
Entry Price: ₹{entry_price}
Exit Date: {exit_date}
Exit Price: ₹{exit_price}
Quantity: {quantity}
P&L: ₹{pnl} ({pnl_percent}%)

ORIGINAL ANALYSIS:
- Pattern Detected: {pattern}
- Pattern Confidence: {pattern_confidence}%
- AI Bias: {original_bias}
- AI Confidence: {ai_confidence}
- Scenario Executed: {bullish|bearish}
- Predicted Target 1: ₹{target1}
- Predicted Target 2: ₹{target2}
- Stop Loss Set: ₹{stop_loss}

WHAT ACTUALLY HAPPENED:
- High after entry: ₹{highest_after_entry}
- Low after entry: ₹{lowest_after_entry}
- Did it hit Target 1? {yes|no}
- Did it hit Stop Loss? {yes|no}

TRADER NOTES:
{user_notes}

═══════════════════════════════════════════════════════════════

Analyze this trade and provide feedback in JSON:

{
  "tradeResult": "WIN|LOSS|BREAKEVEN",
  "wasPatternAccurate": true|false,
  "patternAccuracyScore": 00,
  
  "analysis": {
    "whatWorked": ["point1", "point2"],
    "whatDidntWork": ["point1", "point2"],
    "missedOpportunities": ["point1"],
    "luckyBreaks": ["point1"]
  },
  
  "aiPerformance": {
    "biasAccurate": true|false,
    "targetAccuracy": "Which target levels were hit",
    "timingAccuracy": "Was timing prediction correct"
  },
  
  "lessonsLearned": [
    "Specific lesson 1",
    "Specific lesson 2"
  ],
  
  "improvementSuggestions": [
    "How to improve next time"
  ],
  
  "patternReliability": {
    "thisPattern": "{pattern_name}",
    "shouldContinueTrading": true|false,
    "adjustedConfidence": 00,
    "recommendation": "Keep trading / Be more selective / Avoid"
  }
}
```

---

## Prompt Best Practices

### 1. Be Specific with Numbers

❌ **Bad**: "The stock is near support"
✅ **Good**: "Support at ₹2,820, current price ₹2,847 (0.9% above)"

### 2. Include Context

❌ **Bad**: "RSI is 58"
✅ **Good**: "RSI is 58 (neutral zone, room for upside before overbought at 70)"

### 3. Constrain the Output

- Always request JSON format
- Specify exact field names
- Include example values

### 4. Add Trading Constraints

Always remind the AI about:
- ₹15,000 capital limit
- ₹500 max risk per trade
- Swing trading timeframe (1-5 days)
- NSE market hours

### 5. Request Both Scenarios

The key differentiator - ALWAYS ask for both:
- Bullish plan with triggers
- Bearish plan with triggers

---

## Response Parsing

### JavaScript Parser Example

```javascript
function parseAIResponse(rawResponse) {
  try {
    // Remove markdown code blocks if present
    let cleaned = rawResponse
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();
    
    // Parse JSON
    const data = JSON.parse(cleaned);
    
    // Validate required fields
    if (!data.stock || !data.overallBias) {
      throw new Error('Missing required fields');
    }
    
    // Validate probabilities add up to 100
    const bullProb = data.bullishScenario?.probability || 0;
    const bearProb = data.bearishScenario?.probability || 0;
    if (Math.abs(bullProb + bearProb - 100) > 5) {
      console.warn('Probabilities do not sum to 100%');
    }
    
    return {
      success: true,
      data: data
    };
    
  } catch (error) {
    return {
      success: false,
      error: error.message,
      rawResponse: rawResponse
    };
  }
}
```

### Validation Schema

```javascript
const analysisSchema = {
  stock: { type: 'string', required: true },
  currentPrice: { type: 'number', required: true },
  overallBias: { 
    type: 'string', 
    required: true,
    enum: ['BULLISH', 'BEARISH', 'NEUTRAL']
  },
  confidence: {
    type: 'string',
    required: true,
    enum: ['HIGH', 'MEDIUM', 'LOW']
  },
  bullishScenario: {
    type: 'object',
    required: true,
    properties: {
      probability: { type: 'number', min: 0, max: 100 },
      trigger: { type: 'string' },
      tradePlan: { type: 'object' }
    }
  },
  bearishScenario: {
    type: 'object',
    required: true,
    properties: {
      probability: { type: 'number', min: 0, max: 100 },
      trigger: { type: 'string' },
      tradePlan: { type: 'object' }
    }
  }
};
```

---

## Error Handling

### Common AI Response Issues

| Issue | Solution |
|-------|----------|
| Response not JSON | Strip markdown, retry |
| Missing fields | Use defaults, log warning |
| Invalid numbers | Parse carefully, validate |
| Probabilities don't sum | Normalize to 100% |
| Response too long | Increase max_tokens |
| Response cut off | Request in chunks |

### Retry Strategy

```javascript
async function analyzeWithRetry(data, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await callGeminiAPI(data);
      const parsed = parseAIResponse(response);
      
      if (parsed.success) {
        return parsed.data;
      }
      
      console.warn(`Parse failed, retry ${i + 1}/${maxRetries}`);
      
    } catch (error) {
      console.error(`API error, retry ${i + 1}/${maxRetries}:`, error);
      await sleep(1000 * (i + 1)); // Exponential backoff
    }
  }
  
  throw new Error('Failed after max retries');
}
```

---

*AI Prompts Documentation Version: 1.0.0*
*Last Updated: February 6, 2026*
