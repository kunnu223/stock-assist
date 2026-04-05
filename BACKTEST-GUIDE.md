# Stock-Assist: Historical Walk-Forward Backtester
## Test Your System on 12 Months of Past Data — TODAY

---

## THE CONCEPT

Instead of waiting 3 months for live signals, simulate the last 12 months:

```
For each trading day from April 2025 → March 2026:
  1. Grab OHLC data available UP TO that date (look-back only, no future leak)
  2. Run your FULL analysis pipeline (indicators, patterns, SMC, regime, confidence)
  3. If signal fires (BUY/SELL with confidence >= 65):
     - Record: symbol, direction, entry, target, stop, confidence
     - Check NEXT 7 actual trading days:
       - Did price hit 1.5R? (partial profit)
       - Did price hit 2.5R? (full target)
       - Did price hit stop? (loss)
       - Neither in 7 days? (expired)
     - Record MFE/MAE from those 7 days
  4. Move to next trading day, repeat
```

This gives you 200-300+ resolved signals in ~30 minutes of compute time,
instead of waiting 3 months.

---

## ARCHITECTURE

```
apps/api/src/services/backtest/
├── historicalBacktester.ts      ← NEW: Main orchestrator
├── walkForwardEngine.ts         ← NEW: Day-by-day simulation
├── outcomeChecker.ts            ← NEW: Check 7-day forward outcomes
├── backtestReporter.ts          ← NEW: Generate stats report
└── signalTracker.ts             ← EXISTING: Reuse signal saving logic
```

---

## IMPLEMENTATION

### File 1: `walkForwardEngine.ts`
### The core simulation loop

```typescript
import { fetchHistoricalOHLC } from '../data/yahooHistory';
import { singleAnalysisOrchestrator } from '../analysis/singleAnalysisOrchestrator';
import { checkOutcome } from './outcomeChecker';

interface BacktestConfig {
  // Date range to test
  startDate: string;        // '2025-04-01'
  endDate: string;          // '2026-03-31'

  // Stock universe (smaller = faster)
  symbols: string[];        // Start with NIFTY 50, expand later

  // Your system settings (match production)
  minConfidence: number;    // 65
  signalExpiry: number;     // 7 days
  partialTargetR: number;   // 1.5
  fullTargetR: number;      // 2.5
  slATRMultiple: number;    // 1.2
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

  // Conditions at signal time (for component analysis)
  conditions: {
    rsiValue: number;
    macdTrend: string;
    maTrend: string;
    volumeRatio: number;
    adxValue: number;
    regime: string;
    alignmentScore: number;
    hasOrderBlock: boolean;
    hasCHoCH: boolean;
    hasLiquiditySweep: boolean;
    smcConfluenceCount: number;
    primaryPattern: string | null;
    patternWeight: number;
    weeklyTrend: string;

    // Phase 2 indicators
    macdMomentum: string;
    volumeTrend: string;
    rsiDivergence: string;
    bollingerSqueeze: boolean;
  };

  // Filled after outcome check
  outcome: 'TARGET_HIT' | 'STOP_HIT' | 'PARTIAL_PROFIT' | 'EXPIRED' | null;
  exitPrice: number | null;
  pnlPercent: number | null;
  daysToOutcome: number | null;
  mfe: number;     // Max favorable excursion %
  mae: number;     // Max adverse excursion %
  exitReason: string | null;
}

async function runWalkForwardBacktest(config: BacktestConfig): Promise<BacktestSignal[]> {
  const signals: BacktestSignal[] = [];
  const tradingDays = getTradingDays(config.startDate, config.endDate);

  console.log(`Backtesting ${config.symbols.length} stocks × ${tradingDays.length} days`);
  console.log(`Total iterations: ${config.symbols.length * tradingDays.length}`);

  for (const symbol of config.symbols) {
    // Fetch FULL history once per stock (saves API calls)
    const fullDaily = await fetchHistoricalOHLC(symbol, '2y', '1d');
    const fullWeekly = await fetchHistoricalOHLC(symbol, '3y', '1wk');

    if (!fullDaily || fullDaily.length < 150) {
      console.log(`Skipping ${symbol} — insufficient data`);
      continue;
    }

    for (const simDate of tradingDays) {
      // CRITICAL: Only use data UP TO simDate (no future leak)
      const dailyData = fullDaily.filter(bar => bar.date <= simDate);
      const weeklyData = fullWeekly.filter(bar => bar.date <= simDate);

      if (dailyData.length < 100) continue; // Need enough history for indicators

      // Run your ACTUAL analysis pipeline on this truncated data
      try {
        const analysis = await runAnalysisOnHistoricalData(
          symbol, dailyData, weeklyData
        );

        // Only record if signal fires
        if (analysis.recommendation === 'BUY' || analysis.recommendation === 'SELL') {
          if (analysis.confidence >= config.minConfidence) {

            // Get FUTURE 7 days for outcome checking
            const futureData = fullDaily.filter(bar =>
              bar.date > simDate
            ).slice(0, config.signalExpiry);

            const outcome = checkOutcome({
              direction: analysis.recommendation,
              entryPrice: analysis.entryPrice,
              targetPrice: analysis.targetPrice,
              stopLoss: analysis.stopLoss,
              futureCandles: futureData,
              partialTargetR: config.partialTargetR,
              fullTargetR: config.fullTargetR,
            });

            signals.push({
              date: simDate,
              symbol,
              direction: analysis.recommendation,
              confidence: analysis.confidence,
              regime: analysis.regime,
              entryPrice: analysis.entryPrice,
              targetPrice: analysis.targetPrice,
              stopLoss: analysis.stopLoss,
              riskReward: analysis.riskReward,
              conditions: analysis.conditions,  // Full snapshot
              ...outcome,
            });
          }
        }
      } catch (err) {
        // Skip errors (data gaps, etc.)
        continue;
      }
    }

    console.log(`✓ ${symbol} — ${signals.filter(s => s.symbol === symbol).length} signals`);
  }

  return signals;
}
```

### File 2: `outcomeChecker.ts`
### Check what actually happened after each signal

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

function checkOutcome(input: OutcomeCheckInput): OutcomeResult {
  const { direction, entryPrice, targetPrice, stopLoss, futureCandles } = input;
  const risk = Math.abs(entryPrice - stopLoss);

  // Partial profit levels
  const partialTarget = direction === 'BUY'
    ? entryPrice + risk * input.partialTargetR
    : entryPrice - risk * input.partialTargetR;

  const fullTarget = direction === 'BUY'
    ? entryPrice + risk * input.fullTargetR
    : entryPrice - risk * input.fullTargetR;

  let mfe = 0;  // Max favorable excursion %
  let mae = 0;  // Max adverse excursion %
  let partialFilled = false;
  let trailingStop = stopLoss;
  let breakeven = false;

  for (let i = 0; i < futureCandles.length; i++) {
    const bar = futureCandles[i];
    const day = i + 1;

    // Track MFE/MAE
    if (direction === 'BUY') {
      const favorable = ((bar.high - entryPrice) / entryPrice) * 100;
      const adverse = ((entryPrice - bar.low) / entryPrice) * 100;
      mfe = Math.max(mfe, favorable);
      mae = Math.max(mae, adverse);
    } else {
      const favorable = ((entryPrice - bar.low) / entryPrice) * 100;
      const adverse = ((bar.high - entryPrice) / entryPrice) * 100;
      mfe = Math.max(mfe, favorable);
      mae = Math.max(mae, adverse);
    }

    // Check stop loss FIRST (same bar priority)
    if (direction === 'BUY' && bar.low <= (partialFilled ? trailingStop : stopLoss)) {
      const exitPrice = partialFilled ? trailingStop : stopLoss;
      if (partialFilled) {
        // Partial was already booked — blended P&L
        const partialPnl = ((partialTarget - entryPrice) / entryPrice) * 100;
        const remainPnl = ((exitPrice - entryPrice) / entryPrice) * 100;
        return {
          outcome: 'PARTIAL_PROFIT',
          exitPrice,
          pnlPercent: (partialPnl * 0.5) + (remainPnl * 0.5),
          daysToOutcome: day,
          mfe, mae,
          exitReason: 'stop_trailing'
        };
      }
      return {
        outcome: 'STOP_HIT',
        exitPrice: stopLoss,
        pnlPercent: ((stopLoss - entryPrice) / entryPrice) * 100,
        daysToOutcome: day,
        mfe, mae,
        exitReason: 'stop_initial'
      };
    }

    if (direction === 'SELL' && bar.high >= (partialFilled ? trailingStop : stopLoss)) {
      const exitPrice = partialFilled ? trailingStop : stopLoss;
      if (partialFilled) {
        const partialPnl = ((entryPrice - partialTarget) / entryPrice) * 100;
        const remainPnl = ((entryPrice - exitPrice) / entryPrice) * 100;
        return {
          outcome: 'PARTIAL_PROFIT',
          exitPrice,
          pnlPercent: (partialPnl * 0.5) + (remainPnl * 0.5),
          daysToOutcome: day,
          mfe, mae,
          exitReason: 'stop_trailing'
        };
      }
      return {
        outcome: 'STOP_HIT',
        exitPrice: stopLoss,
        pnlPercent: ((entryPrice - stopLoss) / entryPrice) * 100,
        daysToOutcome: day,
        mfe, mae,
        exitReason: 'stop_initial'
      };
    }

    // Check partial target (1.5R)
    if (!partialFilled) {
      if (direction === 'BUY' && bar.high >= partialTarget) {
        partialFilled = true;
        // Set trailing stop: lowest low of last 2 bars
        const recentLows = futureCandles.slice(Math.max(0, i - 1), i + 1).map(b => b.low);
        trailingStop = Math.min(...recentLows);
        // Also check: did it hit full target same bar?
        if (bar.high >= fullTarget) {
          const partialPnl = ((partialTarget - entryPrice) / entryPrice) * 100;
          const fullPnl = ((fullTarget - entryPrice) / entryPrice) * 100;
          return {
            outcome: 'TARGET_HIT',
            exitPrice: fullTarget,
            pnlPercent: (partialPnl * 0.5) + (fullPnl * 0.5),
            daysToOutcome: day,
            mfe, mae,
            exitReason: 'target_full'
          };
        }
        continue;
      }
      if (direction === 'SELL' && bar.low <= partialTarget) {
        partialFilled = true;
        const recentHighs = futureCandles.slice(Math.max(0, i - 1), i + 1).map(b => b.high);
        trailingStop = Math.max(...recentHighs);
        if (bar.low <= fullTarget) {
          const partialPnl = ((entryPrice - partialTarget) / entryPrice) * 100;
          const fullPnl = ((entryPrice - fullTarget) / entryPrice) * 100;
          return {
            outcome: 'TARGET_HIT',
            exitPrice: fullTarget,
            pnlPercent: (partialPnl * 0.5) + (fullPnl * 0.5),
            daysToOutcome: day,
            mfe, mae,
            exitReason: 'target_full'
          };
        }
        continue;
      }
    }

    // Update trailing stop if partial filled
    if (partialFilled && i >= 1) {
      if (direction === 'BUY') {
        const newTrail = Math.min(futureCandles[i - 1].low, bar.low);
        trailingStop = Math.max(trailingStop, newTrail); // Only moves UP
      } else {
        const newTrail = Math.max(futureCandles[i - 1].high, bar.high);
        trailingStop = Math.min(trailingStop, newTrail); // Only moves DOWN
      }
    }

    // Check full target (2.5R) after partial
    if (partialFilled) {
      if (direction === 'BUY' && bar.high >= fullTarget) {
        const partialPnl = ((partialTarget - entryPrice) / entryPrice) * 100;
        const fullPnl = ((fullTarget - entryPrice) / entryPrice) * 100;
        return {
          outcome: 'TARGET_HIT',
          exitPrice: fullTarget,
          pnlPercent: (partialPnl * 0.5) + (fullPnl * 0.5),
          daysToOutcome: day,
          mfe, mae,
          exitReason: 'target_full'
        };
      }
      if (direction === 'SELL' && bar.low <= fullTarget) {
        const partialPnl = ((entryPrice - partialTarget) / entryPrice) * 100;
        const fullPnl = ((entryPrice - fullTarget) / entryPrice) * 100;
        return {
          outcome: 'TARGET_HIT',
          exitPrice: fullTarget,
          pnlPercent: (partialPnl * 0.5) + (fullPnl * 0.5),
          daysToOutcome: day,
          mfe, mae,
          exitReason: 'target_full'
        };
      }
    }
  }

  // Day 7 reached — expired
  const lastBar = futureCandles[futureCandles.length - 1];
  const exitPrice = lastBar?.close ?? entryPrice;

  if (partialFilled) {
    const partialPnl = direction === 'BUY'
      ? ((partialTarget - entryPrice) / entryPrice) * 100
      : ((entryPrice - partialTarget) / entryPrice) * 100;
    const remainPnl = direction === 'BUY'
      ? ((exitPrice - entryPrice) / entryPrice) * 100
      : ((entryPrice - exitPrice) / entryPrice) * 100;
    return {
      outcome: 'PARTIAL_PROFIT',
      exitPrice,
      pnlPercent: (partialPnl * 0.5) + (remainPnl * 0.5),
      daysToOutcome: futureCandles.length,
      mfe, mae,
      exitReason: 'time_expiry_partial'
    };
  }

  return {
    outcome: 'EXPIRED',
    exitPrice,
    pnlPercent: direction === 'BUY'
      ? ((exitPrice - entryPrice) / entryPrice) * 100
      : ((entryPrice - exitPrice) / entryPrice) * 100,
    daysToOutcome: futureCandles.length,
    mfe, mae,
    exitReason: 'time_expiry'
  };
}
```

### File 3: `backtestReporter.ts`
### Generate comprehensive stats from backtest results

```typescript
interface BacktestReport {
  // Overview
  totalSignals: number;
  dateRange: string;
  symbolCount: number;

  // Core metrics
  winRate: number;              // % of TARGET_HIT + profitable PARTIAL
  lossRate: number;
  profitFactor: number;
  expectancy: number;           // Average R per trade
  avgPnlPercent: number;
  totalPnlPercent: number;

  // Outcome breakdown
  outcomes: {
    targetHit: number;
    stopHit: number;
    partialProfit: number;
    expired: number;
  };

  // Timing
  avgDaysToOutcome: number;
  avgDaysWinners: number;
  avgDaysLosers: number;

  // MFE/MAE analysis (tells you if exits are optimal)
  avgMFE: number;               // How far price went in your favor
  avgMAE: number;               // How far price went against you
  mfeOnLosers: number;          // MFE on losing trades (were they ever winning?)
  maeOnWinners: number;         // MAE on winning trades (how much heat taken?)

  // Component breakdown (the gold — which factors predict winners?)
  byRegime: Record<string, { count: number; winRate: number; avgPnl: number }>;
  byConfidenceBucket: Record<string, { count: number; winRate: number; avgPnl: number }>;
  byPattern: Record<string, { count: number; winRate: number; avgPnl: number }>;
  bySMC: {
    withSMC: { count: number; winRate: number; avgPnl: number };
    withoutSMC: { count: number; winRate: number; avgPnl: number };
    edge: number;  // withSMC.winRate - withoutSMC.winRate
  };
  byWeeklyTrend: Record<string, { count: number; winRate: number; avgPnl: number }>;
  byVolumeRatio: Record<string, { count: number; winRate: number; avgPnl: number }>;

  // Risk metrics
  maxConsecutiveLosses: number;
  maxDrawdownPercent: number;
  sharpeRatio: number;

  // Actionable insights
  insights: string[];
}

function generateReport(signals: BacktestSignal[]): BacktestReport {
  const winners = signals.filter(s =>
    s.outcome === 'TARGET_HIT' ||
    (s.outcome === 'PARTIAL_PROFIT' && s.pnlPercent > 0)
  );
  const losers = signals.filter(s =>
    s.outcome === 'STOP_HIT' ||
    (s.pnlPercent !== null && s.pnlPercent < 0)
  );

  const winRate = (winners.length / signals.length) * 100;
  const avgWin = average(winners.map(s => s.pnlPercent!));
  const avgLoss = Math.abs(average(losers.map(s => s.pnlPercent!)));
  const profitFactor = (winners.length * avgWin) / (losers.length * avgLoss);

  // Component analysis
  const byRegime = groupAndAnalyze(signals, s => s.regime);
  const byConfidence = groupAndAnalyze(signals, s => {
    if (s.confidence >= 80) return '80-100';
    if (s.confidence >= 70) return '70-79';
    if (s.confidence >= 65) return '65-69';
    return '<65';
  });
  const byPattern = groupAndAnalyze(signals, s => s.conditions.primaryPattern ?? 'none');

  const withSMC = signals.filter(s => s.conditions.smcConfluenceCount >= 1);
  const withoutSMC = signals.filter(s => s.conditions.smcConfluenceCount === 0);

  // MFE/MAE insights
  const mfeOnLosers = average(losers.map(s => s.mfe));
  const maeOnWinners = average(winners.map(s => s.mae));

  // Generate actionable insights
  const insights: string[] = [];

  if (mfeOnLosers > 1.0) {
    insights.push(
      `EXITS TOO EARLY: Losing trades had avg ${mfeOnLosers.toFixed(1)}% MFE — ` +
      `many were winning before hitting stop. Consider wider stops or faster partial profit.`
    );
  }

  if (maeOnWinners > 2.0) {
    insights.push(
      `TAKING TOO MUCH HEAT: Winning trades had avg ${maeOnWinners.toFixed(1)}% MAE — ` +
      `entries could be tighter (closer to support/OB zones).`
    );
  }

  const smcEdge = calcWinRate(withSMC) - calcWinRate(withoutSMC);
  if (smcEdge > 3) {
    insights.push(`SMC HELPS: +${smcEdge.toFixed(1)}% win rate with SMC confluence. Increase SMC weight.`);
  } else if (smcEdge < -3) {
    insights.push(`SMC HURTS: ${smcEdge.toFixed(1)}% win rate with SMC. Consider reducing SMC weight.`);
  } else {
    insights.push(`SMC NEUTRAL: ${smcEdge.toFixed(1)}% difference. Keep as light filter.`);
  }

  // Find best/worst regimes
  const regimeEntries = Object.entries(byRegime);
  const bestRegime = regimeEntries.sort((a, b) => b[1].winRate - a[1].winRate)[0];
  const worstRegime = regimeEntries.sort((a, b) => a[1].winRate - b[1].winRate)[0];
  insights.push(
    `BEST REGIME: ${bestRegime[0]} (${bestRegime[1].winRate.toFixed(1)}% win rate). ` +
    `WORST: ${worstRegime[0]} (${worstRegime[1].winRate.toFixed(1)}%). ` +
    `Consider blocking signals in ${worstRegime[0]} regime.`
  );

  return {
    totalSignals: signals.length,
    dateRange: `${signals[0]?.date} to ${signals[signals.length - 1]?.date}`,
    symbolCount: new Set(signals.map(s => s.symbol)).size,
    winRate,
    lossRate: 100 - winRate,
    profitFactor,
    expectancy: (winRate / 100 * avgWin) - ((100 - winRate) / 100 * avgLoss),
    avgPnlPercent: average(signals.map(s => s.pnlPercent!)),
    totalPnlPercent: sum(signals.map(s => s.pnlPercent!)),
    outcomes: {
      targetHit: signals.filter(s => s.outcome === 'TARGET_HIT').length,
      stopHit: signals.filter(s => s.outcome === 'STOP_HIT').length,
      partialProfit: signals.filter(s => s.outcome === 'PARTIAL_PROFIT').length,
      expired: signals.filter(s => s.outcome === 'EXPIRED').length,
    },
    avgDaysToOutcome: average(signals.map(s => s.daysToOutcome!)),
    avgDaysWinners: average(winners.map(s => s.daysToOutcome!)),
    avgDaysLosers: average(losers.map(s => s.daysToOutcome!)),
    avgMFE: average(signals.map(s => s.mfe)),
    avgMAE: average(signals.map(s => s.mae)),
    mfeOnLosers,
    maeOnWinners,
    byRegime,
    byConfidenceBucket: byConfidence,
    byPattern,
    bySMC: {
      withSMC: { count: withSMC.length, winRate: calcWinRate(withSMC), avgPnl: calcAvgPnl(withSMC) },
      withoutSMC: { count: withoutSMC.length, winRate: calcWinRate(withoutSMC), avgPnl: calcAvgPnl(withoutSMC) },
      edge: smcEdge,
    },
    byWeeklyTrend: groupAndAnalyze(signals, s => s.conditions.weeklyTrend),
    byVolumeRatio: groupAndAnalyze(signals, s => {
      if (s.conditions.volumeRatio >= 2.0) return '2.0+';
      if (s.conditions.volumeRatio >= 1.5) return '1.5-2.0';
      if (s.conditions.volumeRatio >= 1.0) return '1.0-1.5';
      return '<1.0';
    }),
    maxConsecutiveLosses: calcMaxConsecutiveLosses(signals),
    maxDrawdownPercent: calcMaxDrawdown(signals),
    sharpeRatio: calcSharpe(signals),
    insights,
  };
}
```

### File 4: `historicalBacktester.ts`
### API route handler + the key adaptation function

```typescript
// The critical function: run your EXISTING pipeline on historical data
// WITHOUT calling AI (too slow for 1000s of iterations, and responses
// would be different each time making results non-reproducible)

async function runAnalysisOnHistoricalData(
  symbol: string,
  dailyData: OHLCData[],
  weeklyData: OHLCData[]
): Promise<BacktestAnalysisResult> {

  // Get sector for this symbol
  const sector = getSectorForSymbol(symbol);

  // Step 1: Calculate indicators (REUSE your existing functions)
  const rsi = calculateRSI(dailyData.map(d => d.close), sector);
  const macd = calculateMACD(dailyData.map(d => d.close), sector);
  const ma = calculateMA(dailyData);
  const volume = analyzeVolume(dailyData);
  const atr = calcATR(dailyData);
  const adx = calcADX(dailyData);
  const bollinger = calcBollinger(dailyData);

  // Weekly indicators
  const weeklyRSI = calculateRSI(weeklyData.map(d => d.close), sector);
  const weeklyMA = calculateMA(weeklyData);

  // Step 2: Patterns (REUSE)
  const patterns = detectCandlestickPatterns(dailyData);

  // Step 3: SMC (REUSE)
  const smc = analyzeSMC(dailyData, atr);

  // Step 4: Regime (REUSE)
  const regime = classifyRegime(adx, bollinger, volume);

  // Step 5: Confidence scoring (REUSE)
  const confidence = calculateConfidence({
    indicators: { rsi, macd, ma, volume, atr, adx },
    weeklyIndicators: { rsi: weeklyRSI, ma: weeklyMA },
    patterns,
    smc,
    regime,
    // Skip news and fundamentals for backtest speed
    // (or include if you want more accuracy)
    news: null,
    fundamentals: null,
  });

  // Step 6: Entry zone (REUSE)
  const entryZone = calculateEntryZone(
    confidence.direction,
    dailyData[dailyData.length - 1].close,
    atr,
    smc
  );

  return {
    recommendation: confidence.recommendation,
    confidence: confidence.score,
    direction: confidence.direction,
    regime: regime.type,
    entryPrice: entryZone.entry,
    targetPrice: entryZone.target,
    stopLoss: entryZone.stopLoss,
    riskReward: entryZone.riskReward,
    conditions: {
      rsiValue: rsi.value,
      macdTrend: macd.trend,
      maTrend: ma.trend,
      volumeRatio: volume.ratio,
      adxValue: adx.value,
      regime: regime.type,
      alignmentScore: confidence.alignmentScore,
      hasOrderBlock: smc.orderBlocks.some(ob => !ob.mitigated),
      hasCHoCH: smc.choch !== null,
      hasLiquiditySweep: smc.liquiditySweep !== null,
      smcConfluenceCount: countSMCSignals(smc),
      primaryPattern: patterns.primary?.name ?? null,
      patternWeight: patterns.primary?.weight ?? 0,
      weeklyTrend: weeklyMA.trend,
      macdMomentum: macd.histogramMomentum,
      volumeTrend: volume.trend,
      rsiDivergence: rsi.divergence,
      bollingerSqueeze: regime.type === 'TRANSITION',
    }
  };
}
```

### File 5: New API Route

```typescript
// routes/backtest.ts — add this endpoint

// POST /api/backtest/historical
router.post('/historical', async (req, res) => {
  const {
    startDate = '2025-04-01',
    endDate = '2026-03-31',
    symbols = NIFTY_50_SYMBOLS,  // Start with 50, not 200
    minConfidence = 65,
  } = req.body;

  // This will take 10-30 minutes depending on symbol count
  // Consider running as background job

  const signals = await runWalkForwardBacktest({
    startDate,
    endDate,
    symbols,
    minConfidence,
    signalExpiry: 7,
    partialTargetR: 1.5,
    fullTargetR: 2.5,
    slATRMultiple: 1.2,
  });

  const report = generateReport(signals);

  // Save raw signals to DB for further analysis
  await BacktestResult.create({
    config: { startDate, endDate, symbolCount: symbols.length },
    report,
    signals, // Full signal array
    createdAt: new Date(),
  });

  res.json({ success: true, report, signalCount: signals.length });
});
```

---

## PRACTICAL EXECUTION PLAN

### Step 1: Quick Test (30 minutes)
```
Symbols: 10 stocks (DEFAULT_WATCHLIST)
Period: 6 months (Oct 2025 → Mar 2026)
Expected: ~30-80 signals
Purpose: Verify the backtest runs without errors
```

### Step 2: Medium Test (2-3 hours compute)
```
Symbols: NIFTY 50 (50 stocks)
Period: 12 months (Apr 2025 → Mar 2026)
Expected: ~200-400 signals
Purpose: First real accuracy measurement
```

### Step 3: Full Test (overnight run)
```
Symbols: Full universe (~200 stocks)
Period: 12 months
Expected: ~500-1500 signals
Purpose: Statistically significant results
```

---

## IMPORTANT: SKIP AI DURING BACKTEST

Your AI calls (Gemini/Groq) should be DISABLED during backtesting because:

1. **Speed:** 1000+ API calls to Gemini = hours of wait + rate limits
2. **Reproducibility:** AI gives different answers each time = non-reproducible results
3. **Cost:** Thousands of Gemini calls = real money
4. **Your system is authoritative anyway:** AI only provides qualitative reasoning, your system overrides AI probabilities

Set a `BACKTEST_MODE = true` flag that skips AI calls and uses system-only scoring.
This is actually a BETTER test of your system since it isolates YOUR algorithms.

---

## WHAT THE RESULTS WILL TELL YOU

After the backtest completes, you'll have answers to:

1. **Actual win rate** of your new system on 12 months of NSE data
2. **Profit Factor** — the number that matters most
3. **Which regime works best** — should you block signals in RANGE? VOLATILE?
4. **Does SMC help?** — first real A/B comparison on NSE
5. **Which patterns predict winners** — kill the losers, boost the winners
6. **Are your stops too tight?** — MFE on losers tells you this
7. **Are your entries too late?** — MAE on winners tells you this
8. **Optimal confidence threshold** — is 65 right, or should it be 70? 75?
9. **Best holding period** — do winners resolve in 2 days or 5?
10. **Max drawdown** — how bad can it get?

This is EXACTLY what Phase 3 was about — but compressed into one day instead of 3 months.
