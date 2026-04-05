# Backtest System: Phase-by-Phase Implementation Plan

> Implements BACKTEST-GUIDE.md (walk-forward engine) + BACKTEST-FINAL.md (condition stack discovery)

---

## Phase 1: Outcome Checker (Foundation)
**Estimated: ~30 min | Zero dependencies on other new files**

### Create: `apps/api/src/services/backtest/outcomeChecker.ts`

Pure function, no imports from new files. Receives entry/target/SL + future OHLC bars, returns outcome.

**What it does:**
- Check 7 future bars for: partial profit (1.5R), full target (2.5R), stop loss, expiry
- Trailing stop after partial fill (lowest-low-2-bars for BUY, highest-high-2-bars for SELL)
- MFE/MAE tracking on every bar
- Blended P&L for partial exits (50% partial + 50% remainder)
- Stop-before-target priority (same bar: check SL first)

**Interfaces:**
```typescript
interface OutcomeCheckInput {
  direction: 'BUY' | 'SELL';
  entryPrice: number;
  targetPrice: number;
  stopLoss: number;
  futureCandles: OHLCData[];
  partialTargetR: number;  // 1.5
  fullTargetR: number;     // 2.5
}

interface OutcomeResult {
  outcome: 'TARGET_HIT' | 'STOP_HIT' | 'PARTIAL_PROFIT' | 'EXPIRED';
  exitPrice: number;
  pnlPercent: number;
  daysToOutcome: number;
  mfe: number;
  mae: number;
  exitReason: string;
}
```

**Reuses:** Only `OHLCData` from `@stock-assist/shared`. Self-contained.

**Test:** Unit test with mock OHLC arrays — verify each outcome type fires correctly.

---

## Phase 2: Historical Analysis Adapter (The Bridge)
**Estimated: ~1 hour | Key file — connects existing pipeline to backtest mode**

### Create: `apps/api/src/services/backtest/historicalBacktester.ts`

The `runAnalysisOnHistoricalData()` function. Runs the existing analysis pipeline on truncated historical data WITHOUT AI calls, news, fundamentals, or DB saves.

**What it does:**
1. Accept raw `dailyData: OHLCData[]` and `weeklyData: OHLCData[]` (already truncated by caller)
2. Call existing pipeline functions in order:
   - `calcIndicators(dailyData, sector)` → RSI, MA, MACD, Volume, ATR, VWAP
   - `calcRSI(weeklyPrices)`, `calcMA(weeklyPrices)` → weekly indicators
   - `performComprehensiveTechnicalAnalysis({ daily, weekly, monthly: [] })`
   - `calcADX(dailyData)` → ADX + trend strength
   - `calcBollingerBands(prices)` → Bollinger + squeeze detection
   - `classifyRegime(...)` → regime classification
   - `buildMACDHistogramArray()`, `macdHistogramMomentum()`, `volumeTrend()`, `detectRSIDivergence()`
   - `calculateSplitConfidence(...)` → direction + strength (news=neutral, fundamentals=null)
   - `calculatePatternConfluence(...)` → pattern confluence
   - `composeSignal(...)` → SMC signal card
   - `calculateEntryZone(...)` → entry/target/SL from SMC
3. Apply confidence modifiers (volume, MTF, ADX, confluence) — same logic as orchestrator
4. Return: recommendation, confidence, entry/target/SL, full conditions snapshot

**Key decisions:**
- **Skip AI entirely** — system-only scoring for speed + reproducibility
- **Skip news** — pass neutral news object `{ sentiment: 'neutral', sentimentScore: 50, impactLevel: 'low', items: [], latestHeadlines: [], dataFreshness: 0 }`
- **Skip fundamentals** — pass unknown fundamentals `{ valuation: 'unknown', growth: 'unknown', metrics: nulls }`
- **Skip sector comparison** — pass neutral `{ verdict: 'inline', confidenceModifier: 0 }`
- **Skip empirical probability, calibration, expectancy** — these are forward-looking features
- **Skip market breadth** — not available for historical dates
- **DO use:** indicators, patterns, SMC, regime, confidence scoring, entry zone, signal composer

**Reuses directly:**
| Function | From |
|----------|------|
| `performComprehensiveTechnicalAnalysis` | `analysis/technicalAnalysis` |
| `calculateSplitConfidence` | `analysis/confidenceScoring` |
| `calculatePatternConfluence` | `analysis/patternConfluence` |
| `detectFundamentalTechnicalConflict` | `analysis/fundamentalTechnical` |
| `composeSignal` | `analysis/signalComposer` |
| `calculateEntryZone` | `analysis/entryZone` |
| `classifyRegime` | `analysis/regimeClassifier` |
| `calcADX` | `indicators/adx` |
| `calcATR`, `buildMACDHistogramArray`, `macdHistogramMomentum`, `volumeTrend` | `indicators/volume` |
| `calcBollingerBands` | `indicators/bollinger` |
| `detectRSIDivergence` | `indicators/rsi` |
| `calcIndicators` | `indicators/index` |

**Returns:**
```typescript
interface BacktestAnalysisResult {
  recommendation: 'BUY' | 'SELL' | 'HOLD' | 'WAIT';
  confidence: number;
  regime: string;
  entryPrice: number;
  targetPrice: number;
  stopLoss: number;
  riskReward: number;
  conditions: BacktestConditions;  // Full snapshot for stack analysis
}

interface BacktestConditions {
  // Regime
  regime: string;
  isStrongTrend: boolean;      // ADX > 25
  isTransition: boolean;       // regime === 'TRANSITION'
  // Trend alignment
  weeklyAligned: boolean;      // Weekly MA trend matches signal direction
  allTimeframesAligned: boolean;
  alignmentScore: number;
  // Volume
  volumeHigh: boolean;         // ratio > 1.5
  volumeConfirmed: boolean;    // ratio > 1.2
  volumeIncreasing: boolean;   // volumeTrend === 'increasing'
  volumeRatio: number;
  // Indicators
  rsiValue: number;
  rsiInZone: boolean;          // RSI 40-60
  macdBullish: boolean;        // MACD trend matches direction
  macdAccelerating: boolean;   // macdHistogramMomentum === 'accelerating'
  emaCrossover: boolean;       // EMA9 > EMA21 (BUY) or EMA9 < EMA21 (SELL)
  maTrend: string;
  macdTrend: string;
  macdMomentum: string;
  volumeTrend: string;
  rsiDivergence: string;
  // Patterns
  hasStrongPattern: boolean;   // Primary pattern weight >= 0.58
  primaryPattern: string | null;
  patternWeight: number;
  // SMC
  hasOrderBlock: boolean;
  hasCHoCH: boolean;
  hasLiquiditySweep: boolean;
  smcConfluenceCount: number;
  // Divergence
  noBearishDivergence: boolean;  // rsiDivergence !== 'bearish' (for BUY)
  // Fundamentals
  noFTConflict: boolean;         // Always true in backtest (no fundamentals)
  // Extra
  adxValue: number;
  weeklyTrend: string;
  bollingerSqueeze: boolean;
}
```

**Test:** Call with a known stock's historical data, verify it returns a sensible signal.

---

## Phase 3: Walk-Forward Engine (Core Simulation Loop)
**Estimated: ~1 hour | Depends on Phase 1 + 2**

### Create: `apps/api/src/services/backtest/walkForwardEngine.ts`

The main simulation loop. For each stock x each trading day, runs analysis on truncated data and checks outcomes.

**What it does:**
1. Accept config: `{ startDate, endDate, symbols[], minConfidence, signalExpiry, partialTargetR, fullTargetR }`
2. For each symbol:
   - Fetch full 2y daily + 3y weekly OHLC data ONCE via `fetchHistory(symbol, '2y', '1d')`
   - Generate list of trading days (weekdays) between startDate and endDate
   - For each trading day:
     - Truncate daily data to bars with `date <= simDate` (NO future leak)
     - Truncate weekly data similarly
     - Skip if < 100 daily bars (need enough for indicators)
     - Call `runAnalysisOnHistoricalData(symbol, truncatedDaily, truncatedWeekly, sector)`
     - If signal fires (BUY/SELL with confidence >= minConfidence):
       - Get future 7 bars: `fullDaily.filter(bar => bar.date > simDate).slice(0, signalExpiry)`
       - Call `checkOutcome(...)` from Phase 1
       - Record full `BacktestSignal` with conditions + outcome
3. Return all signals

**Key design decisions:**
- **One Yahoo fetch per stock** — fetch 2y daily and 3y weekly upfront, then slice per day
- **Skip weekends** — only simulate Mon-Fri
- **Progress logging** — log per-stock completion with signal count
- **Error tolerance** — catch errors per day, skip and continue (data gaps, etc.)
- **No DB saves during simulation** — pure in-memory, save at end via route

**Interface:**
```typescript
interface BacktestConfig {
  startDate: string;       // '2025-04-01'
  endDate: string;         // '2026-03-31'
  symbols: string[];
  minConfidence: number;   // 65
  signalExpiry: number;    // 7
  partialTargetR: number;  // 1.5
  fullTargetR: number;     // 2.5
}

interface BacktestSignal {
  date: string;
  symbol: string;
  direction: 'BUY' | 'SELL';
  confidence: number;
  regime: string;
  entryPrice: number;
  targetPrice: number;
  stopLoss: number;
  riskReward: number;
  conditions: BacktestConditions;
  // Outcome (from outcomeChecker)
  outcome: 'TARGET_HIT' | 'STOP_HIT' | 'PARTIAL_PROFIT' | 'EXPIRED';
  exitPrice: number;
  pnlPercent: number;
  daysToOutcome: number;
  mfe: number;
  mae: number;
  exitReason: string;
}
```

**Reuses:** `fetchHistory` from `data/yahooHistory`, Phase 1 + Phase 2 functions.

**Test:** Run on 3 stocks x 3 months, verify signals are generated with outcomes.

---

## Phase 4: Backtest Reporter + Stack Finder (Analytics)
**Estimated: ~1.5 hours | Depends on Phase 3**

### Create: `apps/api/src/services/backtest/backtestReporter.ts`

Two main outputs: (A) comprehensive statistics report, (B) condition stack discovery.

**Part A — Report Generator:**

Takes `BacktestSignal[]`, outputs:
- **Core metrics:** win rate, loss rate, profit factor, expectancy, avg P&L, total P&L
- **Outcome breakdown:** target hit, stop hit, partial profit, expired (count + %)
- **Timing:** avg days to outcome (winners vs losers)
- **MFE/MAE analysis:** avg MFE, avg MAE, MFE on losers (exit timing), MAE on winners (entry timing)
- **Component breakdowns:**
  - By regime: count, win rate, avg P&L per regime
  - By confidence bucket: 65-69, 70-79, 80-100
  - By pattern: per-pattern win rate
  - By SMC: with vs without, edge calculation
  - By weekly trend: aligned vs conflicting
  - By volume ratio: <1.0, 1.0-1.5, 1.5-2.0, 2.0+
- **Risk metrics:** max consecutive losses, max drawdown %, Sharpe ratio
- **Actionable insights:** auto-generated strings based on data

**Helper functions needed:**
- `calcWinRate(signals)` — % with TARGET_HIT or profitable PARTIAL
- `calcAvgPnl(signals)` — average pnlPercent
- `calcProfitFactor(signals)` — gross profit / gross loss
- `groupAndAnalyze(signals, keyFn)` — group by key, calc win rate + avg P&L per group
- `calcMaxConsecutiveLosses(signals)` — streak counting
- `calcMaxDrawdown(signals)` — cumulative P&L curve, find max peak-to-trough
- `calcSharpeRatio(signals)` — mean(daily returns) / std(daily returns) * sqrt(252)

**Part B — Condition Stack Finder:**

The gold mine. Tests all combinations of boolean conditions:

```typescript
function findBestStacks(signals: BacktestSignal[]): ConditionStack[] {
  // 1. Extract all boolean condition keys from BacktestConditions
  // 2. Test all 2-condition pairs (N*(N-1)/2 combos)
  // 3. Test all 3-condition triples
  // 4. For top performers from triples, test 4-condition quads
  // 5. For top quads, test 5-condition stacks
  // Filter: minimum 20 signals per stack
  // Sort by: edge (win rate - baseline win rate)
  // Return: top 10 best stacks + bottom 5 worst stacks
}
```

**Output:**
```typescript
interface ConditionStack {
  conditions: string[];
  totalSignals: number;
  winRate: number;
  avgPnl: number;
  profitFactor: number;
  sampleSize: number;
  edge: number;  // winRate - baselineWinRate
}

interface BacktestReport {
  // ... all the metrics listed above
  topStacks: ConditionStack[];     // Best 10
  worstStacks: ConditionStack[];   // Worst 5
  insights: string[];
}
```

**Test:** Feed mock signals, verify stacks are found and sorted correctly.

---

## Phase 5: Model + Route + Integration
**Estimated: ~45 min | Depends on Phase 1-4**

### Create: `apps/api/src/models/BacktestResult.ts`

MongoDB model to store backtest results for historical reference.

```typescript
interface IBacktestResult extends Document {
  config: {
    startDate: string;
    endDate: string;
    symbolCount: number;
    symbols: string[];
    minConfidence: number;
  };
  report: BacktestReport;       // Full report object
  signals: BacktestSignal[];    // Raw signal array
  topStacks: ConditionStack[];  // Best stacks found
  worstStacks: ConditionStack[];
  status: 'RUNNING' | 'COMPLETED' | 'FAILED';
  progress?: string;            // "45/50 stocks processed"
  error?: string;
  duration?: number;            // ms
}
```

### Add Route: `POST /api/backtest/historical` in `routes/backtest.ts`

Long-running endpoint — start backtest, return immediately with job ID, poll for status.

```
POST /api/backtest/historical
Body: { startDate?, endDate?, symbols?, minConfidence? }
Returns: { success: true, backtestId, status: 'RUNNING' }

GET /api/backtest/historical/:id
Returns: { success: true, status, progress?, report?, signals? }

GET /api/backtest/historical
Returns: { success: true, results: [{ id, config, status, createdAt }] }
```

**Implementation:**
1. Create BacktestResult doc with status='RUNNING'
2. Fire `runWalkForwardBacktest()` in background (don't await)
3. Update doc with report + signals when complete
4. Return backtestId immediately

### Register model in `models/index.ts`

---

## Phase 6: Signal Grading (Post-Backtest)
**Estimated: ~45 min | Depends on Phase 4 results**

After running the backtest and identifying top stacks, implement signal grading.

### Modify: `apps/api/src/services/analysis/singleAnalysisOrchestrator.ts`

### Create: `apps/api/src/services/analysis/signalGrading.ts`

```typescript
function gradeSignal(conditions: BacktestConditions): 'A+' | 'A' | 'B' | 'C' | 'F' {
  // A+ Setup: top condition stacks from backtest (75%+ win rate)
  // A Setup: next tier (70%+ win rate)
  // B Setup: decent (60-70% win rate)
  // C Setup: marginal (55-60% win rate)
  // F Setup: conditions that backtest showed are losers — BLOCK
}
```

### Modify: `apps/api/src/models/SignalRecord.ts`
- Add `grade: 'A+' | 'A' | 'B' | 'C' | 'F'` field

### Modify Behavior:
- **Top 10 dashboard:** Only show A+ and A signals
- **Telegram alerts:** Only fire for A+ signals
- **Paper trading:** Take A, B, and C signals (for continued data collection)
- **F signals:** Block entirely, never surface

### Add Route: `GET /api/backtest/historical/:id/stacks`
Returns the condition stacks with grading thresholds applied.

**Note:** The exact grading rules will be determined by the backtest results. Phase 6 is coded AFTER reviewing Phase 4/5 output. Initial implementation uses placeholder thresholds that get refined from actual data.

---

## Execution Order

```
Day 1: Phase 1 + 2 + 3 (core engine — can run quick test)
       Quick test: 10 stocks x 6 months → verify it works

Day 2: Phase 4 + 5 (reporter + route — can run full backtest)
       Medium test: NIFTY 50 x 12 months → first real results

Day 3: Phase 6 (signal grading — based on backtest findings)
       Review stacks → code grading rules → deploy to live

Day 4+: Monitor live performance with grades applied
```

---

## File Summary

| Phase | File | Type | Lines (est.) |
|-------|------|------|-------------|
| 1 | `services/backtest/outcomeChecker.ts` | NEW | ~180 |
| 2 | `services/backtest/historicalBacktester.ts` | NEW | ~350 |
| 3 | `services/backtest/walkForwardEngine.ts` | NEW | ~150 |
| 4 | `services/backtest/backtestReporter.ts` | NEW | ~400 |
| 5 | `models/BacktestResult.ts` | NEW | ~60 |
| 5 | `routes/backtest.ts` | MODIFY | +80 |
| 6 | `services/analysis/signalGrading.ts` | NEW | ~80 |
| 6 | `models/SignalRecord.ts` | MODIFY | +2 |
| 6 | `services/analysis/singleAnalysisOrchestrator.ts` | MODIFY | +15 |
| **Total** | | | **~1,300 lines** |

---

## Overfitting Prevention (Built Into the System)

1. **Minimum 20 signals per stack** — hardcoded in stack finder
2. **Train/Validate split** — route accepts separate date ranges:
   - Training: Apr 2025 → Dec 2025 (find stacks)
   - Validation: Jan 2026 → Mar 2026 (confirm stacks)
3. **Max 5 conditions per stack** — more = more overfitting risk
4. **Edge threshold** — only keep stacks with edge > +5% over baseline
5. **Live forward test (System B)** — already built, validates grades in production
