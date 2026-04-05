# STOCK-ASSIST: FINAL MASTER PLAN
## All Research Consolidated → One Clear Action List

> Combines: Initial Audit + 6 Perplexity Reports
> Date: 2026-04-01

---

## YOUR NEW DESIGN TARGET

Old goal: 70%+ win rate
**New goal: 55-60% win rate × 2.5:1 R:R = Profit Factor 3.4**

This is mathematically the sweet spot (Report 6):
```
Profile (b): 57.5% win × 2.5R
  Expectancy per trade = 0.575 × 2.5 - 0.425 × 1 = 1.01R
  Profit Factor = 3.4
  
  100 trades → 57 wins × ₹1250 avg = ₹71,250
                43 losses × ₹500 avg = ₹21,500
  Net: +₹49,750
```

Portfolio: 2-3 concurrent positions, 1-1.5% risk per trade (₹150-225 on ₹15k).

---

## PHASE 1: WEEKEND SPRINT (10-12 hours)
### Changes with strongest evidence. Do these first.

### 1.1 Sector-Specific MACD Parameters ⭐ HIGHEST IMPACT
**Evidence:** Peer-reviewed. +615% vs standard MACD on NIFTY 50.
**File:** `apps/api/src/services/indicators/volume.ts`

```typescript
const SECTOR_MACD_PARAMS: Record<string, [number, number, number]> = {
  'IT':              [9, 8, 9],
  'Automobiles':     [9, 10, 8],
  'Pharmaceuticals': [11, 9, 12],
  'Financials':      [12, 8, 16],
  'Metals':          [11, 10, 14],
  'Energy':          [10, 5, 12],
  'FMCG':            [10, 7, 8],
  'default':         [10, 8, 11]   // NIFTY 50 average
};
```
Pass `sector` from stock universe → indicator calculation.

---

### 1.2 RSI Period: 14 → Sector-Specific (9-12) ⭐ HIGH IMPACT
**Evidence:** Peer-reviewed. +470% vs standard RSI on NIFTY 50.
**File:** `apps/api/src/services/indicators/rsi.ts`

```typescript
const SECTOR_RSI_PERIODS: Record<string, number> = {
  'IT': 9, 'Automobiles': 9, 'Energy': 9,
  'Metals': 7, 'Pharmaceuticals': 11,
  'Financials': 12, 'FMCG': 11, 'default': 10
};
```

---

### 1.3 Recalibrate Pattern Weights to NSE Data ⭐ HIGH IMPACT
**Evidence:** 16-year study, 17 NIFTY 50 stocks, thousands of occurrences.
**File:** `apps/api/src/services/analysis/candlestick.ts`

Key changes (research-calibrated 5-day ≥2% hit rates):
```
Morning Star:         0.85 → 0.62
Three White Soldiers: 0.85 → 0.60
Bullish Engulfing:    0.80 → 0.58
Bullish Harami:       0.45 → 0.60  ← UPGRADE (59.7% on NSE)
Three Inside Up:      0.65 → 0.61  ← UPGRADE (60.8% on NSE)
Hammer:               0.75 → 0.57
Marubozu:             0.80 → 0.62
Spinning Top:         0.25 → 0.00  ← REMOVE from scoring
Plain Doji:           0.30 → 0.00  ← REMOVE from scoring
```

---

### 1.4 Fix Stop Loss Contradiction ⭐ HIGH IMPACT
**Check which actually runs:** `entryZone.ts` uses 0.5×ATR, risk management docs say 1.5×ATR.
**Evidence:** ATR backtests (9,433 trades) show 2×ATR stop is the "sweet spot."

**Change:** Standardize to 1.0-1.5×ATR minimum.
```typescript
// entryZone.ts
// BEFORE: stopLoss = entryAnchor - 0.5 * atr
// AFTER:
const stopLoss = direction === 'BULLISH'
  ? Math.min(entryAnchor - 1.2 * atr, nearestSupport - 0.2 * atr)
  : Math.max(entryAnchor + 1.2 * atr, nearestResistance + 0.2 * atr);
```

---

### 1.5 Weekly Trend Hard Filter
**Evidence:** Multi-study support — weekly timeframe dominates swing direction.
**File:** `apps/api/src/services/analysis/confidenceScoring.ts`

```typescript
// Hard rule: Do NOT generate BUY if weekly MA trend is bearish
// Exception: RSI < 30 AND volume > 2x AND CHoCH confirmed
if (weeklyIndicators?.ma.trend === 'bearish' && direction === 'BULLISH') {
  if (!(rsi < 30 && volumeRatio > 2.0)) {
    recommendation = 'HOLD'; // Block the buy signal
  }
}
```

Also increase weekly weight in Direction Model:
```
Weekly bullish/bearish: weight 3 → 5
Monthly: weight 3 → 4
```

---

### 1.6 Remove FVG From Entry/Conviction Scoring
**Evidence:** SharpResearch quant tests: "no measurable predictive edge" for FVGs as entries. 68% fill rate = good targets, bad entries.

**File:** `apps/api/src/services/analysis/signalComposer.ts`
- Remove FVG's 10 conviction points → 0
- Keep FVG in `entryZone.ts` TARGET calculation only

**File:** `apps/api/src/services/analysis/entryZone.ts`
- Remove FVG as entry trigger priority #3
- Keep FVG for target price calculation

---

### 1.7 Tighten SMC Validation
**Evidence:** OB win rates 35-55% (same as S/R). CHoCH: zero quantified data.

**File:** `apps/api/src/services/analysis/smc.ts`
```
OB_IMPULSE_ATR_MULTIPLIER: 1.5 → 2.0  (filter weak OBs)
MAX_OB_AGE: 50 → 20 candles            (no evidence OBs hold 2.5 months)
CHOCH_CONFIRM_ATR_MULTIPLIER: 0.3 → 0.7 (0.3 is noise)
```
Add: CHoCH requires volume > 1.2x average to confirm.

---

### 1.8 Rebalance Conviction Weights
**File:** `apps/api/src/services/analysis/signalComposer.ts`

```
BEFORE:                          AFTER:
MTF Alignment:    0-25           MTF Alignment:    0-35  (research-backed)
CHoCH Daily:      20             CHoCH Daily:      10    (unvalidated)
Unmitigated OB:   15             Strong OB only:   12    (same as S/R)
Liquidity Sweep:  15             Sweep at OB:      15    (best SMC signal)
                                 Sweep alone:       8
Volume Spike:     10             Volume Spike:      12   (research-backed)
FVG Target:       10             FVG Target:        0    (no entry edge)
Candlestick:       5             Candlestick:       8    (55-62% on NSE)
```

---

### 1.9 Reduce Score Inflation
**File:** `apps/api/src/services/analysis/confidenceScoring.ts`

Three layers stacked = inflated scores → too many false BUY/SELL signals.

```
Signal amplification:
  >= 7 signals: 1.25 → 1.15
  >= 5 signals: 1.18 → 1.10
  >= 4 signals: 1.10 → 1.05

Conviction floors:
  All TF + volume:    78 → 68
  Daily + weekly:     72 → 62
  Breakout + volume:  80 → 70
  ADX >= 30 + all TF: 82 → 72

Sigmoid steepness: 1.6 → 1.2  (or remove entirely)
```

---

### 1.10 Raise Quality Gate
**File:** `apps/api/src/services/screening/qualityGates.ts`

```
Minimum Confidence: 55 → 65
Min Risk:Reward:    2.0 (standardize everywhere — was 1.5 in trading.ts)
```

---

## PHASE 2: NEXT WEEK (5-8 hours)
### Exit strategy + regime improvements

### 2.1 Implement Partial Profit Exit
**Evidence:** Best PF compromise for short swings (Reports 5 & 8). ATR trailing on full position REDUCES PF for 1-5 day holds.

**New exit logic:**
```
Primary: 50% position at 1.5R, trail remaining 50%
Trail method: stop = max(current_stop, lowest_low_of_last_2_bars) for longs
Fallback: full exit at 2.5R or day 7 (whichever first)
Hard expiry: 7 days (was 5 — research shows 5-10 day edge)
```

Add RSI exhaustion guardrail (not primary exit):
```
If RSI > 80 within 2-3 days → tighten stop to breakeven
If RSI then closes below 65 → exit remaining position
```

---

### 2.2 Regime-Aware Signal Logic
**Evidence:** ADX + trend filter reduces false signals (Talwar 2019). ADX 25 = standard for NSE (no better threshold found).

**File:** `apps/api/src/services/analysis/regimeClassifier.ts`

```typescript
// Add ADX slope detection
if (adx < 20 && adxSlope > 1.0 && bollingerSqueeze) {
  regime = 'TRANSITION'; // Squeeze breakout incoming
}

// Add Bollinger squeeze detection
const bbWidth = (upper - lower) / middle;
const bbAvg = average(bbWidths.slice(-120)); // 6-month average
const bollingerSqueeze = bbWidth < bbAvg * 0.5; // Below 50% of avg
```

**Regime-aware scoring changes:**
```
RANGE regime (ADX < 20):
  - RSI overbought/oversold = PRIMARY signal (mean-reversion)
  - MACD weight reduced (trends don't work)
  - Pattern weight increased (reversals at S/R)

TRENDING (ADX >= 25):
  - Follow the trend, trust momentum
  - MACD and MA = PRIMARY signals
  
TRANSITION (squeeze):
  - Smaller position, wider stops
  - Wait for breakout direction confirmation
```

---

### 2.3 Add MACD Histogram Momentum
**File:** `apps/api/src/services/indicators/volume.ts`

```typescript
// Detect histogram slope change (early warning)
function macdHistogramMomentum(histValues: number[]): string {
  const r = histValues.slice(-3);
  if (r[0] > 0 && r[2] < r[1]) return 'decelerating'; // EARLY EXIT WARNING
  if (r[0] < 0 && r[2] > r[1]) return 'decelerating';
  return 'stable';
}
// Decelerating against trade direction: -8 confidence points
```

---

### 2.4 Add Volume Trend Detection
**File:** `apps/api/src/services/indicators/volume.ts`

```typescript
function volumeTrend(volumes: number[], period = 5): string {
  const recent = volumes.slice(-period);
  let rises = 0;
  for (let i = 1; i < recent.length; i++) {
    if (recent[i] > recent[i-1] * 1.05) rises++;
    else if (recent[i] < recent[i-1] * 0.95) rises--;
  }
  if (rises >= 2) return 'increasing';
  if (rises <= -2) return 'decreasing';
  return 'flat';
}
// Volume decreasing + matches trade direction: -10 points (fading move!)
```

---

### 2.5 Add RSI Divergence Detection
**File:** `apps/api/src/services/indicators/rsi.ts`

```typescript
// Bearish divergence: price higher high, RSI lower high → -15 points
// Bullish divergence: price lower low, RSI higher low → +12 points
```

---

## PHASE 3: BUILD THE FOUNDATION (4-5 hours)
### Data collection for future optimization

### 3.1 Signal Attribution Log
**New Model:** `apps/api/src/models/signalAttribution.ts`

Log with every signal:
- All sub-scores (technical, pattern, volume, news, fundamental)
- All indicator values (RSI, MACD, MA trend, volume ratio)
- SMC state (hasOB, hasFVG, hasCHoCH, smcConfluenceCount)
- Regime, ADX, pattern name, MTF alignment
- After resolution: outcome, PnL, MFE, MAE, holding days

### 3.2 SMC A/B Comparison Endpoint
**New Route:** `GET /api/backtest/smc-comparison`

Compare win rate of signals WITH vs WITHOUT SMC confluence.
After 200+ resolved signals, this answers: "Does SMC actually help on NSE?"

### 3.3 Component Effectiveness Dashboard
After 300+ signals, run:
- Win rate by confidence bucket (find optimal threshold)
- Win rate by regime (which regime produces best signals?)
- Win rate by pattern (kill patterns below 52%)
- Win rate by SMC presence (keep/remove/increase SMC?)

---

## PHASE 4: LIFE-SAVER FEATURES
### Based on what drives retention in Indian trading platforms

### 4.1 Telegram Alert Bot (HIGHEST RETENTION IMPACT)
Push alerts when:
- High-clarity signal fires (confidence ≥ 70)
- Stop loss approaching on open trade
- Target approaching on open trade  
- Morning top 10 ready

**Why:** Trendlyne's "AlphaAlerts" is their #1 engagement driver. Push > Pull.

### 4.2 Auto Paper Trading
Every signal auto-creates a paper trade. Track portfolio P&L in real-time.
- Proves system works before users risk money
- Gives you accuracy data automatically
- Demo mode for new users

### 4.3 Trade Post-Mortem View
After signal resolves, show:
- Chart with entry/exit marked
- Which indicators were right/wrong
- What the system scored vs what happened
- Learning insight

### 4.4 Risk Dashboard
Show at all times:
- Total open risk (₹ at stake across all positions)
- Sector concentration warning
- Worst-case scenario (all stops hit)
- Weekly P&L curve

---

## SUMMARY: WHAT TO DO AND IN WHAT ORDER

```
WEEKEND (Phase 1):
  □ 1.1  Sector MACD params
  □ 1.2  RSI period 9-12
  □ 1.3  Recalibrate pattern weights
  □ 1.4  Fix SL (0.5→1.2 ATR)
  □ 1.5  Weekly trend filter
  □ 1.6  Remove FVG from entry/conviction
  □ 1.7  Tighten SMC (OB age, impulse, CHoCH)
  □ 1.8  Rebalance conviction weights
  □ 1.9  Reduce score inflation
  □ 1.10 Raise quality gate to 65

NEXT WEEK (Phase 2):
  □ 2.1  Partial profit exit system
  □ 2.2  Regime-aware scoring
  □ 2.3  MACD histogram momentum
  □ 2.4  Volume trend detection
  □ 2.5  RSI divergence

WEEK AFTER (Phase 3):
  □ 3.1  Signal attribution log
  □ 3.2  SMC A/B comparison
  □ 3.3  Component dashboard

THEN (Phase 4):
  □ 4.1  Telegram bot
  □ 4.2  Auto paper trading
  □ 4.3  Trade post-mortem
  □ 4.4  Risk dashboard
```

---

## KEY NUMBERS TO REMEMBER

| Metric | Current | Target | Evidence |
|--------|---------|--------|----------|
| Win Rate | ~55-57% | 58-63% | NSE pattern studies |
| R:R | 2:1 | 2.5:1 | Profit factor math |
| Profit Factor | ~1.5? | >2.5 | Profile (b) optimization |
| Quality Gate | 55 | 65 | Selectivity over quantity |
| RSI Period | 14 | 9-12 | Inumula 2019 |
| MACD | 12,26,9 | Sector-specific | Inumula 2019 |
| SL | 0.5×ATR? | 1.2×ATR | ATR backtest (9,433 trades) |
| Signal Expiry | 5 days | 7 days | 10-day window data |
| Max OB Age | 50 candles | 20 candles | No evidence for longer |
| Concurrent Positions | unlimited? | 2-3 max | ₹15k capital math |
