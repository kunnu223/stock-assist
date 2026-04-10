/**
 * Walk-Forward Engine — day-by-day historical simulation
 * Fetches data once per stock, truncates per day, runs analysis + outcome check
 * @module @stock-assist/api/services/backtest/walkForwardEngine
 */

import type { OHLCData } from '@stock-assist/shared';
import { fetchHistory } from '../data/yahooHistory';
import { runAnalysisOnHistoricalData, type BacktestConditions, type NullReasonCounters } from './historicalBacktester';
import { runMomentumStrategy, buildMomentumUniverse, type MomentumUniverseRanking } from './momentumStrategy';
import { checkOutcome } from './outcomeChecker';
import { gradeSignal, isBlockedGrade } from '../analysis/signalGrading';
import { logger } from '../../config/logger';

// ═══════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════

export type BacktestStrategy = 'legacy' | 'momentum';

export interface BacktestConfig {
    startDate: string;       // '2025-04-01'
    endDate: string;         // '2026-03-31'
    symbols: string[];
    minConfidence: number;   // 65
    signalExpiry: number;    // 7
    partialTargetR: number;  // 1.5
    fullTargetR: number;     // 2.5
    /**
     * Which strategy to evaluate.
     *  - 'legacy'   = the original SMC + confidence-scoring pipeline (default)
     *  - 'momentum' = cross-sectional momentum + Donchian breakout (long-only)
     */
    strategy?: BacktestStrategy;
}

export interface BacktestSignal {
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
    // Outcome
    outcome: 'TARGET_HIT' | 'STOP_HIT' | 'PARTIAL_PROFIT' | 'EXPIRED';
    exitPrice: number;
    pnlPercent: number;
    daysToOutcome: number;
    mfe: number;
    mae: number;
    exitReason: string;
}

export interface BacktestProgress {
    totalSymbols: number;
    completedSymbols: number;
    currentSymbol: string;
    totalSignals: number;
    errors: number;
}

// ═══════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════
// PER-CONDITION EDGE AUDIT
// ═══════════════════════════════════════════════════════════════

interface EdgeRow {
    condition: string;
    bucket: string;
    n: number;
    winRate: number;
    edge: number; // vs baseline (overall win rate)
    avgPnl: number;
}

/**
 * Audits each condition (boolean / string / numeric bucket) against trade
 * outcomes. Edge = winRate(condition) - overall winRate. Positive edge =
 * predictive of winners. Negative edge = predictive of losers (scorer is
 * using it backwards, or it's anti-predictive).
 */
function runConditionEdgeAudit(
    signals: BacktestSignal[],
    isWinner: (s: BacktestSignal) => boolean,
): void {
    if (signals.length === 0) return;

    const baselineWinRate = (signals.filter(isWinner).length / signals.length) * 100;
    const rows: EdgeRow[] = [];

    const recordBucket = (condition: string, bucket: string, subset: BacktestSignal[]) => {
        if (subset.length < 20) return; // Need enough samples to be meaningful
        const wins = subset.filter(isWinner).length;
        const winRate = (wins / subset.length) * 100;
        const avgPnl = subset.reduce((a, s) => a + (s.pnlPercent ?? 0), 0) / subset.length;
        rows.push({
            condition,
            bucket,
            n: subset.length,
            winRate: Number(winRate.toFixed(1)),
            edge: Number((winRate - baselineWinRate).toFixed(1)),
            avgPnl: Number(avgPnl.toFixed(2)),
        });
    };

    const auditBoolean = (key: keyof BacktestSignal['conditions'], label: string) => {
        const trueSet = signals.filter(s => s.conditions[key] === true);
        const falseSet = signals.filter(s => s.conditions[key] === false);
        recordBucket(label, 'TRUE', trueSet);
        recordBucket(label, 'FALSE', falseSet);
    };

    const auditString = (key: keyof BacktestSignal['conditions'], label: string) => {
        const values = new Set(signals.map(s => String(s.conditions[key])));
        for (const v of values) {
            const subset = signals.filter(s => String(s.conditions[key]) === v);
            recordBucket(label, v, subset);
        }
    };

    const auditNumeric = (
        key: keyof BacktestSignal['conditions'],
        label: string,
        buckets: { name: string; min: number; max: number }[],
    ) => {
        for (const b of buckets) {
            const subset = signals.filter(s => {
                const v = s.conditions[key] as number;
                return typeof v === 'number' && v >= b.min && v < b.max;
            });
            recordBucket(label, b.name, subset);
        }
    };

    // BOOLEAN CONDITIONS
    auditBoolean('isStrongTrend', 'isStrongTrend');
    auditBoolean('isTransition', 'isTransition');
    auditBoolean('weeklyAligned', 'weeklyAligned');
    auditBoolean('allTimeframesAligned', 'allTimeframesAligned');
    auditBoolean('volumeHigh', 'volumeHigh');
    auditBoolean('volumeConfirmed', 'volumeConfirmed');
    auditBoolean('volumeIncreasing', 'volumeIncreasing');
    auditBoolean('rsiInZone', 'rsiInZone');
    auditBoolean('macdBullish', 'macdBullish');
    auditBoolean('macdAccelerating', 'macdAccelerating');
    auditBoolean('emaCrossover', 'emaCrossover');
    auditBoolean('hasStrongPattern', 'hasStrongPattern');
    auditBoolean('hasOrderBlock', 'hasOrderBlock');
    auditBoolean('hasCHoCH', 'hasCHoCH');
    auditBoolean('hasLiquiditySweep', 'hasLiquiditySweep');
    auditBoolean('noBearishDivergence', 'noBearishDivergence');
    auditBoolean('noFTConflict', 'noFTConflict');
    auditBoolean('bollingerSqueeze', 'bollingerSqueeze');

    // STRING CONDITIONS
    auditString('regime', 'regime');
    auditString('maTrend', 'maTrend');
    auditString('macdTrend', 'macdTrend');
    auditString('macdMomentum', 'macdMomentum');
    auditString('volumeTrend', 'volumeTrend');
    auditString('rsiDivergence', 'rsiDivergence');
    auditString('weeklyTrend', 'weeklyTrend');
    auditString('primaryPattern', 'primaryPattern');

    // NUMERIC CONDITIONS — bucketed
    auditNumeric('alignmentScore', 'alignmentScore', [
        { name: '0-40',   min: 0,   max: 40 },
        { name: '40-60',  min: 40,  max: 60 },
        { name: '60-80',  min: 60,  max: 80 },
        { name: '80-100', min: 80,  max: 101 },
    ]);
    auditNumeric('volumeRatio', 'volumeRatio', [
        { name: '<1.0',   min: 0,    max: 1.0 },
        { name: '1.0-1.5', min: 1.0, max: 1.5 },
        { name: '1.5-2.0', min: 1.5, max: 2.0 },
        { name: '2.0+',   min: 2.0,  max: 99 },
    ]);
    auditNumeric('rsiValue', 'rsiValue', [
        { name: '<30',    min: 0,   max: 30 },
        { name: '30-40',  min: 30,  max: 40 },
        { name: '40-50',  min: 40,  max: 50 },
        { name: '50-60',  min: 50,  max: 60 },
        { name: '60-70',  min: 60,  max: 70 },
        { name: '70+',    min: 70,  max: 101 },
    ]);
    auditNumeric('adxValue', 'adxValue', [
        { name: '<15',   min: 0,  max: 15 },
        { name: '15-20', min: 15, max: 20 },
        { name: '20-25', min: 20, max: 25 },
        { name: '25-30', min: 25, max: 30 },
        { name: '30+',   min: 30, max: 999 },
    ]);
    auditNumeric('smcConfluenceCount', 'smcConfluenceCount', [
        { name: '0', min: 0, max: 1 },
        { name: '1', min: 1, max: 2 },
        { name: '2', min: 2, max: 3 },
        { name: '3', min: 3, max: 99 },
    ]);
    auditNumeric('patternWeight', 'patternWeight', [
        { name: '0',      min: 0,    max: 0.001 },
        { name: '0-0.5',  min: 0.001, max: 0.5 },
        { name: '0.5-0.7', min: 0.5,  max: 0.7 },
        { name: '0.7+',   min: 0.7,  max: 99 },
    ]);

    // Sort by absolute edge — biggest signals (good or bad) first
    rows.sort((a, b) => Math.abs(b.edge) - Math.abs(a.edge));

    // Log baseline + top 30 edges via pino so they appear in your terminal
    logger.info({
        baselineWinRate: Number(baselineWinRate.toFixed(2)),
        totalSignals: signals.length,
        rowsCounted: rows.length,
    }, '[Backtest] Edge audit baseline');

    const topRows = rows.slice(0, 40);
    for (const r of topRows) {
        logger.info({
            condition: r.condition,
            bucket: r.bucket,
            n: r.n,
            winRate: r.winRate,
            edge: r.edge,
            avgPnl: r.avgPnl,
        }, '[Edge]');
    }
}

/** Generate list of weekday date strings between start and end */
function getTradingDays(startDate: string, endDate: string): string[] {
    const days: string[] = [];
    const current = new Date(startDate);
    const end = new Date(endDate);

    while (current <= end) {
        const dow = current.getDay();
        if (dow !== 0 && dow !== 6) { // Skip weekends
            days.push(current.toISOString().split('T')[0]);
        }
        current.setDate(current.getDate() + 1);
    }

    return days;
}

/** Throttle Yahoo API calls — wait between stocks to avoid rate limits */
function delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// ═══════════════════════════════════════════════════════════════
// MAIN ENGINE
// ═══════════════════════════════════════════════════════════════

/**
 * Run walk-forward backtest across symbols and trading days.
 * @param config Backtest configuration
 * @param onProgress Optional callback for progress updates
 */
export async function runWalkForwardBacktest(
    config: BacktestConfig,
    onProgress?: (progress: BacktestProgress) => void,
): Promise<BacktestSignal[]> {
    const signals: BacktestSignal[] = [];
    const tradingDays = getTradingDays(config.startDate, config.endDate);
    let errors = 0;

    // Diagnostic counters — tells us where signals are being filtered out
    const diag = {
        analysisRan: 0,
        nullAnalysis: 0,
        notBuyOrSell: 0,
        belowConfidence: 0,
        blockedByGrade: 0,
        noFutureData: 0,
        limitNeverFilled: 0,
        cooldownSkipped: 0,
        edgeGateFailed: 0,
        blockGateRejected: 0,
        marketRegimeBearish: 0,
        tradesExecuted: 0,
    };

    // Sub-counters for nullAnalysis — find out which null path is the killer
    const nullReasons: NullReasonCounters = {
        insufficientData: 0,
        holdRecommendation: 0,
        fallbackBadRR: 0,
        invalidPrices: 0,
        badPriceMath: 0,
    };

    const strategy: BacktestStrategy = config.strategy ?? 'legacy';

    logger.info({
        strategy,
        symbols: config.symbols.length,
        days: tradingDays.length,
        totalIterations: config.symbols.length * tradingDays.length,
        startDate: config.startDate,
        endDate: config.endDate,
    }, '[Backtest] Starting walk-forward simulation');

    // ─────────────────────────────────────────────────────────────
    // PRE-FETCH ALL HISTORIES (needed up-front for momentum strategy
    // because the universe ranking has to be built across all symbols
    // before any per-day decision can be made)
    // ─────────────────────────────────────────────────────────────
    const dailyHistories = new Map<string, OHLCData[]>();
    const weeklyHistories = new Map<string, OHLCData[]>();

    for (let si = 0; si < config.symbols.length; si++) {
        const symbol = config.symbols[si];
        try {
            const fullDaily = await fetchHistory(symbol, '5y', '1d');
            const fullWeekly = await fetchHistory(symbol, '5y', '1wk');
            if (fullDaily && fullDaily.length >= 150) {
                dailyHistories.set(symbol, fullDaily);
                if (fullWeekly) weeklyHistories.set(symbol, fullWeekly);
            } else {
                logger.warn({ symbol, bars: fullDaily?.length }, '[Backtest] Skipping — insufficient data');
            }
        } catch (err) {
            logger.error({ err, symbol }, '[Backtest] Failed to fetch history');
            errors++;
        }
        if (si < config.symbols.length - 1) {
            await delay(500);
        }
    }

    logger.info({
        fetched: dailyHistories.size,
        requested: config.symbols.length,
    }, '[Backtest] History pre-fetch complete');

    // Build universe ranking ONCE if running the momentum strategy
    let momentumUniverse: MomentumUniverseRanking | null = null;
    // Market regime gate: per-date flag, true = NIFTY above its 200-day SMA
    // If false, momentum signals are blocked entirely for that day.
    const marketRegimeOk = new Map<string, boolean>();
    if (strategy === 'momentum') {
        momentumUniverse = buildMomentumUniverse(dailyHistories, tradingDays);
        const sampleDays = tradingDays.slice(0, 3).map(d => ({
            date: d,
            topCount: momentumUniverse?.get(d)?.size ?? 0,
        }));
        logger.info({ sampleDays }, '[Backtest] Momentum universe built');

        // Fetch NIFTY 50 index history and pre-compute the regime flag per simDate
        try {
            const niftyHistory = await fetchHistory('^NSEI', '5y', '1d');
            if (niftyHistory && niftyHistory.length >= 200) {
                let okCount = 0;
                for (const simDate of tradingDays) {
                    // Find NIFTY bars up to and including simDate (no lookahead)
                    let idx = -1;
                    for (let i = niftyHistory.length - 1; i >= 0; i--) {
                        if (niftyHistory[i].date <= simDate) { idx = i; break; }
                    }
                    if (idx < 199) {
                        marketRegimeOk.set(simDate, false);
                        continue;
                    }
                    // 200-day SMA of closes ending at idx
                    let sum = 0;
                    for (let i = idx - 199; i <= idx; i++) sum += niftyHistory[i].close;
                    const sma200 = sum / 200;
                    const ok = niftyHistory[idx].close > sma200;
                    marketRegimeOk.set(simDate, ok);
                    if (ok) okCount++;
                }
                logger.info({
                    totalDays: tradingDays.length,
                    bullishDays: okCount,
                    bearishDays: tradingDays.length - okCount,
                }, '[Backtest] NIFTY regime gate built');
            } else {
                logger.warn('[Backtest] NIFTY history insufficient — regime gate disabled');
                // Fail open: allow all days if we can't fetch the index
                for (const simDate of tradingDays) marketRegimeOk.set(simDate, true);
            }
        } catch (err) {
            logger.error({ err }, '[Backtest] NIFTY regime fetch failed — gate disabled');
            for (const simDate of tradingDays) marketRegimeOk.set(simDate, true);
        }
    }

    // ─────────────────────────────────────────────────────────────
    // PER-SYMBOL SIMULATION LOOP
    // ─────────────────────────────────────────────────────────────
    let symbolIdx = 0;
    for (const [symbol, fullDaily] of dailyHistories) {
        symbolIdx++;
        const fullWeekly = weeklyHistories.get(symbol) ?? [];

        // Report progress
        if (onProgress) {
            onProgress({
                totalSymbols: config.symbols.length,
                completedSymbols: symbolIdx,
                currentSymbol: symbol,
                totalSignals: signals.length,
                errors,
            });
        }

        try {
            // Track last signal date to avoid duplicate signals on consecutive days
            let lastSignalDate = '';

            for (const simDate of tradingDays) {
                // Skip if we already signaled this stock within last 7 days
                if (lastSignalDate) {
                    const daysSinceLastSignal = Math.round(
                        (new Date(simDate).getTime() - new Date(lastSignalDate).getTime()) / (1000 * 60 * 60 * 24)
                    );
                    if (daysSinceLastSignal < config.signalExpiry) {
                        diag.cooldownSkipped++;
                        continue;
                    }
                }

                // CRITICAL: Only use data UP TO simDate (no future leak)
                const dailyData = fullDaily.filter(bar => bar.date <= simDate);
                const weeklyData = fullWeekly.filter(bar => bar.date <= simDate);

                if (dailyData.length < 100) continue;

                // ── MARKET REGIME GATE (momentum only) ──
                // Only take momentum trades when NIFTY itself is above its 200-SMA.
                // This is the single most important filter for trend-following systems —
                // it keeps you in cash during bear markets where breakouts fail.
                if (strategy === 'momentum' && marketRegimeOk.get(simDate) === false) {
                    diag.marketRegimeBearish++;
                    continue;
                }

                try {
                    // Run analysis on truncated data
                    diag.analysisRan++;
                    const analysis = strategy === 'momentum'
                        ? runMomentumStrategy(symbol, simDate, dailyData, momentumUniverse!)
                        : runAnalysisOnHistoricalData(symbol, dailyData, weeklyData, nullReasons);

                    if (!analysis) { diag.nullAnalysis++; continue; }
                    if (analysis.recommendation !== 'BUY' && analysis.recommendation !== 'SELL') {
                        diag.notBuyOrSell++;
                        continue;
                    }
                    if (analysis.confidence < config.minConfidence) {
                        diag.belowConfidence++;
                        continue;
                    }

                    // ── LEGACY-STRATEGY-ONLY GATES ──
                    // The grading filter, edge gate, and block gate were derived
                    // from the legacy SMC-based pipeline. They are meaningless for
                    // the momentum strategy (which doesn't use those conditions).
                    if (strategy === 'legacy') {
                        if (analysis.conditions) {
                            const grade = gradeSignal(analysis.conditions, analysis.confidence);
                            if (isBlockedGrade(grade.grade)) {
                                diag.blockedByGrade++;
                                continue;
                            }
                        }

                        // Edge gate: require ALL 3 of volumeHigh + volumeIncreasing + emaCrossover
                        const c = analysis.conditions;
                        if (!(c.volumeHigh && c.volumeIncreasing && c.emaCrossover)) {
                            diag.edgeGateFailed++;
                            continue;
                        }

                        // Block gate: reject rsiInZone + hasOrderBlock combo
                        if (analysis.conditions.rsiInZone && analysis.conditions.hasOrderBlock) {
                            diag.blockGateRejected++;
                            continue;
                        }
                    }

                    // Get FUTURE bars for outcome checking (NOT available to analysis)
                    const futureData = fullDaily
                        .filter(bar => bar.date > simDate)
                        .slice(0, config.signalExpiry);

                    if (futureData.length === 0) {
                        diag.noFutureData++;
                        continue;
                    }

                    const direction = analysis.recommendation; // narrowed to 'BUY' | 'SELL'

                    // ── LIMIT FILL CHECK ──
                    // The analysis sets entryPrice to a pullback level (zone mid).
                    // In real trading this is a LIMIT order — it only becomes a trade
                    // when price actually trades through that level. Find the first
                    // future bar where the limit fills, and start the outcome check
                    // from THERE. If price never reaches the limit within the signal
                    // expiry window, this signal would never have become a trade — skip it.
                    let fillBarIndex = -1;
                    for (let i = 0; i < futureData.length; i++) {
                        const bar = futureData[i];
                        if (bar.low <= analysis.entryPrice && bar.high >= analysis.entryPrice) {
                            fillBarIndex = i;
                            break;
                        }
                    }
                    if (fillBarIndex === -1) {
                        diag.limitNeverFilled++;
                        continue; // Limit never filled — no trade
                    }

                    // Slice future bars from the fill bar onward (inclusive)
                    const tradeCandles = futureData.slice(fillBarIndex);
                    if (tradeCandles.length === 0) continue;
                    diag.tradesExecuted++;

                    // Check outcome
                    const outcome = checkOutcome({
                        direction,
                        entryPrice: analysis.entryPrice,
                        targetPrice: analysis.targetPrice,
                        stopLoss: analysis.stopLoss,
                        futureCandles: tradeCandles,
                        partialTargetR: config.partialTargetR,
                        fullTargetR: config.fullTargetR,
                    });

                    signals.push({
                        date: simDate,
                        symbol,
                        direction,
                        confidence: analysis.confidence,
                        regime: analysis.regime,
                        entryPrice: analysis.entryPrice,
                        targetPrice: analysis.targetPrice,
                        stopLoss: analysis.stopLoss,
                        riskReward: analysis.riskReward,
                        conditions: analysis.conditions,
                        ...outcome,
                    });

                    lastSignalDate = simDate;
                } catch (err) {
                    // Skip errors per day (data gaps, indicator edge cases)
                    errors++;
                    continue;
                }
            }

            const stockSignals = signals.filter(s => s.symbol === symbol).length;
            if (stockSignals > 0) {
                logger.info({ symbol, signals: stockSignals }, '[Backtest] Stock complete');
            }
        } catch (err) {
            logger.error({ err, symbol }, '[Backtest] Failed to process stock');
            errors++;
        }

    }

    logger.info({
        totalSignals: signals.length,
        errors,
        symbols: config.symbols.length,
    }, '[Backtest] Walk-forward simulation complete');

    // ── BUY vs SELL DIRECTIONAL SPLIT ──
    // If one side wins much more than the other, direction logic is inverted on
    // the losing side. If both sides win roughly the same and are below random
    // (~35-40%), the issue is stop/target sizing, not direction.
    const isWinner = (s: BacktestSignal) =>
        s.outcome === 'TARGET_HIT' ||
        (s.outcome === 'PARTIAL_PROFIT' && s.pnlPercent > 0);

    const buySignals = signals.filter(s => s.direction === 'BUY');
    const sellSignals = signals.filter(s => s.direction === 'SELL');
    const buyWins = buySignals.filter(isWinner).length;
    const sellWins = sellSignals.filter(isWinner).length;
    const buyAvgPnl = buySignals.length > 0
        ? buySignals.reduce((a, s) => a + (s.pnlPercent ?? 0), 0) / buySignals.length
        : 0;
    const sellAvgPnl = sellSignals.length > 0
        ? sellSignals.reduce((a, s) => a + (s.pnlPercent ?? 0), 0) / sellSignals.length
        : 0;

    logger.info({
        buyCount: buySignals.length,
        buyWins,
        buyWinRate: buySignals.length > 0
            ? Number(((buyWins / buySignals.length) * 100).toFixed(2))
            : 0,
        buyAvgPnlPercent: Number(buyAvgPnl.toFixed(2)),
        sellCount: sellSignals.length,
        sellWins,
        sellWinRate: sellSignals.length > 0
            ? Number(((sellWins / sellSignals.length) * 100).toFixed(2))
            : 0,
        sellAvgPnlPercent: Number(sellAvgPnl.toFixed(2)),
    }, '[Backtest] Direction split');

    // ── PER-CONDITION EDGE AUDIT ──
    // For each input condition, compute win rate when TRUE vs FALSE.
    // Edge = winRate(true) - winRate(false). Anything with |edge| < 3 is noise.
    // Anything with |edge| > 8 is real signal — keep it. Negative edge means
    // the condition predicts LOSS, so the scorer is using it backwards.
    runConditionEdgeAudit(signals, isWinner);

    // ── DIAGNOSTIC FUNNEL ──
    // Tells us where signals are dying. If almost everything is filtered by
    // limitNeverFilled, the entry zones are too far from current price.
    // If blockedByGrade dominates, the grading filter is too strict, etc.
    logger.info({
        analysisRan: diag.analysisRan,
        nullAnalysis: diag.nullAnalysis,
        nullReason_insufficientData: nullReasons.insufficientData,
        nullReason_holdRecommendation: nullReasons.holdRecommendation,
        nullReason_fallbackBadRR: nullReasons.fallbackBadRR,
        nullReason_invalidPrices: nullReasons.invalidPrices,
        nullReason_badPriceMath: nullReasons.badPriceMath,
        notBuyOrSell: diag.notBuyOrSell,
        belowConfidence: diag.belowConfidence,
        blockedByGrade: diag.blockedByGrade,
        edgeGateFailed: diag.edgeGateFailed,
        blockGateRejected: diag.blockGateRejected,
        marketRegimeBearish: diag.marketRegimeBearish,
        noFutureData: diag.noFutureData,
        limitNeverFilled: diag.limitNeverFilled,
        cooldownSkipped: diag.cooldownSkipped,
        tradesExecuted: diag.tradesExecuted,
    }, '[Backtest] Filter funnel');

    // Also log to console so it shows up plainly in the terminal
    console.log('[Backtest] Filter funnel:');
    console.log(`  analysisRan      : ${diag.analysisRan}`);
    console.log(`  nullAnalysis     : ${diag.nullAnalysis}`);
    console.log(`    └ insufficientData   : ${nullReasons.insufficientData}`);
    console.log(`    └ holdRecommendation : ${nullReasons.holdRecommendation}`);
    console.log(`    └ fallbackBadRR      : ${nullReasons.fallbackBadRR}`);
    console.log(`    └ invalidPrices      : ${nullReasons.invalidPrices}`);
    console.log(`    └ badPriceMath       : ${nullReasons.badPriceMath}`);
    console.log(`  notBuyOrSell     : ${diag.notBuyOrSell}`);
    console.log(`  belowConfidence  : ${diag.belowConfidence}`);
    console.log(`  blockedByGrade   : ${diag.blockedByGrade}`);
    console.log(`  noFutureData     : ${diag.noFutureData}`);
    console.log(`  limitNeverFilled : ${diag.limitNeverFilled}`);
    console.log(`  cooldownSkipped  : ${diag.cooldownSkipped}`);
    console.log(`  tradesExecuted   : ${diag.tradesExecuted}`);

    return signals;
}
