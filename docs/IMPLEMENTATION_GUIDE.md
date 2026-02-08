# 🛠️ Implementation Guide - Accuracy Features

## Overview

This guide helps you implement the accuracy-focused features documented in the updated PROJECT_OVERVIEW.md, AI_PROMPTS.md, and API_REFERENCE.md.

---

## 📋 Implementation Priority

### Phase 1: Critical (Week 1-2)
1. ✅ Update AI System Prompt
2. ✅ Add Data Validation
3. ✅ Implement "When NOT to Trade" Logic
4. ✅ Add Error Handling

### Phase 2: Important (Week 3-4)
5. ⏳ Multi-Timeframe Analysis
6. ⏳ Backtesting Framework
7. ⏳ Probability Calibration

### Phase 3: Enhancement (Month 2)
8. ⏳ Advanced Pattern Filtering
9. ⏳ News Quality Scoring
10. ⏳ Performance Analytics Dashboard

---

## 1️⃣ Update AI System Prompt

**File:** `apps/api/src/services/ai/gemini.ts`

**Current Location:** Find the system prompt in the `analyzeStock` function

**Action:** Replace with the enhanced prompt from `AI_PROMPTS.md` (lines 37-95)

```typescript
const systemPrompt = `
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

... (rest of prompt from AI_PROMPTS.md)
`;
```

**Testing:** Run a single stock analysis and verify AI responses are more detailed

---

## 2️⃣ Add Data Validation

**File:** `apps/api/src/utils/validation.ts` (create new file)

**Code:**

```typescript
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export function validateStockData(data: any): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // Check data completeness
  if (!data.ohlc || data.ohlc.length < 20) {
    errors.push("Insufficient historical data (need 20+ days)");
  }
  
  // Check for data anomalies
  if (data.ohlc && data.ohlc.length > 0) {
    const priceChanges = data.ohlc.map((d: any, i: number, arr: any[]) => 
      i > 0 ? Math.abs((d.close - arr[i-1].close) / arr[i-1].close) : 0
    );
    
    const maxChange = Math.max(...priceChanges);
    if (maxChange > 0.15) {
      warnings.push(`Abnormal price movement detected (${(maxChange * 100).toFixed(1)}% single day)`);
    }
  }
  
  // Check volume
  if (data.avgVolume && data.avgVolume < 100000) {
    warnings.push("Low liquidity stock (avg volume < 100k)");
  }
  
  // Check for split/bonus (volume spike)
  if (data.ohlc && data.avgVolume) {
    const volumeSpike = data.ohlc.some((d: any) => 
      d.volume > data.avgVolume * 10
    );
    if (volumeSpike) {
      warnings.push("Possible corporate action detected (volume spike)");
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

export function validateAIResponse(response: any): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // Check probabilities sum to 100
  if (response.bullishScenario && response.bearishScenario) {
    const sum = response.bullishScenario.probability + response.bearishScenario.probability;
    if (Math.abs(sum - 100) > 5) {
      errors.push(`Probabilities don't sum to 100 (sum: ${sum})`);
    }
  }
  
  // Check pattern confidence
  if (response.pattern && response.pattern.confidence < 50) {
    warnings.push("Low pattern confidence, flagging as uncertain");
  }
  
  // Check for realistic price targets
  if (response.currentPrice && response.bullishScenario?.targets) {
    const maxTarget = Math.max(...response.bullishScenario.targets.map((t: any) => t.price));
    const percentChange = ((maxTarget - response.currentPrice) / response.currentPrice);
    
    if (percentChange > 0.20) {
      warnings.push(`Target >20% away (${(percentChange * 100).toFixed(1)}%), may be unrealistic for swing trade`);
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}
```

**Usage in API:**

```typescript
import { validateStockData, validateAIResponse } from '../utils/validation';

// In your analysis route
const validation = validateStockData(stockData);
if (!validation.isValid) {
  return res.status(400).json({
    success: false,
    error: 'Invalid stock data',
    details: validation.errors
  });
}

if (validation.warnings.length > 0) {
  console.warn('Stock data warnings:', validation.warnings);
}

// After AI response
const aiValidation = validateAIResponse(aiResponse);
if (!aiValidation.isValid) {
  console.error('AI response validation failed:', aiValidation.errors);
  // Retry or return error
}
```

---

## 3️⃣ Implement "When NOT to Trade" Logic

**File:** `apps/api/src/utils/tradeDecision.ts` (create new file)

**Code:**

```typescript
export interface TradeDecision {
  shouldTrade: boolean;
  reason: string;
  category: 'STRONG_SETUP' | 'AVOID' | 'NEUTRAL';
}

export function shouldTrade(analysis: any): TradeDecision {
  // Check 1: Probability range (45-55% = coin flip)
  const bullProb = analysis.bullishScenario?.probability || 0;
  const bearProb = analysis.bearishScenario?.probability || 0;
  
  if (bullProb >= 45 && bullProb <= 55) {
    return {
      shouldTrade: false,
      reason: 'Coin flip probability (45-55%)',
      category: 'AVOID'
    };
  }
  
  // Check 2: Pattern confidence < 70%
  if (analysis.pattern?.confidence < 70) {
    return {
      shouldTrade: false,
      reason: `Low pattern confidence (${analysis.pattern.confidence}%)`,
      category: 'AVOID'
    };
  }
  
  // Check 3: Low volume
  if (analysis.indicators?.volumeRatio < 0.5) {
    return {
      shouldTrade: false,
      reason: 'Low volume (< 50% of average)',
      category: 'AVOID'
    };
  }
  
  // Check 4: Conflicting signals
  const rsi = analysis.indicators?.rsi;
  const maTrend = analysis.indicators?.maTrend;
  
  if (rsi && maTrend) {
    const rsiBullish = rsi > 50;
    const maBullish = maTrend.includes('Bullish') || maTrend.includes('bullish');
    
    if (rsiBullish !== maBullish) {
      return {
        shouldTrade: false,
        reason: 'Conflicting signals (RSI vs MA)',
        category: 'NEUTRAL'
      };
    }
  }
  
  // Check 5: Both scenarios weak
  if (bullProb < 60 && bearProb < 60) {
    return {
      shouldTrade: false,
      reason: 'Both scenarios weak (no clear edge)',
      category: 'NEUTRAL'
    };
  }
  
  // Check 6: Risk/Reward < 1.5
  const bullRR = analysis.bullishScenario?.tradePlan?.riskReward || 0;
  const bearRR = analysis.bearishScenario?.tradePlan?.riskReward || 0;
  const maxRR = Math.max(bullRR, bearRR);
  
  if (maxRR < 1.5) {
    return {
      shouldTrade: false,
      reason: 'Risk/Reward < 1.5',
      category: 'AVOID'
    };
  }
  
  // Passed all checks
  const highConfidence = (bullProb > 65 || bearProb > 65) && 
                         analysis.pattern?.confidence > 75;
  
  return {
    shouldTrade: true,
    reason: highConfidence ? 'High confidence setup' : 'Good setup',
    category: highConfidence ? 'STRONG_SETUP' : 'NEUTRAL'
  };
}
```

**Usage:**

```typescript
import { shouldTrade } from '../utils/tradeDecision';

// After getting AI analysis
const decision = shouldTrade(aiAnalysis);

if (!decision.shouldTrade) {
  console.log(`Skipping trade: ${decision.reason}`);
  aiAnalysis.recommendation = `SKIP - ${decision.reason}`;
  aiAnalysis.category = decision.category;
}
```

---

## 4️⃣ Add Error Handling

**File:** Update existing API routes

**Pattern:**

```typescript
try {
  // Validate input
  const validation = validateStockData(stockData);
  if (!validation.isValid) {
    return res.status(400).json({
      success: false,
      error: 'Data validation failed',
      details: validation.errors
    });
  }
  
  // Log warnings
  if (validation.warnings.length > 0) {
    console.warn(`[${symbol}] Warnings:`, validation.warnings);
  }
  
  // Proceed with analysis
  const aiResponse = await analyzeWithAI(stockData);
  
  // Validate AI response
  const aiValidation = validateAIResponse(aiResponse);
  if (!aiValidation.isValid) {
    throw new Error(`AI validation failed: ${aiValidation.errors.join(', ')}`);
  }
  
  // Check trade decision
  const decision = shouldTrade(aiResponse);
  aiResponse.tradeDecision = decision;
  
  return res.json({
    success: true,
    data: aiResponse,
    warnings: validation.warnings
  });
  
} catch (error) {
  console.error('Analysis error:', error);
  return res.status(500).json({
    success: false,
    error: error.message || 'Analysis failed'
  });
}
```

---

## 5️⃣ Multi-Timeframe Analysis (Phase 2)

**File:** `apps/api/src/services/data/multiTimeframe.ts` (create new)

**Concept:**

```typescript
export async function getMultiTimeframeData(symbol: string) {
  const [daily, weekly, monthly] = await Promise.all([
    fetchYahooData(symbol, '1d', 30),  // 30 days
    fetchYahooData(symbol, '1wk', 12), // 12 weeks
    fetchYahooData(symbol, '1mo', 6)   // 6 months
  ]);
  
  return {
    daily: analyzeTimeframe(daily, '1D'),
    weekly: analyzeTimeframe(weekly, '1W'),
    monthly: analyzeTimeframe(monthly, '1M')
  };
}

function analyzeTimeframe(data: any, timeframe: string) {
  // Calculate trend, support, resistance for this timeframe
  return {
    timeframe,
    trend: calculateTrend(data),
    support: findSupport(data),
    resistance: findResistance(data),
    bias: determineBias(data)
  };
}
```

---

## 6️⃣ Backtesting Framework (Phase 2)

**Database Schema:** Add to MongoDB

```typescript
// models/Backtest.ts
const backtestSchema = new Schema({
  date: Date,
  stock: String,
  
  // AI Prediction
  aiPrediction: {
    bias: String,
    bullishProb: Number,
    bearishProb: Number,
    trigger: String,
    target1: Number,
    pattern: String,
    patternConfidence: Number
  },
  
  // Actual Outcome (filled next day)
  actualOutcome: {
    didTrigger: Boolean,
    triggeredAt: Number,
    highAfterTrigger: Number,
    lowAfterTrigger: Number,
    hitTarget1: Boolean,
    hitStopLoss: Boolean,
    result: String // 'WIN' | 'LOSS' | 'NEUTRAL'
  },
  
  // Accuracy Assessment
  accurate: Boolean,
  notes: String,
  
  createdAt: Date,
  updatedAt: Date
});
```

**API Endpoint:**

```typescript
// POST /api/backtest/save-prediction
// Save AI prediction for later validation

// POST /api/backtest/update-outcome
// Update with actual outcome next day

// GET /api/backtest/accuracy
// Calculate accuracy metrics after 30+ predictions
```

---

## 7️⃣ Probability Calibration (Phase 2)

**File:** `apps/api/src/utils/calibration.ts`

```typescript
export async function calibrateAIProbabilities() {
  // Get last 30 backtests
  const backtests = await Backtest.find()
    .sort({ date: -1 })
    .limit(30);
  
  // Group by probability ranges
  const ranges = {
    '60-70': [],
    '70-80': [],
    '80-90': []
  };
  
  backtests.forEach(bt => {
    const prob = bt.aiPrediction.bullishProb;
    if (prob >= 60 && prob < 70) ranges['60-70'].push(bt);
    else if (prob >= 70 && prob < 80) ranges['70-80'].push(bt);
    else if (prob >= 80 && prob < 90) ranges['80-90'].push(bt);
  });
  
  // Calculate actual win rates
  const calibration = {};
  for (const [range, tests] of Object.entries(ranges)) {
    const wins = tests.filter(t => t.actualOutcome.result === 'WIN').length;
    const total = tests.length;
    const actualWinRate = total > 0 ? (wins / total) * 100 : 0;
    
    calibration[range] = {
      predicted: parseInt(range.split('-')[0]) + 5, // midpoint
      actual: actualWinRate,
      sampleSize: total,
      needsAdjustment: Math.abs(actualWinRate - (parseInt(range.split('-')[0]) + 5)) > 10
    };
  }
  
  return calibration;
}
```

---

## 🧪 Testing Checklist

After implementing each phase:

### Phase 1 Testing:
- [ ] AI responses include step-by-step reasoning
- [ ] Low-confidence patterns are flagged as NEUTRAL
- [ ] Data validation catches bad data
- [ ] "When NOT to trade" logic works
- [ ] Error handling prevents crashes

### Phase 2 Testing:
- [ ] Multi-timeframe data fetches correctly
- [ ] Backtest predictions save to database
- [ ] Calibration calculates after 30 trades
- [ ] Accuracy metrics display correctly

### Phase 3 Testing:
- [ ] Advanced filters work
- [ ] News quality scoring accurate
- [ ] Analytics dashboard loads
- [ ] Performance tracking works

---

## 📊 Success Metrics

Track these after implementation:

| Metric | Before | Target | Actual |
|--------|--------|--------|--------|
| Pattern Accuracy | ? | >70% | ___ |
| Win Rate | ? | >55% | ___ |
| False Signals | ? | <35% | ___ |
| Analysis Time | ? | <45s | ___ |

---

## 🆘 Troubleshooting

### AI responses not detailed enough
- Check if system prompt was updated correctly
- Verify prompt includes "show your reasoning"
- Increase max_tokens if responses are cut off

### Validation too strict
- Adjust thresholds in validation.ts
- Convert errors to warnings for edge cases
- Log validation results to tune thresholds

### Performance issues
- Cache multi-timeframe data
- Parallelize data fetching
- Optimize database queries

---

*Implementation Guide v1.0*
*Last Updated: February 8, 2026*
