# Commodity Analysis System — Complete Technical Documentation

> **Stock-Assist v5** | Last updated: 2026-03-28
> This document describes every algorithm, formula, threshold, weight, and pipeline step in the commodity analysis engine — exactly as implemented in production code.

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Architecture & Pipeline](#2-architecture--pipeline)
3. [Supported Commodities](#3-supported-commodities)
4. [Data Fetching Layer](#4-data-fetching-layer)
5. [Technical Indicator Calculations](#5-technical-indicator-calculations)
6. [Price-Volume Analysis](#6-price-volume-analysis)
7. [Seasonality Engine](#7-seasonality-engine)
8. [Macro Context Analysis](#8-macro-context-analysis)
9. [Crash Detection System](#9-crash-detection-system)
10. [Confidence Scoring](#10-confidence-scoring)
11. [Exchange Conversion (COMEX/MCX/SPOT)](#11-exchange-conversion-comexmcxspot)
12. [AI Multi-Horizon Analysis](#12-ai-multi-horizon-analysis)
13. [AI-System Reconciliation](#13-ai-system-reconciliation)
14. [Database & Accuracy Tracking](#14-database--accuracy-tracking)
15. [API Routes](#15-api-routes)
16. [Complete Response Structure](#16-complete-response-structure)
17. [Complete Threshold Reference](#17-complete-threshold-reference)

---

## 1. System Overview

The commodity analysis system is an 8-stage pipeline that produces multi-horizon trading recommendations (today, tomorrow, next week) for 5 commodity futures. It combines:

- **Technical Analysis** — RSI, MACD, Moving Averages, Volume, ATR, Support/Resistance
- **Seasonality Patterns** — 20+ year monthly historical averages for each commodity
- **Macro Context** — USD Index (DXY) correlation, inter-commodity ratios
- **Crash Detection** — 4-signal early warning system (supply shock, demand collapse, currency spike, geopolitical crisis)
- **Exchange Conversion** — Real-time COMEX-to-MCX/SPOT price conversion with duty/premium adjustments
- **AI Enhancement** — Groq (Llama 3.3 70B) + Google Gemini with structured multi-horizon prompts
- **Accuracy Tracking** — MongoDB-backed prediction tracking with win/loss/expired status

**Supported Commodities**: Gold, Silver, Crude Oil, Natural Gas, Copper
**Exchanges**: COMEX (USD), MCX (INR), SPOT (INR)

---

## 2. Architecture & Pipeline

**File**: `apps/api/src/services/commodity/index.ts`

```
analyzeCommodity(symbol, exchange, language) -> CommodityAnalysisResult
```

### 8-Stage Pipeline

```
Stage 1: PARALLEL DATA FETCH
    ├── fetchCommodityData(symbol) -> 90 daily bars + 26 weekly bars + DXY + correlated prices
    ├── fetchEnhancedNews(symbol)  -> news with sentiment
    └── fetchAccuracyStats(symbol) -> historical prediction accuracy from DB

Stage 2: TECHNICAL ANALYSIS
    ├── calcIndicators(dailyHistory)  -> RSI, MACD, MA, Volume, ATR, S/R
    └── calcIndicators(weeklyHistory) -> weekly indicators (if >= 10 bars)

Stage 3: COMMODITY-SPECIFIC ANALYSIS
    ├── analyzeSeasonality(symbol)    -> monthly patterns + modifier
    ├── analyzeMacroContext(commodity, dxy, correlatedPrices) -> USD impact + ratios
    └── analyzePriceVolume(history)   -> price-volume divergence signal

Stage 4: CRASH DETECTION
    └── detectMarketCrash(commodity, dxy, allHistories, newsCount)
        ├── Supply Shock detection
        ├── Demand Collapse detection
        ├── Currency Spike detection
        └── Geopolitical/Volatility Crisis detection

Stage 5: CONFIDENCE SCORING
    └── calculateCommodityConfidence(indicators, seasonality, macro, priceVolume, crash, weekly?)

Stage 6: EXCHANGE CONVERSION
    └── buildExchangePricing(commodity, exchange, comexData, technicals)
        └── fetchUSDINR() -> live USD/INR rate (cached 5 min)

Stage 7: AI MULTI-HORIZON ANALYSIS
    ├── buildCommodityPrompt(allData) -> structured prompt
    └── runCommodityAI(prompt) -> tries Groq first, falls back to Gemini
        Models tried in order:
        1. llama-3.3-70b-versatile (Groq)
        2. llama-3.1-8b-instant (Groq fallback)
        3. gemini-2.0-flash (Google fallback)

Stage 8: RESPONSE ASSEMBLY
    ├── Reconcile AI confidence with system confidence
    ├── Convert all price levels to target exchange
    ├── Build fallback plans if AI unavailable
    ├── Save prediction to database (if actionable)
    └── Assemble final CommodityAnalysisResult
```

---

## 3. Supported Commodities

**File**: `apps/api/src/services/commodity/data.ts`

| Symbol | Yahoo Ticker | Name | Category | Correlated With |
|--------|-------------|------|----------|----------------|
| GOLD | GC=F | Gold | precious-metals | SILVER, DXY |
| SILVER | SI=F | Silver | precious-metals | GOLD, DXY |
| CRUDEOIL | CL=F | Crude Oil | energy | NATURALGAS, DXY |
| NATURALGAS | NG=F | Natural Gas | energy | CRUDEOIL |
| COPPER | HG=F | Copper | base-metals | CRUDEOIL |

---

## 4. Data Fetching Layer

**File**: `apps/api/src/services/commodity/data.ts`

### Data Sources (all via Yahoo Finance)

| Data | Ticker | Period | Interval |
|------|--------|--------|----------|
| Commodity daily | e.g. GC=F | 3 months | 1 day |
| Commodity weekly | e.g. GC=F | 6 months | 1 week |
| USD Index (DXY) | DX-Y.NYB | 3 months | 1 day |
| Correlated commodities | varies | 5 days | 1 day |

### Output: CommodityDataBundle

```typescript
{
  commodity: {
    symbol, name, category,
    currentPrice, previousClose,
    change, changePercent,
    dayHigh, dayLow, volume,
    history: OHLCData[],        // ~90 daily bars
    weeklyHistory: OHLCData[]   // ~26 weekly bars
  },
  dxy: {
    currentValue, change, changePercent,
    trend30d: 'strengthening' | 'weakening' | 'stable',
    history: OHLCData[]
  },
  correlatedPrices: Record<string, {
    price: number,
    change: number,
    changePercent: number
  }>
}
```

### DXY Trend Calculation

```
change = ((dxy[latest].close - dxy[20 bars ago].close) / dxy[20 bars ago].close) x 100

IF change > 2%  -> 'strengthening'
IF change < -2% -> 'weakening'
ELSE            -> 'stable'
```

---

## 5. Technical Indicator Calculations

The commodity system reuses the same indicator functions as the stock system:

- **RSI** (14-period) — see Stock Analysis System, Section 4.2
- **MACD** (12, 26, 9) — see Stock Analysis System, Section 4.3
- **Moving Averages** (SMA20, SMA50, SMA200, EMA9, EMA21) — see Stock Analysis System, Section 4.1
- **Volume Analysis** — see Stock Analysis System, Section 4.4
- **ATR** (14-period) — see Stock Analysis System, Section 4.5
- **Support/Resistance** — calculated from recent price action

These are calculated for both daily and weekly timeframes (weekly only if >= 10 bars available).

---

## 6. Price-Volume Analysis

**File**: `apps/api/src/services/commodity/indicators.ts`

### Algorithm

Compares the last 3 trading days against the prior 5 days (bars -8 to -3):

```
recentAvgPrice  = mean(last 3 closes)
priorAvgPrice   = mean(bars[-8] to bars[-3] closes)
recentAvgVolume = mean(last 3 volumes)
priorAvgVolume  = mean(bars[-8] to bars[-3] volumes)

priceRising   = recentAvgPrice > priorAvgPrice
priceFalling  = recentAvgPrice < priorAvgPrice
volumeRising  = (recentAvgVolume / priorAvgVolume) > 1.1
volumeFalling = (recentAvgVolume / priorAvgVolume) < 0.9
```

### Signal Classification

| Price | Volume | Signal | Modifier | Description |
|-------|--------|--------|----------|-------------|
| Rising | Rising | STRONG_BULLISH | +10 | Price up on increasing volume — strong conviction |
| Rising | Falling | WEAK_BULLISH | +3 | Price up but volume fading — weak move |
| Falling | Rising | STRONG_BEARISH | -10 | Price down on increasing volume — strong selling |
| Falling | Falling | WEAK_BEARISH | -3 | Price down but volume fading — weak selling |
| Other | Other | NEUTRAL | 0 | No clear signal |

---

## 7. Seasonality Engine

**File**: `apps/api/src/services/commodity/seasonality.ts`

Based on 20+ years of historical monthly performance data for each commodity.

### Output: SeasonalityResult

```typescript
{
  currentMonth: {
    month: number,              // 1-12
    monthName: string,
    bias: 'BULLISH' | 'BEARISH' | 'NEUTRAL',
    strength: number,           // 0-100
    winRate: number,            // Historical win rate %
    explanation: string
  },
  nextMonth: SeasonalPattern,   // Same structure
  quarterOutlook: 'BULLISH' | 'BEARISH' | 'NEUTRAL',
  confidence: number,           // = currentMonth.winRate
  modifier: number              // -15 to +15
}
```

### Modifier Formula

```
IF bias === 'BULLISH':  modifier = round((strength / 100) x 15)
IF bias === 'BEARISH':  modifier = -round((strength / 100) x 15)
IF bias === 'NEUTRAL':  modifier = 0
```

### Quarter Outlook

```
Look at current month + next 2 months:
IF 2+ months BULLISH -> quarter = 'BULLISH'
IF 2+ months BEARISH -> quarter = 'BEARISH'
ELSE                 -> quarter = 'NEUTRAL'
```

### Complete Seasonal Patterns

#### GOLD

| Month | Bias | Strength | Win Rate | Rationale |
|-------|------|----------|----------|-----------|
| January | BULLISH | 72% | 65% | New year demand + Indian wedding season |
| February | BULLISH | 68% | 62% | Valentine's + continued wedding demand |
| March | BEARISH | 55% | 48% | Post-season correction, tax selling |
| April | NEUTRAL | 40% | 52% | Low activity period |
| May | NEUTRAL | 45% | 50% | Summer doldrums begin |
| June | NEUTRAL | 42% | 49% | Low volume summer trading |
| July | BULLISH | 60% | 58% | Pre-festival buying begins (India) |
| August | BULLISH | 78% | 70% | Akshaya Tritiya + festival season prep |
| September | BULLISH | 82% | 72% | Dussehra/Diwali buying peak |
| October | BULLISH | 75% | 68% | Continued festival demand + Dhanteras |
| November | NEUTRAL | 48% | 52% | Post-Diwali correction |
| December | BULLISH | 65% | 60% | Year-end safe haven + Christmas demand |

#### SILVER

| Month | Bias | Strength | Win Rate | Rationale |
|-------|------|----------|----------|-----------|
| January | BULLISH | 68% | 62% | Industrial + investment demand |
| February | BULLISH | 65% | 60% | Continued seasonal demand |
| March | BEARISH | 50% | 45% | Q1 correction typical |
| April | NEUTRAL | 42% | 50% | Low activity |
| May | NEUTRAL | 40% | 48% | Summer doldrums |
| June | NEUTRAL | 38% | 47% | Low volume |
| July | BULLISH | 55% | 56% | Industrial restocking begins |
| August | BULLISH | 72% | 65% | Festival + industrial dual demand |
| September | BULLISH | 78% | 68% | Peak seasonal demand |
| October | BULLISH | 70% | 64% | Festival continuation |
| November | NEUTRAL | 45% | 50% | Post-festival normalization |
| December | BULLISH | 58% | 56% | Year-end positioning |

#### CRUDE OIL

| Month | Bias | Strength | Win Rate | Rationale |
|-------|------|----------|----------|-----------|
| January | NEUTRAL | 45% | 50% | Post-holiday demand recovery |
| February | BEARISH | 52% | 45% | Refinery maintenance season |
| March | NEUTRAL | 48% | 50% | Spring transition |
| April | BULLISH | 60% | 58% | Pre-driving season buildup |
| May | BULLISH | 75% | 65% | Driving season demand surge |
| June | BULLISH | 80% | 70% | Peak driving season + hurricane risk |
| July | BULLISH | 78% | 68% | Continued driving + hurricane risk |
| August | BULLISH | 72% | 64% | Late summer demand |
| September | BEARISH | 55% | 45% | Driving season ends + maintenance |
| October | BEARISH | 58% | 42% | Seasonal demand trough |
| November | NEUTRAL | 42% | 50% | OPEC meeting anticipation |
| December | NEUTRAL | 50% | 52% | Year-end positioning + OPEC |

#### NATURAL GAS

| Month | Bias | Strength | Win Rate | Rationale |
|-------|------|----------|----------|-----------|
| January | BULLISH | 82% | 72% | Peak heating season |
| February | BULLISH | 78% | 68% | Continued cold weather demand |
| March | BEARISH | 55% | 42% | Heating season winding down |
| April | BEARISH | 60% | 40% | Injection season begins |
| May | BEARISH | 55% | 42% | Storage injection builds |
| June | NEUTRAL | 45% | 48% | Shoulder season low |
| July | NEUTRAL | 50% | 50% | Summer cooling demand varies |
| August | NEUTRAL | 52% | 52% | Late summer uncertainty |
| September | BULLISH | 58% | 55% | Pre-winter positioning begins |
| October | BULLISH | 72% | 65% | Heating season anticipation |
| November | BULLISH | 80% | 70% | Early heating demand + cold snaps |
| December | BULLISH | 85% | 75% | Peak winter demand |

#### COPPER

| Month | Bias | Strength | Win Rate | Rationale |
|-------|------|----------|----------|-----------|
| January | BULLISH | 65% | 60% | Chinese New Year restocking |
| February | BULLISH | 70% | 62% | Construction season buildup (China) |
| March | BULLISH | 72% | 64% | Peak construction demand (China) |
| April | BULLISH | 68% | 60% | Continued industrial demand |
| May | NEUTRAL | 48% | 50% | Spring plateau |
| June | BEARISH | 55% | 45% | Summer slowdown begins |
| July | BEARISH | 50% | 45% | Low industrial activity |
| August | NEUTRAL | 42% | 48% | Late summer doldrums |
| September | BULLISH | 58% | 55% | Q4 industrial restocking |
| October | NEUTRAL | 45% | 50% | Mixed signals |
| November | BEARISH | 48% | 45% | Year-end slowdown |
| December | NEUTRAL | 42% | 50% | Year-end positioning |

---

## 8. Macro Context Analysis

**File**: `apps/api/src/services/commodity/macroContext.ts`

### 8.1 USD Correlation

#### Long-Term Correlation Strengths

| Commodity | Correlation | Direction |
|-----------|------------|-----------|
| Gold | -0.85 | Strong inverse |
| Silver | -0.80 | Strong inverse |
| Crude Oil | -0.55 | Moderate inverse |
| Natural Gas | -0.20 | Weak |
| Copper | -0.45 | Moderate inverse |

#### Correlation Confirmation Check

```
corrDirection = (correlation < 0) ? 'INVERSE' : 'POSITIVE'

IF INVERSE correlation:
    isConfirming = (USD up AND commodity down) OR (USD down AND commodity up)

IF POSITIVE correlation:
    isConfirming = (USD up AND commodity up) OR (USD down AND commodity down)
```

#### DXY Acceleration Detection

```
dxyADX = calcADX(dxy.history)
isDxyAcceleratingUp = dxyADX.adx > 25 AND dxyADX.plusDI > dxyADX.minusDI
isFighting = !isConfirming AND |dxy.changePercent| > 0.3%
```

#### Impact & Modifier Determination

| Condition | Impact | Modifier |
|-----------|--------|---------|
| corrStrength < 0.3 | "USD has minimal impact" | 0 |
| Inverse + DXY accelerating up + commodity up | "CRITICAL WARNING: DXY accelerating uptrend" | -15 |
| Confirming + DXY weakening | "USD weakening supports upside" | +round(corrStrength x 10) |
| Confirming + DXY strengthening | "USD strengthening pressures lower" | -round(corrStrength x 10) |
| Confirming + DXY stable | "USD stable — neutral" | 0 |
| Fighting correlation | "WARNING: Moving against USD correlation" | -5 |
| Other | "Mixed USD signals" | 0 |

### 8.2 Inter-Commodity Ratios

#### Gold/Silver Ratio

```
ratio = goldPrice / silverPrice
```

**For GOLD analysis:**
| Ratio | Signal | Interpretation |
|-------|--------|---------------|
| > 85 | BEARISH | Silver extremely undervalued relative to gold |
| > 80 | BEARISH | Silver undervalued |
| > 70 | NEUTRAL | Normal range |
| <= 70 | BULLISH | Silver overvalued (gold cheaper) |

**For SILVER analysis:**
| Ratio | Signal | Interpretation |
|-------|--------|---------------|
| > 85 | BULLISH | Silver extremely cheap — strong buy signal |
| > 80 | BULLISH | Silver undervalued — bullish |
| > 70 | NEUTRAL | Normal range |
| <= 70 | BEARISH | Silver overvalued |

#### Oil/Gas Ratio

```
ratio = oilPrice / gasPrice
```

**For NATURAL GAS analysis:**
| Ratio | Signal | Interpretation |
|-------|--------|---------------|
| > 30 | BULLISH | Gas cheap vs oil — bullish mean-reversion |
| > 15 | NEUTRAL | Normal range |
| < 15 | BEARISH | Gas expensive relative to oil |

#### Copper/Oil Ratio

**For COPPER analysis:**
| Oil Change % | Signal | Interpretation |
|-------------|--------|---------------|
| > +1% | BULLISH | Rising oil = economic expansion = copper demand |
| < -1% | BEARISH | Falling oil = potential slowdown = copper risk |
| -1% to +1% | NEUTRAL | Stable energy markets |

### 8.3 Overall Macro Bias

```
ratioBullish = count(ratios with signal === 'BULLISH')
ratioBearish = count(ratios with signal === 'BEARISH')
ratioBias = ratioBullish - ratioBearish

usdBias = (usdModifier > 0) ? +1 : (usdModifier < 0) ? -1 : 0

totalBias = usdBias + ratioBias

IF totalBias >= 1  -> overallBias = 'BULLISH'
IF totalBias <= -1 -> overallBias = 'BEARISH'
ELSE               -> overallBias = 'NEUTRAL'

totalModifier = clamp(usdModifier + (ratioBias x 3), -15, +15)
```

---

## 9. Crash Detection System

**File**: `apps/api/src/services/commodity/crashDetection.ts`

A 4-signal early warning system that monitors for macro-level crash risks across all commodities.

### 9.1 Signal 1: Supply Shock (Weight: 30)

```
oilChange30d  = priceChange(CRUDEOIL, 30 days)
gasChange30d  = priceChange(NATURALGAS, 30 days)

oilShock = oilChange30d > 20%
gasShock = gasChange30d > 30%

triggered = oilShock OR gasShock

Severity:
    oilShock AND gasShock -> CRITICAL
    oilShock OR gasShock  -> WARNING
    neither               -> WATCH
```

### 9.2 Signal 2: Demand Collapse (Weight: 40)

```
copperChange30d = priceChange(COPPER, 30 days)
oilChange30d    = priceChange(CRUDEOIL, 30 days)

copperCollapse = copperChange30d < -10%
doubleConfirm  = copperCollapse AND oilChange30d < -5%

triggered = copperCollapse

Severity:
    doubleConfirm  -> CRITICAL ("Dr. Copper + Oil = recession warning")
    copperCollapse  -> WARNING
    neither         -> WATCH
```

### 9.3 Signal 3: Currency (USD) Spike (Weight: 20)

```
dxyChange30d = priceChange(DXY, 30 days)

triggered = dxyChange30d > 8%

Severity:
    dxyChange30d > 12% -> CRITICAL
    dxyChange30d > 8%  -> WARNING
    otherwise          -> WATCH
```

### 9.4 Signal 4: Geopolitical/Volatility Crisis (Weight: 15)

```
recentHistory = commodity.history.slice(-30)
maxDrawdown = calcMaxDrawdown(recentHistory)

volatileCount = count of ALL commodities with maxDrawdown(30d) > 10%

triggered = (maxDrawdown > 15% AND volatileCount >= 2) OR newsEventCount >= 3

Severity:
    triggered AND volatileCount >= 3 -> CRITICAL
    triggered                        -> WARNING
    neither                          -> WATCH
```

### 9.5 Max Drawdown Calculation

```
peak = first price
maxDD = 0

FOR each bar:
    IF bar.close > peak: peak = bar.close
    drawdown = (peak - bar.close) / peak x 100
    IF drawdown > maxDD: maxDD = drawdown

RETURN maxDD
```

### 9.6 Overall Risk Assessment

```
probability = sum of weights for all TRIGGERED signals
              Possible max: 30 + 40 + 20 + 15 = 105, capped at 100
```

| Probability | Overall Risk | Action |
|-------------|-------------|--------|
| >= 60% | EXTREME | Reduce all commodity exposure immediately |
| >= 40% | HIGH | Tighten stops to 50% normal, reduce positions 50% |
| >= 25% | ELEVATED | Monitor supply/demand closely, use tighter stops |
| >= 10% | MODERATE | Normal risk environment |
| < 10% | LOW | Standard positioning OK |

### 9.7 Recommendations by Risk Level

**EXTREME:**
- Reduce all commodity exposure immediately
- Consider hedging with options or inverse positions
- Move to cash or safe havens (Gold if not already)

**HIGH:**
- Tighten stop-losses to 50% of normal
- Reduce position sizes by 50%
- Monitor DXY and oil closely

**ELEVATED:**
- Monitor supply/demand signals closely
- Use tighter stops than normal

**MODERATE/LOW:**
- Normal risk environment — standard positioning OK

---

## 10. Confidence Scoring

**File**: `apps/api/src/services/commodity/indicators.ts`

### 10.1 Five-Component Scoring System

| Component | Weight | Range | Description |
|-----------|--------|-------|-------------|
| Technical | 35% | 0-100 | RSI + MACD + MA + Weekly confirmation |
| Seasonality | 8% | 0-100 | Monthly win rate |
| Macro | 25% | 0-100 | USD correlation + ratios |
| Price-Volume | 17% | 0-100 | Price-volume divergence signal |
| Crash Risk | 15% | 0-100 | Inverse of crash probability |

### 10.2 Technical Score Calculation

Starting from base = 50:

#### RSI Adjustments

| RSI Range | Trend Context | Adjustment |
|-----------|--------------|------------|
| >= 70 | Any | -12 ("RSI overbought") |
| 55-69 | Any | +15 ("RSI bullish momentum") |
| 40-54 | Any | +5 ("RSI neutral") |
| 30-39 | Bearish | -5 ("Oversold in downtrend") |
| 30-39 | Not bearish | +12 ("Oversold opportunity") |
| < 30 | Bearish | -15 ("Extreme oversold in downtrend") |
| < 30 | Not bearish | -5 ("Extreme oversold") |

#### MACD Adjustments

```
Bullish: +18
Bearish: -15
```

#### MA Adjustments

```
Bullish: +15
Bearish: -15
```

#### Weekly Confirmation

```
IF weekly MA trend matches daily MA trend: +12
IF weekly MA trend contradicts daily:      -8
```

Technical score clamped to [0, 100].

### 10.3 Other Component Scores

**Seasonality Score:**
```
seasonScore = currentMonth.winRate  (direct use of historical win rate)
```

**Macro Score:**
```
macroScore = clamp(50 + macro.modifier x 3, 0, 100)
// macro.modifier ranges -15 to +15, so macroScore ranges 5 to 95
```

**Price-Volume Score:**
```
pvScore = 50 + priceVolume.modifier x 5
// modifier ranges -10 to +10, so pvScore ranges 0 to 100
```

**Crash Risk Score (Inverse):**
```
crashScore = max(0, 100 - crash.probability x 2)
```

### 10.4 Weighted Score Calculation

```
weightedScore = round(
    techScore     x 0.35 +
    seasonScore   x 0.08 +
    macroScore    x 0.25 +
    pvScore       x 0.17 +
    crashScore    x 0.15
)
```

### 10.5 Signal Alignment Boost

Each signal is weighted by importance:

```
bullishWeight =
    (ma.trend === 'bullish'           ? 2 : 0) +
    (macd.trend === 'bullish'         ? 2 : 0) +
    (rsi > 40 AND rsi < 70           ? 1 : 0) +
    (seasonality.bias === 'BULLISH'   ? 1 : 0) +
    (macro.bias === 'BULLISH'         ? 1 : 0) +
    (priceVolume === 'STRONG_BULLISH' ? 1 : 0)

bearishWeight = [mirror pattern for bearish]

dominantWeight = max(bullishWeight, bearishWeight)
totalPossible = 8
alignmentRatio = dominantWeight / totalPossible
```

#### Alignment Amplification

| Alignment Ratio | Amplification | Effect |
|----------------|---------------|--------|
| >= 0.75 (6+ of 8) | +15 pts | Push toward extremes |
| >= 0.50 (4+ of 8) | +10 pts | Moderate boost |
| <= 0.25 (2- of 8) | x0.85 + 0.15x50 | Regress toward neutral |

### 10.6 Direction & Recommendation

```
direction:
    IF bullishWeight > bearishWeight -> 'BULLISH'
    IF bearishWeight > bullishWeight -> 'BEARISH'
    ELSE -> 'NEUTRAL'

recommendation:
    IF score >= 65 AND isBullish -> 'BUY'
    IF score >= 65 AND isBearish -> 'SELL'
    IF score < 40               -> 'WAIT'
    ELSE                        -> 'HOLD'
```

### 10.7 Signal Strength Stars

| Alignment Ratio | Stars | Label |
|----------------|-------|-------|
| >= 0.75 | 5 | "Strong Setup — High Probability" |
| >= 0.625 | 4 | "Good Setup" |
| >= 0.50 | 3 | "Moderate — Be Cautious" |
| >= 0.375 | 2 | "Weak — Risky Trade" |
| < 0.375 | 1 | "Conflicting — Don't Trade" |

### 10.8 Tradeability Gates

| Condition | canTrade | Reason |
|-----------|---------|--------|
| Stars <= 2 | false | Alignment only X/8 |
| Crash probability > 60% | false | Crash probability too high |
| RSI > 85 or RSI < 15 | false | RSI at extreme |
| All else | true | Conditions favorable |

If `canTrade === false`, recommendation is forced to `'WAIT'`.

### 10.9 Final Score

```
finalScore = clamp(weightedScore, 15, 95)
```

---

## 11. Exchange Conversion (COMEX/MCX/SPOT)

**File**: `apps/api/src/services/commodity/exchange.ts`

### 11.1 USD/INR Rate

```
Fetched from Yahoo Finance (USDINR=X)
Cached for 5 minutes
Fallback value: 86.5 (if API fails)
```

### 11.2 MCX Conversion Configs

| Commodity | Unit | Conversion Factor | Duty Multiplier | Spot Discount |
|-----------|------|-------------------|-----------------|---------------|
| Gold | INR/10g | 10 / 31.1035 (troy oz to 10g) | 1.035 (~3.5% duty) | -0.3% |
| Silver | INR/kg | 1000 / 31.1035 (troy oz to kg) | 1.034 | -0.5% |
| Crude Oil | INR/bbl | 1 | 1.05 (~5% duty) | +1.0% |
| Natural Gas | INR/MMBtu | 1 | 1.05 | +1.5% |
| Copper | INR/kg | 2.20462 (lb to kg) | 1.06 (~6% duty) | +0.5% |

### 11.3 Conversion Formulas

**COMEX to MCX:**
```
MCX_Price = COMEX_Price x ConversionFactor x USD_INR x DutyMultiplier
```

**MCX to SPOT:**
```
SPOT_Price = MCX_Price x (1 - SpotDiscountPercent / 100)
```

### 11.4 Examples

```
Gold (COMEX $2,000/oz):
    MCX = $2,000 x (10/31.1035) x 86.5 x 1.035 = ~INR 57,562/10g

Silver (COMEX $25/oz):
    MCX = $25 x (1000/31.1035) x 86.5 x 1.034 = ~INR 71,934/kg

Crude Oil (COMEX $75/bbl):
    MCX = $75 x 1 x 86.5 x 1.05 = ~INR 6,812/bbl

Natural Gas (COMEX $3.50/MMBtu):
    MCX = $3.50 x 1 x 86.5 x 1.05 = ~INR 317.89/MMBtu

Copper (COMEX $4.00/lb):
    MCX = $4.00 x 2.20462 x 86.5 x 1.06 = ~INR 808.31/kg
```

### 11.5 Price Level Conversion

All price levels (entry, stop loss, targets, plan B recovery targets) are converted:

```
convertPlanPrices(plan, commodity, exchange):
    Deep clone the plan
    For each price field in today/tomorrow/nextWeek:
        price = convertPrice(price, commodity, exchange, usdInr)
    Return converted plan
```

---

## 12. AI Multi-Horizon Analysis

**File**: `apps/api/src/services/commodity/prompt.ts`

### 12.1 AI Configuration

| Parameter | Value |
|-----------|-------|
| Temperature | 0.25 |
| Max Tokens | 4500 |
| System Prompt | "You are an expert commodity futures analyst. Respond ONLY with valid JSON. No markdown." |

### 12.2 Prompt Structure

The AI receives a comprehensive prompt with 10 data sections:

```
Section 1:  Current market data (price, change, range, volume)
Section 2:  USD Index (DXY value, trend, impact on commodity)
Section 3:  Daily technical indicators (RSI, MACD, MA, S/R, ATR, volume)
Section 4:  Weekly indicators (if available)
Section 5:  Price-volume analysis signal
Section 6:  Seasonality (current month, next month, quarter outlook)
Section 7:  Macro context (USD correlation, inter-commodity ratios)
Section 8:  Crash detection (risk level, triggered signals)
Section 9:  System confidence (score, direction, component breakdown)
Section 10: Recent news (top 5 headlines)
```

### 12.3 Critical Rules for AI

1. **Today** = current conditions, actionable NOW
2. **Tomorrow** = conditional triggers ("if X breaks above Y, then...")
3. **Next Week** = scenario + probability, not a definitive call
4. Price levels must be realistic (within ATR range)
5. Confidence range: 20-95 only
6. AI confidence must be within +/-15 of system confidence
7. Stop loss < Target (risk:reward > 1.5)
8. Every horizon MUST include Plan B
9. Plan B must escalate: HOLD -> AVERAGE -> EXIT
10. Reference ATR for realistic thresholds

### 12.4 Required JSON Output Structure

```json
{
  "overallBias": "BULLISH | BEARISH | NEUTRAL",
  "confidenceScore": 20-95,
  "summary": "1-2 sentence summary",

  "today": {
    "action": "BUY | SELL | HOLD | WAIT",
    "reasoning": "2-3 sentences",
    "confidence": 20-95,
    "urgency": "ACT_NOW | MONITOR | WAIT",
    "entry": [low, high],
    "stopLoss": number,
    "target": number,
    "risks": ["risk1", "risk2"],
    "validity": "time window",
    "planB": {
      "scenario": "what if price moves against",
      "action": "HOLD | AVERAGE_DOWN | EXIT | HEDGE",
      "reasoning": "why this response",
      "recoveryTarget": price,
      "maxLoss": "e.g. 2-3% of position",
      "timeline": "recovery window",
      "steps": [
        "Step 1: if drops 1-2%",
        "Step 2: if drops 3-5%",
        "Step 3: if drops 5%+"
      ]
    }
  },

  "tomorrow": {
    "action": "conditional action",
    "confidence": 20-95,
    "conditions": [
      {
        "trigger": "exact condition",
        "action": "action",
        "entry": [low, high],
        "stopLoss": number,
        "target": number
      }
    ],
    "watchLevels": [level1, level2, level3],
    "newsToWatch": ["event1", "event2"],
    "planB": { ... }
  },

  "nextWeek": {
    "scenario": "BULLISH | BEARISH | RANGE_BOUND",
    "probability": 50-90,
    "reasoning": "2-3 sentences",
    "targetRange": [low, high],
    "strategy": "swing trade approach",
    "keyEvents": [
      { "date": "date", "event": "name", "impact": "HIGH|MEDIUM|LOW" }
    ],
    "planB": { ... }
  },

  "newsSentiment": "positive | negative | neutral"
}
```

### 12.5 User-Friendly Prompt

**Function**: `buildUserFriendlyCommodityPrompt()`

Same data as the AI prompt but formatted for human reading (copy/paste to ChatGPT/Claude):
- Emoji-enhanced section headers
- Bullet points instead of JSON
- Asks for: verdict, trade plan (3 horizons), reasoning, risks, plan B
- Short and actionable format
- Hindi language support if requested

### 12.6 Fallback Plans (When AI Unavailable)

If all AI models fail, the system generates deterministic fallback plans:

**Today:**
```
ATR = indicators.atr || price x 0.015
Entry range: price +/- ATR x 0.3
Stop loss: price +/- ATR x 1.2 (opposite direction)
Target: price +/- ATR x 2.0

Urgency:
    confidence >= 75 -> ACT_NOW
    confidence >= 55 -> MONITOR
    else             -> WAIT
```

**Tomorrow:**
```
Trigger level: price +/- ATR x 0.3
Entry range: price +/- ATR x 0.2
Stop loss: price +/- ATR x 1.2
Target: price +/- ATR x 2.5
Confidence: systemConfidence - 10
```

**Next Week:**
```
Probability: max(50, confidence.score - 5)
Target range: [price - ATR x 3, price + ATR x 3]
Strategy: based on recommendation (buy dips / sell rallies / range trade)
```

---

## 13. AI-System Reconciliation

After AI returns its analysis, the system reconciles confidence scores:

```
IF AI and system agree on direction:
    finalConfidence = max(aiScore, sysScore) x 0.7 + min(aiScore, sysScore) x 0.3
    (Boost: both agree -> use weighted max)

ELSE IF AI and system disagree (neither NEUTRAL):
    finalConfidence = min(aiScore, sysScore) x 0.6
    (Heavy penalty: disagreement -> use weighted min)

ELSE IF one is NEUTRAL:
    finalConfidence = (aiScore + sysScore) / 2 x 0.85
    (Moderate: average with slight penalty)

ELSE (AI unavailable):
    finalConfidence = system.score

Final = clamp(finalConfidence, 15, 95)
```

---

## 14. Database & Accuracy Tracking

### 14.1 Prediction Saving

A prediction is saved to MongoDB if:
- recommendation is NOT 'HOLD' or 'WAIT'
- tradeability.canTrade is true

**Saved fields:**
```
symbol, exchange, direction, recommendation, confidence,
signalStars, entryPrice, targetPrice, stopLoss,
status: 'PENDING'
```

### 14.2 Prediction Status Updates

On each new analysis, all PENDING predictions for the symbol are checked:

| Condition | New Status | PnL Calculation |
|-----------|-----------|----------------|
| Price hit target | TARGET_HIT | (target - entry) / entry x 100 |
| Price hit stop loss | STOP_HIT | (stopLoss - entry) / entry x 100 |
| Older than 7 trading days (~10 calendar days) | EXPIRED | (currentPrice - entry) / entry x 100 |

### 14.3 Accuracy Statistics

```
db.aggregate([
  { $match: { symbol, status: { $ne: 'PENDING' } } },
  { $group: {
      _id: null,
      total: { $sum: 1 },
      wins: { $sum: { $cond: [{ $eq: ['$status', 'TARGET_HIT'] }, 1, 0] } },
      avgPnl: { $avg: '$pnlPercent' }
  }}
])
```

Exposed via `GET /commodity/accuracy` endpoint.

---

## 15. API Routes

**File**: `apps/api/src/routes/commodity.ts`

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/commodity/supported` | List all 5 supported commodities with exchanges |
| GET | `/commodity/exchanges/:symbol` | Get exchanges for a specific commodity |
| GET | `/commodity/accuracy` | Get backtesting accuracy statistics |
| POST | `/commodity` | Run full commodity analysis |

### POST /commodity Request Body

```json
{
  "symbol": "GOLD",           // Required: GOLD, SILVER, CRUDEOIL, NATURALGAS, COPPER
  "exchange": "MCX",          // Optional: COMEX (default), MCX, SPOT
  "language": "en"            // Optional: en (default), hi (Hindi)
}
```

---

## 16. Complete Response Structure

```typescript
interface CommodityAnalysisResult {
  // Basic Info
  commodity: string;                    // Symbol
  name: string;                         // Display name
  category: string;                     // precious-metals, energy, base-metals
  currentPrice: number;                 // In exchange currency
  change: number;                       // Price change
  changePercent: number;                // % change

  // Scoring
  confidence: number;                   // 15-95 (final reconciled)
  direction: string;                    // BULLISH | BEARISH | NEUTRAL
  recommendation: string;               // BUY | SELL | HOLD | WAIT
  summary: string;                      // 1-2 sentence AI summary

  // Signal Quality
  signalStrength: {
    stars: 1-5;
    aligned: number;                    // Signals agreeing (0-8)
    total: 8;
    label: string;
  };

  // Trade Gate
  tradeability: {
    canTrade: boolean;
    reason: string;
    suggestion: string;
  };

  // Track Record
  accuracy: {
    total: number;
    winRate: number;
    pnl: number;                        // Avg P&L %
  };

  // Macro
  macroContext: {
    usd: { value, change, trend30d, impact };
    ratios: [{ name, ratio, interpretation, signal }];
    overallBias: string;
  };

  // Commodity-Specific
  commodityIndicators: {
    seasonality: {
      currentMonth, bias, winRate, explanation,
      nextMonth, nextMonthBias, quarterOutlook
    };
    priceVolume: { signal, description };
    confidenceBreakdown: {
      technical, seasonality, macro, priceVolume, crashRisk
    };
    factors: string[];                  // Top 12 contributing factors
  };

  // AI Multi-Horizon Plans
  multiHorizonPlan: {
    today: { action, reasoning, confidence, urgency, entry, stopLoss, target, risks, validity, planB };
    tomorrow: { action, confidence, conditions, watchLevels, newsToWatch, planB };
    nextWeek: { scenario, probability, reasoning, targetRange, strategy, keyEvents, planB };
  };

  // Crash Risk
  crashDetection: {
    overallRisk: string;                // EXTREME | HIGH | ELEVATED | MODERATE | LOW
    probability: number;                // 0-100
    signals: [{ name, triggered, severity, description }];
    recommendations: string[];
  };

  // Technical Indicators
  technicals: {
    rsi, rsiInterpretation, macdTrend, maTrend,
    support, resistance, atr, volumeTrend
  };

  // Other
  newsSentiment: string;
  rawPrompt: string;                    // Copy-paste prompt for users
  exchangePricing: ExchangePricing;     // Full exchange-converted pricing

  // Metadata
  metadata: {
    analysisTime: number;               // Pipeline duration (ms)
    dataPoints: number;                 // Bars analyzed
    aiModel: string;                    // Which AI model responded
    timestamp: string;                  // ISO timestamp
    exchange: string;                   // COMEX | MCX | SPOT
  };
}
```

---

## 17. Complete Threshold Reference

### Confidence Scoring

| Threshold | Value | Effect |
|-----------|-------|--------|
| BUY threshold | Score >= 65 + bullish | Recommend BUY |
| SELL threshold | Score >= 65 + bearish | Recommend SELL |
| WAIT threshold | Score < 40 | Recommend WAIT |
| HOLD threshold | 40-64 | Recommend HOLD |
| Score minimum | 15 | Hard floor |
| Score maximum | 95 | Hard ceiling |

### Signal Alignment

| Ratio | Stars | Amplification |
|-------|-------|--------------|
| >= 0.75 | 5 | +15 pts |
| >= 0.625 | 4 | +10 pts |
| >= 0.50 | 3 | +10 pts |
| >= 0.375 | 2 | No boost |
| < 0.375 | 1 | Regress toward 50 |

### Tradeability Gates

| Gate | Threshold | Result |
|------|-----------|--------|
| Low alignment | Stars <= 2 | canTrade = false |
| High crash risk | Probability > 60% | canTrade = false |
| Extreme RSI | RSI > 85 or RSI < 15 | canTrade = false |

### Crash Detection

| Signal | Trigger | Weight |
|--------|---------|--------|
| Supply Shock | Oil +20% or Gas +30% (30d) | 30 |
| Demand Collapse | Copper -10% (30d) | 40 |
| Currency Spike | DXY +8% (30d) | 20 |
| Volatility Crisis | Drawdown > 15% + 2+ volatile commodities | 15 |

### Macro Context

| Parameter | Value |
|-----------|-------|
| DXY trend threshold | +/- 2% over 20 days |
| Gold/Silver ratio normal | 70-80 |
| USD/INR cache TTL | 5 minutes |
| USD/INR fallback | 86.5 |

### Exchange Conversion

| Commodity | COMEX Unit | MCX Unit | Duty |
|-----------|-----------|----------|------|
| Gold | $/troy oz | INR/10g | 3.5% |
| Silver | $/troy oz | INR/kg | 3.4% |
| Crude Oil | $/barrel | INR/barrel | 5% |
| Natural Gas | $/MMBtu | INR/MMBtu | 5% |
| Copper | $/lb | INR/kg | 6% |

### AI Parameters

| Parameter | Value |
|-----------|-------|
| Temperature | 0.25 |
| Max tokens | 4500 |
| Primary model | llama-3.3-70b-versatile (Groq) |
| Fallback 1 | llama-3.1-8b-instant (Groq) |
| Fallback 2 | gemini-2.0-flash (Google) |
| Confidence drift tolerance | +/- 15 from system |

### Trade Level Sizing (Fallback)

| Level | Distance from Price |
|-------|-------------------|
| Entry width | +/- 0.3 x ATR |
| Stop loss | +/- 1.2 x ATR |
| Target (today) | +/- 2.0 x ATR |
| Target (tomorrow) | +/- 2.5 x ATR |
| Target range (week) | +/- 3.0 x ATR |

---

## File Reference

| File | Purpose |
|------|---------|
| `apps/api/src/services/commodity/index.ts` | Main 8-stage pipeline orchestrator |
| `apps/api/src/services/commodity/data.ts` | Yahoo Finance data fetching for commodities + DXY |
| `apps/api/src/services/commodity/indicators.ts` | Price-volume analysis + confidence scoring |
| `apps/api/src/services/commodity/seasonality.ts` | 12-month patterns for 5 commodities |
| `apps/api/src/services/commodity/macroContext.ts` | USD correlation + inter-commodity ratios |
| `apps/api/src/services/commodity/crashDetection.ts` | 4-signal crash early warning system |
| `apps/api/src/services/commodity/prompt.ts` | AI prompt building (2 formats) |
| `apps/api/src/services/commodity/exchange.ts` | COMEX/MCX/SPOT price conversion |
| `apps/api/src/routes/commodity.ts` | API endpoints |
