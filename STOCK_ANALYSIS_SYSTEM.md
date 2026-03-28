# Stock Analysis System — Complete Technical Documentation

> **Stock-Assist v5** | Last updated: 2026-03-28
> This document describes every algorithm, formula, threshold, weight, and pipeline step in the stock analysis engine — exactly as implemented in production code.

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Architecture & Pipeline](#2-architecture--pipeline)
3. [Data Layer](#3-data-layer)
4. [Indicator Calculation Engine](#4-indicator-calculation-engine)
5. [Pattern Detection Engine](#5-pattern-detection-engine)
6. [Smart Money Concepts (SMC) Engine](#6-smart-money-concepts-smc-engine)
7. [Multi-Timeframe Technical Analysis](#7-multi-timeframe-technical-analysis)
8. [Market Regime Classification](#8-market-regime-classification)
9. [Confidence Scoring — Split Model](#9-confidence-scoring--split-model)
10. [Data-Derived Modifiers](#10-data-derived-modifiers)
11. [Signal Composition & Entry Zones](#11-signal-composition--entry-zones)
12. [Pattern Confluence](#12-pattern-confluence)
13. [Fundamental-Technical Conflict Detection](#13-fundamental-technical-conflict-detection)
14. [AI Enhancement Layer](#14-ai-enhancement-layer)
15. [Screening & Ranking](#15-screening--ranking)
16. [API Routes](#16-api-routes)
17. [Trading Constants](#17-trading-constants)
18. [Type Definitions](#18-type-definitions)
19. [Complete Threshold Reference](#19-complete-threshold-reference)

---

## 1. System Overview

Stock-Assist is a multi-phase, data-driven stock analysis engine that screens NIFTY 100+ liquid NSE stocks and generates swing trading recommendations (1-5 day holding period). The system combines:

- **Technical Indicators** — RSI, MACD, Moving Averages, Volume, ATR, Bollinger Bands, Fibonacci
- **Candlestick Pattern Recognition** — 22 Japanese candlestick patterns with volume confirmation
- **Smart Money Concepts (SMC)** — Order Blocks, Fair Value Gaps, Break of Structure, Change of Character, Liquidity Sweeps
- **Market Regime Classification** — 5 regimes with regime-specific weight allocation
- **Split Confidence Model** — Separate Direction (Model A) and Strength (Model B) scoring
- **Data-Derived Modifiers** — Empirical win-rate delta adjustments
- **Multi-Timeframe Analysis** — Daily + Weekly + Monthly alignment scoring
- **AI Enhancement** — Groq (Llama 3.3 70B) + Google Gemini ensemble with structured prompts
- **Fundamental Analysis** — PE, PB, dividend yield, growth, sector comparison
- **News Sentiment** — Enhanced news analysis with breaking news detection

**Universe**: ~200 liquid NSE stocks (NIFTY 50 + NIFTY Next 50 + liquid midcaps)
**Output**: Top 10 ranked stocks with full analysis, trade plans, and AI commentary

---

## 2. Architecture & Pipeline

**File**: `apps/api/src/services/analysis/singleAnalysisOrchestrator.ts`

The single analysis orchestrator runs a 12-step pipeline for each stock:

```
Step 1:  Fetch historical OHLCV data (daily, weekly, monthly)
Step 2:  Calculate technical indicators (RSI, MACD, MA, Volume, ATR)
Step 3:  Detect candlestick patterns across 3 timeframes
Step 4:  Run SMC engine (Order Blocks, FVGs, BOS, CHoCH, Liquidity Sweeps)
Step 5:  Classify market regime (Trending, Ranging, Volatile, Event-driven)
Step 6:  Run split confidence model (Direction + Strength)
Step 7:  Apply data-derived modifiers (empirical win-rate adjustments)
Step 8:  Compose SMC signal (entry zones, conviction scoring)
Step 9:  Detect fundamental-technical conflicts
Step 10: Calculate pattern confluence (multi-timeframe agreement)
Step 11: Apply display corrections (Chart Alignment inversion for bearish)
Step 12: Run AI ensemble (Groq + Gemini) with all data passed to prompt
Step 13: Reconcile AI output with system probabilities (system takes priority)
Step 14: Assemble final response
```

**Key Design Decisions:**
- System direction model is authoritative over AI for recommendation (BUY/SELL/HOLD)
- AI provides qualitative analysis (reasoning, risks, triggers) — not probabilities
- System-calculated probabilities override AI probabilities in the final output
- If system says SELL but AI says BUY, the system wins

---

## 3. Data Layer

### 3.1 Stock Universe

**File**: `packages/shared/src/constants/stocks.ts`

The screening universe contains ~200 liquid NSE stocks organized as:
- **NIFTY 50** (50 stocks) — largest by market cap
- **NIFTY Next 50** (50 stocks) — next tier
- **Liquid Midcaps** (~100 stocks) — selected for high liquidity

Each stock entry contains: `{ symbol, name, sector }`

### 3.2 Historical Data

Data is fetched from Yahoo Finance via the `yahoo-finance2` library:
- **Daily**: 6 months of daily OHLCV candles
- **Weekly**: 1 year of weekly OHLCV candles
- **Monthly**: 2 years of monthly OHLCV candles

### 3.3 Fundamental Data

**File**: `apps/api/src/services/data/fundamentals.ts`

Fetched per stock:
- PE Ratio, PB Ratio, Dividend Yield
- Revenue/earnings growth metrics
- Valuation classification: `undervalued | fair | overvalued`
- Growth classification: `strong | moderate | weak`

### 3.4 News Data

**File**: `apps/api/src/services/news/enhanced.ts`

- Fetches news from last 72 hours
- Classifies sentiment per article: `positive | negative | neutral`
- Detects breaking news with impact level: `high | medium | low`
- Calculates overall sentiment score (0-100)

---

## 4. Indicator Calculation Engine

### 4.1 Moving Averages

**File**: `apps/api/src/services/indicators/ma.ts`

#### Simple Moving Average (SMA)
```
SMA(period) = sum(last <period> closing prices) / period
```

Calculated periods: **SMA20**, **SMA50**, **SMA200**

#### Exponential Moving Average (EMA)
```
multiplier = 2 / (period + 1)
EMA = (currentPrice - previousEMA) × multiplier + previousEMA
```
Starting value: SMA of first `period` candles

Calculated periods: **EMA9**, **EMA21**

#### Trend Determination
```
IF price > SMA20 AND price > SMA50 AND SMA20 > SMA50:
    trend = 'bullish'
ELSE IF price < SMA20 AND price < SMA50 AND SMA20 < SMA50:
    trend = 'bearish'
ELSE:
    trend = 'neutral'
```
A 0.5% buffer is applied to avoid whipsaw near crossover points.

**Output (MAResult):**
| Field | Type | Description |
|-------|------|-------------|
| sma20 | number | 20-period SMA |
| sma50 | number | 50-period SMA |
| sma200 | number | 200-period SMA |
| ema9 | number | 9-period EMA |
| ema21 | number | 21-period EMA |
| trend | string | `bullish` / `bearish` / `neutral` |

---

### 4.2 Relative Strength Index (RSI)

**File**: `apps/api/src/services/indicators/rsi.ts`

#### Formula (Wilder's Smoothing, 14-period default)
```
For each price change:
    gain = max(0, change)
    loss = max(0, -change)

avgGain = sum(gains over period) / period
avgLoss = sum(losses over period) / period
RS = avgGain / avgLoss
RSI = 100 - (100 / (1 + RS))
```

#### Interpretation Thresholds
| RSI Range | Interpretation |
|-----------|---------------|
| >= 70 | `overbought` |
| <= 40 | `oversold` |
| 41 - 69 | `neutral` |

> **Note**: The system uses 40 (not 30) as the oversold threshold for initial interpretation. However, the confidence scoring engine applies context-aware RSI analysis with different thresholds (see Section 9).

**Output (RSIResult):**
| Field | Type | Description |
|-------|------|-------------|
| value | number | RSI value (0-100) |
| interpretation | string | `oversold` / `neutral` / `overbought` |

---

### 4.3 MACD (Moving Average Convergence Divergence)

**File**: `apps/api/src/services/indicators/volume.ts`

#### Formula
```
MACD Line = EMA12 - EMA26
Signal Line = EMA9(MACD Line)
Histogram = MACD Line - Signal Line
```

#### Trend Determination
```
IF (histogram > 0 AND macd > 0) OR (histogram > 0 AND macd < 0):
    trend = 'bullish'
ELSE IF (histogram < 0 AND macd < 0) OR (histogram < 0 AND macd > 0):
    trend = 'bearish'
ELSE:
    trend = 'neutral'
```

#### Divergence Detection (20-candle lookback)
```
Bearish Divergence: Price makes higher high BUT MACD histogram fails to make higher high
Bullish Divergence: Price makes lower low BUT MACD histogram fails to make lower low
```

**Output (MACDResult):**
| Field | Type | Description |
|-------|------|-------------|
| macd | number | MACD line value |
| signal | number | Signal line value |
| histogram | number | MACD - Signal |
| trend | string | `bullish` / `bearish` / `neutral` |
| divergence | string | `bullish` / `bearish` / `none` |

---

### 4.4 Volume Analysis

**File**: `apps/api/src/services/indicators/volume.ts`

#### Formula
```
average = mean(all candle volumes)
ratio = currentVolume / average
```

#### Trend Classification
| Volume Ratio | Trend |
|-------------|-------|
| > 1.5 | `high` |
| 0.5 - 1.5 | `normal` |
| < 0.5 | `low` |

**Output (VolumeAnalysis):**
| Field | Type | Description |
|-------|------|-------------|
| current | number | Current candle volume |
| average | number | Average volume |
| ratio | number | current / average |
| trend | string | `high` / `normal` / `low` |

---

### 4.5 Average True Range (ATR)

**File**: `apps/api/src/services/indicators/volume.ts`

#### Formula (14-period default)
```
True Range = max(
    high - low,
    abs(high - previousClose),
    abs(low - previousClose)
)
ATR = mean(True Range over period)
```

Used for: stop-loss calculation, entry zone sizing, SMC impulse detection.

---

## 5. Pattern Detection Engine

**File**: `apps/api/src/services/analysis/candlestick.ts`

The engine detects **22 Japanese candlestick patterns** across three categories.

### 5.1 Single-Candle Patterns

| # | Pattern | Type | Weight | Detection Rule |
|---|---------|------|--------|---------------|
| 1 | Doji (Gravestone) | Bearish | 0.50 | Body < 10% range, long upper shadow |
| 2 | Doji (Dragonfly) | Bullish | 0.50 | Body < 10% range, long lower shadow |
| 3 | Doji (Plain) | Neutral | 0.30 | Body < 10% range, equal shadows |
| 4 | Hammer | Bullish | 0.60-0.75 | Lower shadow >= 2x body, small upper shadow. STRONG (0.75) if confirmed downtrend (2+ of last 3 candles bearish) |
| 5 | Hanging Man | Bearish | 0.55 | Same shape as Hammer, only valid after uptrend |
| 6 | Shooting Star | Bearish | 0.60 | Upper shadow >= 2x body, small lower shadow, after uptrend |
| 7 | Inverted Hammer | Bullish | 0.45 | Long upper shadow, small lower shadow, after downtrend |
| 8 | Bullish Marubozu | Bullish | 0.80 | Full bullish candle, no shadows (body/range >= 95%) |
| 9 | Bearish Marubozu | Bearish | 0.80 | Full bearish candle, no shadows |
| 10 | Spinning Top | Neutral | 0.25 | Small body (10-30% range), long shadows |

### 5.2 Two-Candle Patterns

| # | Pattern | Type | Weight | Detection Rule |
|---|---------|------|--------|---------------|
| 11 | Bullish Engulfing | Bullish | 0.80 | Prev: bearish, Curr: bullish. curr.open < prev.close AND curr.close > prev.open |
| 12 | Bearish Engulfing | Bearish | 0.80 | Prev: bullish, Curr: bearish. curr.open > prev.close AND curr.close < prev.open |
| 13 | Piercing Line | Bullish | 0.65 | Curr closes above midpoint of prev bearish body but below prev.open |
| 14 | Dark Cloud Cover | Bearish | 0.65 | Curr closes below midpoint of prev bullish body |
| 15 | Bullish Harami | Bullish | 0.45 | Small bullish candle inside prior bearish body (curr.body < prev.body x 0.5) |
| 16 | Bearish Harami | Bearish | 0.45 | Small bearish candle inside prior bullish body |

### 5.3 Three-Candle Patterns

| # | Pattern | Type | Weight | Detection Rule |
|---|---------|------|--------|---------------|
| 17 | Morning Star | Bullish | 0.85 | C1: large bearish. C2: small body (doji-like). C3: bullish, closes above C1 midpoint |
| 18 | Evening Star | Bearish | 0.85 | C1: large bullish. C2: small body. C3: bearish, closes below C1 midpoint |
| 19 | Three White Soldiers | Bullish | 0.85 | 3 consecutive bullish candles, each opens within previous body, each closes higher, small upper shadows (< 20% range) |
| 20 | Three Black Crows | Bearish | 0.85 | 3 consecutive bearish candles, mirror of Three White Soldiers |
| 21 | Three Inside Up | Bullish | 0.65 | C1: bearish. C2: bullish harami inside C1. C3: bullish closes above C1.open |
| 22 | Three Inside Down | Bearish | 0.65 | C1: bullish. C2: bearish harami. C3: bearish closes below C1.open |

### 5.4 Volume Confirmation Boost

Applied to all patterns based on last candle volume vs 9-candle average:

| Volume Ratio | Boost |
|-------------|-------|
| >= 2.0x | +0.15 |
| >= 1.5x | +0.10 |
| >= 1.2x | +0.05 |
| < 1.2x | +0.00 |

### 5.5 Composite Score

```
compositeScore = (bullishPatternWeights - bearishPatternWeights) / totalPatterns
Range: -1.0 to +1.0

IF compositeScore > 0.15  -> dominantBias = 'bullish'
IF compositeScore < -0.15 -> dominantBias = 'bearish'
ELSE                      -> dominantBias = 'neutral'
```

---

## 6. Smart Money Concepts (SMC) Engine

**File**: `apps/api/src/services/analysis/smc.ts`

The SMC engine models institutional trading behavior by detecting structural patterns.

### 6.1 Swing Point Detection

```
Swing High: candle with lower highs on BOTH sides (minimum 3-candle lookback)
Swing Low:  candle with higher lows on BOTH sides
Only recent swings within last 20 candles (SWING_LOOKBACK_CANDLES = 20)
```

### 6.2 Order Block (OB) Detection

Order Blocks represent institutional buy/sell zones where large orders were placed.

```
Bullish OB: Last bearish candle before a bullish impulse >= 1.5 x ATR
Bearish OB: Last bullish candle before a bearish impulse >= 1.5 x ATR

OB_IMPULSE_ATR_MULTIPLIER = 1.5
MAX_OB_AGE = 50 candles

Status:
  Mitigated   = price has traded through the zone (no longer valid)
  Unmitigated = still valid for reversal

Swing Boost: +0.15 strength if OB coincides with a swing point (within 0.5% tolerance)
```

### 6.3 Fair Value Gap (FVG) Detection

FVGs represent price imbalances left during impulsive moves.

```
Bullish FVG: candle[i+2].low > candle[i].high (upward gap)
Bearish FVG: candle[i+2].high < candle[i].low (downward gap)

Status:
  Filled   = price has traded into the gap zone
  Unfilled = still valid as a magnet/target

MAX_OB_AGE = 50 candles (same limit)
```

### 6.4 Break of Structure (BOS)

BOS signals trend continuation:
```
Bullish BOS: close > most recent swing high (in existing uptrend)
Bearish BOS: close < most recent swing low (in existing downtrend)
```

### 6.5 Change of Character (CHoCH)

CHoCH signals potential trend reversal:
```
Bullish CHoCH: downtrend -> price closes above recent swing high
Bearish CHoCH: uptrend -> price closes below recent swing low

Confirmation: next candle closes >= 0.3 x ATR beyond CHoCH level
CHOCH_CONFIRM_ATR_MULTIPLIER = 0.3
```

### 6.6 Liquidity Sweep Detection

Liquidity sweeps detect stop-hunt patterns (institutional manipulation):
```
Bullish Sweep: candle wicks below swing low but CLOSES above it
Bearish Sweep: candle wicks above swing high but CLOSES below it

Confirmation: next candle moves >= 0.5 x ATR in reversal direction
SWEEP_CONFIRM_ATR_MULTIPLIER = 0.5

Conviction Boost: +0.15 if sweep occurs at an unmitigated Order Block zone
```

### 6.7 Trend State

```
IF last 2 swing highs increasing AND last 2 swing lows increasing -> UPTREND
IF last 2 swing highs decreasing AND last 2 swing lows decreasing -> DOWNTREND
ELSE -> RANGING
```

---

## 7. Multi-Timeframe Technical Analysis

**File**: `apps/api/src/services/analysis/technicalAnalysis.ts`

### 7.1 Per-Timeframe Analysis

For each timeframe (daily, weekly, monthly), the system calculates:
- All technical indicators (RSI, MACD, MA, Volume, ATR)
- Pattern detection (candlestick patterns)
- Trend direction and strength
- Key support/resistance levels
- Bollinger Bands and Fibonacci levels (daily only)

### 7.2 Timeframe Alignment Scoring

```
IF daily + weekly + monthly all same direction:
    alignment = 'bullish' or 'bearish'
    alignmentScore = 100

IF no agreement:
    alignment = 'neutral'
    alignmentScore = 50

IF mixed:
    alignment = 'mixed'
    alignmentScore = 50 + (bullishCount - bearishCount) x 15
```

### 7.3 Output

```typescript
{
  multiTimeframe: {
    timeframes: {
      '1D': { patterns, trend, strength, keyLevels },
      '1W': { patterns, trend, strength, keyLevels },
      '1M': { patterns, trend, strength, keyLevels }
    },
    alignment: 'bullish' | 'bearish' | 'neutral' | 'mixed',
    alignmentScore: number  // 0-100
  },
  candlestickAnalysis: CandlestickAnalysis,
  bollingerBands: { upper, middle, lower, width },
  fibonacciLevels: { ... },
  indicators: { daily, weekly, monthly },
  patterns: { daily, weekly, monthly },
  smcAnalysis: SMCAnalysis
}
```

---

## 8. Market Regime Classification

**File**: `apps/api/src/services/analysis/regimeClassifier.ts`

The regime classifier determines the current market environment to dynamically adjust scoring weights.

### 8.1 Five Regimes

| # | Regime | Detection Rule | Confidence |
|---|--------|---------------|------------|
| 1 | EVENT_DRIVEN | hasBreakingNews AND newsImpact == 'high' | 85 |
| 2 | VOLATILE | ATR/ATR_mean > 2.0 AND volumeRatio > 1.8 | min(95, atrMultiple x 30) |
| 3 | TRENDING_STRONG | ADX >= 25 | 90 (if alignment >= 65) else 70 |
| 4 | TRENDING_WEAK | ADX >= 15 AND < 25 | 65 |
| 5 | RANGE | ADX < 15 (default) | 75 |

Priority: EVENT_DRIVEN > VOLATILE > TRENDING_STRONG > TRENDING_WEAK > RANGE

### 8.2 Regime-Specific Weights

| Component | TRENDING_STRONG | TRENDING_WEAK | RANGE | VOLATILE | EVENT_DRIVEN |
|-----------|----------------|---------------|-------|----------|--------------|
| Technical | 0.50 | 0.40 | 0.25 | 0.30 | 0.15 |
| Pattern | 0.18 | 0.20 | 0.15 | 0.10 | 0.05 |
| Volume | 0.15 | 0.15 | 0.20 | 0.25 | 0.15 |
| News | 0.07 | 0.10 | 0.15 | 0.20 | 0.45 |
| Fundamental | 0.10 | 0.15 | 0.25 | 0.15 | 0.20 |

### 8.3 Empirical Weight Learning

The system can override static weights with learned empirical weights:

```
Requires: MIN_SIGNALS_FOR_EMPIRICAL_WEIGHTS = 100 signals per regime
Cache TTL: 1 hour

Algorithm:
  For each factor, measure: win_gap = avgValue(winners) - avgValue(losers)
  Highest gap -> highest weight
  Normalize all gaps to sum = 1.0
  Apply 5% minimum floor per factor
  Re-normalize to ensure sum = 1.0
```

---

## 9. Confidence Scoring — Split Model

**File**: `apps/api/src/services/analysis/confidenceScoring.ts`

The split model separates **direction** (which way) from **strength** (how confident), preventing scenarios where a weak bearish signal scores high just because one sub-score is strong.

### 9.1 Model A: Direction (Weighted Signal Counting)

#### Bullish Signals (10 base + weekly/monthly)

| # | Signal | Weight | Condition |
|---|--------|--------|-----------|
| 1 | MA bullish | 3 | ma.trend === 'bullish' |
| 2 | EMA crossover | 2 | ema9 > ema21 |
| 3 | MACD bullish | 3 | macd.trend === 'bullish' |
| 4 | MACD histogram positive | 1 | macd.histogram > 0 |
| 5 | MACD bullish divergence | 2 | macd.divergence === 'bullish' |
| 6 | RSI mid-range in uptrend | 1 | RSI 50-60 AND ma.trend === 'bullish' |
| 7 | RSI oversold reversal | 2 | RSI 30-40 AND ma.trend !== 'bearish' |
| 8 | Bullish candlestick pattern | 3 | primary pattern type === 'bullish' |
| 9 | At breakout | 2 | patterns.atBreakout === true |
| 10 | Volume confirmed uptrend | 1 | volume.ratio > 1.2 AND ma.trend === 'bullish' |
| 11 | Weekly bullish (if available) | 3 | weeklyIndicators.ma.trend === 'bullish' |
| 12 | Monthly bullish (if available) | 3 | monthlyIndicators.ma.trend === 'bullish' |

#### Bearish Signals (10 base + weekly/monthly)

| # | Signal | Weight | Condition |
|---|--------|--------|-----------|
| 1 | MA bearish | 3 | ma.trend === 'bearish' |
| 2 | EMA death cross | 2 | ema9 < ema21 |
| 3 | MACD bearish | 3 | macd.trend === 'bearish' |
| 4 | MACD histogram negative | 1 | macd.histogram < 0 |
| 5 | MACD bearish divergence | 2 | macd.divergence === 'bearish' |
| 6 | RSI overbought | 2 | RSI > 70 |
| 7 | RSI weak in downtrend | 2 | RSI < 35 AND ma.trend === 'bearish' |
| 8 | Bearish candlestick pattern | 3 | primary pattern type === 'bearish' |
| 9 | Volume confirmed downtrend | 1 | volume.ratio > 1.2 AND ma.trend === 'bearish' |
| 10 | Heavy selling volume | 2 | volume.ratio > 1.5 AND ma.trend === 'bearish' |
| 11 | Weekly bearish (if available) | 3 | weeklyIndicators.ma.trend === 'bearish' |
| 12 | Monthly bearish (if available) | 3 | monthlyIndicators.ma.trend === 'bearish' |

#### Direction Determination Logic

```
Priority order:
1. IF bullishCount > bearishCount AND bullishCount >= 3 -> BULLISH
2. IF bearishCount > bullishCount AND bearishCount >= 3 -> BEARISH
3. IF bullishWeightedScore > bearishWeightedScore AND bullishCount >= 2 -> BULLISH
4. IF bearishWeightedScore > bullishWeightedScore AND bearishCount >= 2 -> BEARISH
5. IF bullishCount > bearishCount -> BULLISH
6. IF bearishCount > bullishCount -> BEARISH
7. ELSE -> NEUTRAL

Conviction = (dominantWeightedScore / dominantTotalWeight) x 100
```

---

### 9.2 Model B: Strength (Weighted Sub-Scores)

Five sub-scores are calculated, each ranging 0-100, then combined with regime-specific weights.

#### Sub-Score 1: Technical Alignment (0-100)

Starting from base = 50:

**RSI Scoring (Context-Aware):**
| RSI Range | Trend Context | Adjustment | Rationale |
|-----------|--------------|------------|-----------|
| >= 75 | Bullish | +5 | Momentum, not reversal |
| >= 75 | Not bullish | -20 | High reversal risk |
| 70-74 | Bullish | +8 | Bullish momentum |
| 70-74 | Not bullish | -10 | Caution zone |
| 55-69 | Any | +20 | Bullish momentum |
| 40-54 | Any | +10 | Healthy range |
| 30-39 | Bearish | -10 | Falling knife |
| 30-39 | Bullish | +25 | Strong buying opportunity |
| 30-39 | Neutral | +8 | Potential bounce |
| < 30 | Bearish | -15 | Capitulation sell-off |
| < 30 | Not bearish | +5 | Possible reversal |

**MACD Scoring:**
```
Bullish trend: +22, plus +min(10, abs(histogram) x 2) if histogram > 0
Bearish trend: -18, plus -min(8, abs(histogram) x 2) if histogram < 0
Bullish divergence: +15
Bearish divergence: -12
```

**MA Trend:**
```
Bullish: +18
Bearish: -18
```

**EMA 9/21:**
```
EMA9 > EMA21: +12
EMA9 < EMA21: -10
```

**Multi-Timeframe (Strongest Factor):**
| Condition | Adjustment |
|-----------|-----------|
| Daily + Weekly + Monthly all aligned | +30 |
| Daily + Weekly aligned (no monthly) | +22 |
| Daily + Weekly aligned (monthly differs) | +18 |
| Mixed signals | -4 to -8 |

Result clamped to [0, 100].

#### Sub-Score 2: Pattern Strength (0-100)

```
IF no primary pattern:
    base = 30

IF primary pattern exists:
    score = primary.confidence
    + 20 (if type === 'bullish')
    + 20 (if type === 'bearish')

IF trend.strength > 70: score += 20
ELSE IF trend.strength > 50: score += 12

IF atBreakout: score += 25
IF secondary patterns exist: score += min(10, count x 5)

Result clamped to [0, 100]
```

#### Sub-Score 3: Volume Confirmation (0-100)

| Volume Ratio | Score | Label |
|-------------|-------|-------|
| > 2.5 | 100 | Massive volume |
| > 2.0 | 92 | Exceptional volume |
| > 1.5 | 82 | High confirmation |
| > 1.2 | 70 | Above average |
| > 1.0 | 58 | Normal volume |
| > 0.7 | 40 | Below average |
| > 0.4 | 25 | Low volume |
| <= 0.4 | 15 | Very low volume |

#### Sub-Score 4: News Sentiment (0-100)

```
base = news.sentimentScore (already 0-100)

IF impactLevel == 'high':
    positive news: +25
    negative news: -25
ELSE IF impactLevel == 'medium':
    positive: +15
    negative: -15

IF no recent news: score = 50 (truly neutral)

Result clamped to [0, 100]
```

#### Sub-Score 5: Fundamental Strength (0-100)

```
base = 50

Valuation:
    undervalued: +28
    overvalued:  -22
    fair:        +5

Growth:
    strong:   +22
    weak:     -18
    moderate: +10

Sector comparison:
    outperforming:    +15
    underperforming:  -15

Result clamped to [0, 100]
```

---

### 9.3 Strength Calculation with Amplification

```
strengthScore =
    technicalAlignment x weights.technical +
    patternStrength x weights.pattern +
    volumeConfirmation x weights.volume +
    newsSentiment x weights.news +
    fundamentalStrength x weights.fundamental
```

#### Signal Amplification

When signals strongly agree, the score is amplified:

| Dominant Signal Count | Multiplier |
|----------------------|-----------|
| >= 7 | x 1.25 (+25%) |
| >= 5 | x 1.18 (+18%) |
| >= 4 | x 1.10 (+10%) |
| <= 1 (NEUTRAL) | Regress 15% toward 50 |

#### Conviction Profile Floors

Strong multi-timeframe alignment guarantees minimum scores:

| Condition | Floor |
|-----------|-------|
| All timeframes bullish/bearish + volume >= 1.2x | 78 |
| Daily + weekly aligned, no monthly | 72 |
| At breakout + volume >= 1.5x | 80 |
| RSI <= 35 + MACD bullish + volume >= 1.0x | 75 |
| ADX >= 30 + all timeframes aligned | 82 |
| Pattern confidence >= 70% + daily/weekly aligned | 70 |

#### Non-Linear Sigmoid Push

Amplifies scores toward extremes (away from 50):

```
normalized = (score - 50) / 50          // Range: -1 to +1
pushed = tanh(1.6 x normalized)
result = round(50 + 50 x pushed)
```

Steepness = 1.6

#### Candlestick Bonus

```
IF candlestickComposite > 0.2 AND direction is BULLISH:
    strengthScore += abs(composite x 15)
IF candlestickComposite < -0.2 AND direction is BEARISH:
    strengthScore += abs(composite x 15)
```

#### Final Clamping

```
strengthScore = clamp(strengthScore, 15, 95)
```

---

### 9.4 Recommendation Logic

```
IF score >= 60 AND direction == 'BULLISH' -> BUY
IF score >= 60 AND direction == 'BEARISH' -> SELL
IF score >= 50 AND conviction >= 70 AND direction == 'BULLISH' -> BUY
IF score >= 50 AND conviction >= 70 AND direction == 'BEARISH' -> SELL
IF direction == 'NEUTRAL' AND score < 35 -> WAIT
ELSE -> HOLD
```

---

## 10. Data-Derived Modifiers

**File**: `apps/api/src/services/analysis/dataDerivedModifiers.ts`

Instead of using assumed modifier values, the system computes modifiers from actual historical win rates.

### 10.1 Empirical Modifier Formula

```
modifier = winRate(signals WITH condition) - winRate(baseline signals WITHOUT condition)
```

Example: If signals with volume > 1.5x have 68% win rate and baseline is 52%, the derived modifier is +16%.

### 10.2 Static Fallback Modifiers

Used when insufficient historical data (< 30 samples per side):

| Condition | Modifier |
|-----------|---------|
| Volume >= 1.5x (high) | +8% |
| Volume >= 1.2x (confirmed) | +5% |
| Volume < 0.8x (low) | -8% |
| Alignment >= 100 (perfect) | +15% |
| Alignment >= 65 (strong) | +8% |
| Alignment >= 50 (neutral) | 0% |
| Alignment < 50 (conflict) | -10% |
| ADX >= 25 (strong trend) | +8% |
| ADX < 20 (weak) | -5% |
| ADX < 15 (choppy) | -8% |

**Minimum Samples**: 30 per side
**Cache TTL**: 2 hours

---

## 11. Signal Composition & Entry Zones

### 11.1 Entry Zone Calculator

**File**: `apps/api/src/services/analysis/entryZone.ts`

Calculates precise entry zones based on SMC structures.

#### Entry Trigger Priority

1. **Liquidity Sweep** (highest conviction) — entry at sweep zone
2. **Order Block** (unmitigated) — entry at OB zone
3. **Fair Value Gap** — entry at FVG zone (only if distance <= 1.0 x ATR)
4. **None** — return null (no qualifying zone)

#### Stop Loss Calculation

```
Bullish: stopLoss = entryAnchor - 0.5 x ATR
Bearish: stopLoss = entryAnchor + 0.5 x ATR
```

#### Target Calculation

**Target 1 (Primary):**
```
Priority 1: Nearest unfilled FVG in trade direction
Priority 2: Nearest swing point (high for bullish, low for bearish)
Fallback:   entry_mid +/- 1.5 x ATR
```

**Target 2 (Extended):**
```
entry_mid +/- 2.0 x ATR
```

#### Risk:Reward Validation

```
risk = |entry_mid - stopLoss|
reward = |target1 - entry_mid|
riskReward = reward / risk

MIN_RISK_REWARD = 2.0 (must be 1:2 or better)
IF riskReward < 2.0 -> entryZone.isValid = false (rejected)
```

### 11.2 Signal Composer

**File**: `apps/api/src/services/analysis/signalComposer.ts`

Calculates a conviction score (separate from confidence) based on SMC structures.

#### Conviction Point System (Max 100)

| Component | Points | Condition |
|-----------|--------|-----------|
| MTF Alignment | 0-25 | Scale alignmentScore (0-100) to (0-25) |
| CHoCH Daily | 20 | Confirmed Change of Character |
| Unmitigated OB | 15 | Institutional zone still active |
| Liquidity Sweep | 15 | Stop-hunt reversal detected |
| Volume Spike | 10 | Volume > 1.5x average |
| FVG Target | 10 | Unfilled Fair Value Gap exists |
| Candlestick | 5 | Pattern aligns with direction |
| Ranging Penalty | -15 | ADX < 20 (dampens conviction) |

#### Status Determination

```
IF convictionScore < 55 (MIN_CONVICTION) -> NO_SETUP
IF entryZone == null OR !entryZone.isValid -> NO_SETUP
IF currentPrice is INSIDE entry zone -> SETUP_ACTIVE
ELSE -> WAITING_FOR_ENTRY
```

---

## 12. Pattern Confluence

**File**: `apps/api/src/services/analysis/patternConfluence.ts`

Measures agreement of candlestick patterns across daily, weekly, and monthly timeframes.

### Agreement Scoring

Only patterns with confidence > 60% are counted.

| Agreement Level | Condition | Confidence Modifier |
|----------------|-----------|-------------------|
| STRONG | All 3 timeframes agree | +20 |
| MODERATE | 2 agree + 1 neutral | +10 |
| WEAK | No clear pattern | -10 |
| CONFLICT | 1+ bullish AND 1+ bearish | -25 |

```
baseScore = (maxCount / 3) x 100
```

---

## 13. Fundamental-Technical Conflict Detection

**File**: `apps/api/src/services/analysis/fundamentalTechnical.ts`

Detects when fundamental data contradicts technical signals.

### Conflict Types

| Conflict | Condition | Adjustment |
|----------|-----------|-----------|
| NONE | F and T aligned | 0 |
| OVERVALUED_BULLISH | Technical bullish but PE > 30, overvalued | -15 |
| UNDERVALUED_BEARISH | Technical bearish but undervalued + strong growth | -10 |
| WEAK_GROWTH_BULLISH | Technical bullish but weak earnings growth | -10 |

### Turnaround Exception

```
IF alignmentScore > 85 AND volumeRatio > 2.0:
    Classify as "Turnaround/Momentum Play"
    Ignore fundamental weakness
    Adjustment: +10 (boost instead of penalty)
```

---

## 14. AI Enhancement Layer

### 14.1 AI Ensemble

**File**: `apps/api/src/services/ai/ensembleAI.ts`

The system queries two AI providers in parallel:
1. **Groq** — Llama 3.3 70B Versatile (primary)
2. **Google Gemini** — Gemini 2.0 Flash (secondary)

Both receive the same prompt (`buildPrompt`). The ensemble picks the best response or merges them.

### 14.2 AI Prompt (for Groq/Gemini)

**File**: `apps/api/src/services/ai/prompt.ts`

The prompt now includes ALL available data:

```
Sections provided to AI:
1. Price data (current, change, range, volume)
2. Daily technical indicators (RSI, MACD, MA, EMA, S/R, ADX)
3. Pattern detection results
4. Weekly timeframe indicators
5. Monthly timeframe indicators
6. Timeframe biases (daily/weekly/monthly alignment)
7. Timeframe confluence (agreement score)
8. Fundamentals (valuation, growth, dividend yield)
9. Sector comparison (outperformance)
10. News sentiment (headlines)
11. System direction hint (our pre-analysis for reference)
```

**4-Step Reasoning Framework (forced on AI):**

```
STEP 1 — COUNT THE EVIDENCE
  Classify every indicator as bullish/bearish/neutral.
  RSI oversold in downtrend = falling knife (BEARISH), not a bounce.

STEP 2 — DETERMINE DIRECTION
  More bearish -> BEARISH. More bullish -> BULLISH.
  Probability = 55 + (signal_difference x 5), capped at 85.

STEP 3 — SET TRADE LEVELS
  Entry near current price. SL beyond nearest S/R. Targets at next S/R.
  Risk:Reward >= 1:1.5.

STEP 4 — WRITE RECOMMENDATION
  Must be exactly one word: BUY, SELL, or HOLD.
```

**Critical Rules enforced on AI:**
1. bullish.probability + bearish.probability MUST equal 100
2. Side with more evidence MUST have higher probability
3. If 4+ indicators agree -> that side >= 65% probability
4. Weekly/monthly matter MORE than daily for direction
5. Max capital Rs 15,000, max risk Rs 500, holding 1-5 days

### 14.3 Copy Prompt (User-Facing)

**File**: `apps/api/src/services/ai/enhancedPrompt.ts`

A human-readable version of the same prompt, designed for users to paste into ChatGPT/Claude. Includes the same step-by-step framework and all data sections, plus the system's own pre-analysis results.

### 14.4 Reconciliation (System vs AI)

In the orchestrator, after AI returns:

```
System probabilities OVERRIDE AI probabilities:
    bullish.probability = system-calculated bullishProb
    bearish.probability = system-calculated bearishProb

System recommendation OVERRIDES AI recommendation:
    IF system says BUY or SELL or WAIT -> use system's recommendation
    IF system says HOLD -> use AI's recommendation as tiebreaker

AI provides qualitative fields only:
    reasoning, risks, triggers, factors, confirmation
```

---

## 15. Screening & Ranking

### 15.1 Top Stocks Screener

**File**: `apps/api/src/services/screening/topStocks.ts`

1. Screens all ~200 stocks in the universe
2. Runs single analysis pipeline for each stock
3. Ranks by confidence score (descending)
4. Returns top 10 with signal persistence metadata
5. Results cached for 24 hours

### 15.2 Signal Clarity

**File**: `apps/api/src/services/screening/signalClarity.ts`

Additional filtering layer that measures how "clear" a trading signal is, penalizing mixed or ambiguous setups.

### 15.3 Chart Alignment Display Fix

In the orchestrator, the raw `technicalAlignment` sub-score (0 = bearish, 100 = bullish) is inverted for display when the direction is BEARISH:

```
IF direction === 'BEARISH' AND technicalAlignment < 40:
    displayAlignment = 100 - technicalAlignment
```

This ensures that a stock showing 12% raw alignment (strong bearish) displays as 88% "Chart Alignment" in the UI, consistent with the bearish direction.

---

## 16. API Routes

**File**: `apps/api/src/routes/stocks.ts`

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/stocks/top-10` | Get top 10 ranked stocks (cached 24h) |
| POST | `/api/stocks/top-10/refresh` | Force re-screen all stocks (rate-limited) |
| GET | `/api/stocks/analyze/:symbol` | Analyze single stock |

### Response Structure (Top 10)

```typescript
{
  success: boolean,
  stocks: StockCard[],           // Top 10 analysis results
  count: number,                 // Number returned
  totalScanned: number,          // Total stocks screened
  updatedAt: Date,
  metadata: {
    cached: boolean,
    isFallback: boolean,
    avgConfidence: number,       // Average confidence of top 10
    signalPersistence: {         // How many signals persisted across refreshes
      age3: number,
      age2: number,
      age1: number
    },
    directionSplit: {
      bullish: number,
      bearish: number
    }
  }
}
```

---

## 17. Trading Constants

**File**: `packages/shared/src/constants/trading.ts`

| Constant | Value | Description |
|----------|-------|-------------|
| CAPITAL | 15,000 | Maximum portfolio capital (INR) |
| MAX_RISK | 500 | Maximum loss per trade (INR) |
| MAX_POSITION_PERCENT | 40 | Max position size as % of capital |
| DEFAULT_STOP_LOSS_PERCENT | 1.5 | Default SL if not calculated |
| MAX_STOP_LOSS_PERCENT | 2 | Hard ceiling for stop loss |
| MIN_RISK_REWARD | 1.5 | Minimum risk:reward ratio |
| WIN_RATE_TARGET | 70 | Target win rate percentage |

---

## 18. Type Definitions

**Files**: `packages/shared/src/types/`

### Core Types

```typescript
// Stock data from Yahoo Finance
interface StockData {
  quote: {
    symbol: string;
    price: number;
    previousClose: number;
    changePercent: number;
    dayLow: number;
    dayHigh: number;
    volume: number;
  };
}

// Technical indicator results
interface TechnicalIndicators {
  rsi: RSIResult;
  ma: MAResult;
  macd: MACDResult;
  volume: VolumeAnalysis;
  sr: { support: number; resistance: number };
}

// Pattern analysis results
interface PatternAnalysis {
  primary: { name: string; confidence: number; type: string } | null;
  secondary: Pattern[];
  trend: { direction: string; strength: number };
  atBreakout: boolean;
}

// Direction model output
interface DirectionResult {
  direction: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  conviction: number;          // 0-100
  bullishSignals: number;
  bearishSignals: number;
  signalDetails: string[];
}

// Strength model output
interface StrengthResult {
  strength: number;            // 0-100
  breakdown: ConfidenceBreakdown;
  regime?: MarketRegime;
  weightsUsed: RegimeWeights;
}

// Combined split confidence result
interface SplitConfidenceResult {
  direction: DirectionResult;
  strength: StrengthResult;
  score: number;               // 15-95
  recommendation: 'BUY' | 'SELL' | 'HOLD' | 'WAIT';
  factors: string[];
  breakdown: ConfidenceBreakdown;
}

// Confidence breakdown sub-scores
interface ConfidenceBreakdown {
  technicalAlignment: number;  // 0-100
  patternStrength: number;     // 0-100
  volumeConfirmation: number;  // 0-100
  newsSentiment: number;       // 0-100
  fundamentalStrength: number; // 0-100
}
```

---

## 19. Complete Threshold Reference

### Decision Thresholds

| Metric | Threshold | Result |
|--------|-----------|--------|
| Confidence >= 60 + BULLISH | - | BUY |
| Confidence >= 60 + BEARISH | - | SELL |
| Confidence 50-59 + conviction >= 70 | - | BUY/SELL |
| Direction NEUTRAL + score < 35 | - | WAIT |
| All else | - | HOLD |

### Indicator Thresholds

| Indicator | Value | Meaning |
|-----------|-------|---------|
| RSI >= 70 | Overbought | Potential bearish |
| RSI <= 40 | Oversold (interpretation) | Context-dependent |
| RSI <= 30 | Deeply oversold | Falling knife if downtrend |
| ADX >= 25 | Strong trend | TRENDING_STRONG regime |
| ADX 15-24 | Weak trend | TRENDING_WEAK regime |
| ADX < 15 | Ranging | RANGE regime |
| Volume > 1.5x | High | Strong confirmation |
| Volume > 1.2x | Above average | Moderate confirmation |
| Volume < 0.5x | Very low | Weak signal |

### SMC Thresholds

| Parameter | Value | Purpose |
|-----------|-------|---------|
| OB Impulse ATR Multiplier | 1.5 | Minimum impulse to qualify as OB |
| Max OB/FVG Age | 50 candles | Expiry for stale structures |
| CHoCH Confirm ATR Multiplier | 0.3 | Confirmation beyond CHoCH level |
| Sweep Confirm ATR Multiplier | 0.5 | Confirmation of sweep reversal |
| Min Risk:Reward (Entry Zone) | 2.0 | R:R validation |
| Min Conviction (Signal) | 55 | Minimum to qualify as setup |
| FVG Proximity ATR | 1.0 | Max distance to use FVG as entry |

### Scoring Bounds

| Score Type | Minimum | Maximum |
|-----------|---------|---------|
| Confidence Score | 15 | 95 |
| Sub-scores | 0 | 100 |
| Signal Amplification | x0.85 (neutral) | x1.25 (7+ signals) |
| Sigmoid Steepness | 1.6 | - |

---

## File Reference

| File | Purpose |
|------|---------|
| `apps/api/src/services/analysis/singleAnalysisOrchestrator.ts` | Main 12-step pipeline |
| `apps/api/src/services/analysis/confidenceScoring.ts` | Split confidence model (Direction + Strength) |
| `apps/api/src/services/analysis/technicalAnalysis.ts` | Multi-timeframe technical analysis |
| `apps/api/src/services/analysis/candlestick.ts` | 22 candlestick pattern detection |
| `apps/api/src/services/analysis/regimeClassifier.ts` | 5-regime market classification |
| `apps/api/src/services/analysis/dataDerivedModifiers.ts` | Empirical win-rate modifiers |
| `apps/api/src/services/analysis/smc.ts` | Smart Money Concepts engine |
| `apps/api/src/services/analysis/signalComposer.ts` | SMC signal conviction scoring |
| `apps/api/src/services/analysis/entryZone.ts` | Entry zone calculation with R:R validation |
| `apps/api/src/services/analysis/patternConfluence.ts` | Multi-timeframe pattern agreement |
| `apps/api/src/services/analysis/fundamentalTechnical.ts` | F/T conflict detection |
| `apps/api/src/services/analysis/calibration.ts` | Historical calibration |
| `apps/api/src/services/indicators/ma.ts` | SMA/EMA calculation |
| `apps/api/src/services/indicators/rsi.ts` | RSI calculation |
| `apps/api/src/services/indicators/volume.ts` | Volume, MACD, ATR calculation |
| `apps/api/src/services/ai/prompt.ts` | AI prompt (Groq/Gemini) |
| `apps/api/src/services/ai/enhancedPrompt.ts` | Copy prompt (user-facing) |
| `apps/api/src/services/ai/ensembleAI.ts` | AI ensemble orchestration |
| `apps/api/src/services/data/fundamentals.ts` | Fundamental data fetching |
| `apps/api/src/services/news/enhanced.ts` | News sentiment analysis |
| `apps/api/src/services/screening/topStocks.ts` | Top 10 screening engine |
| `apps/api/src/services/screening/signalClarity.ts` | Signal clarity filtering |
| `apps/api/src/routes/stocks.ts` | API route handlers |
| `packages/shared/src/constants/trading.ts` | Trading constraints |
| `packages/shared/src/constants/stocks.ts` | Stock universe (~200 stocks) |
| `packages/shared/src/types/` | All shared TypeScript types |
