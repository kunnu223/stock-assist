/**
 * Walk-Forward Engine — day-by-day historical simulation
 * Fetches data once per stock, truncates per day, runs analysis + outcome check
 * @module @stock-assist/api/services/backtest/walkForwardEngine
 */

import type { OHLCData } from '@stock-assist/shared';
import { fetchHistory } from '../data/yahooHistory';
import { runAnalysisOnHistoricalData, type BacktestConditions } from './historicalBacktester';
import { checkOutcome } from './outcomeChecker';
import { gradeSignal, isBlockedGrade } from '../analysis/signalGrading';
import { logger } from '../../config/logger';

// ═══════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════

export interface BacktestConfig {
    startDate: string;       // '2025-04-01'
    endDate: string;         // '2026-03-31'
    symbols: string[];
    minConfidence: number;   // 65
    signalExpiry: number;    // 7
    partialTargetR: number;  // 1.5
    fullTargetR: number;     // 2.5
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

    logger.info({
        symbols: config.symbols.length,
        days: tradingDays.length,
        totalIterations: config.symbols.length * tradingDays.length,
        startDate: config.startDate,
        endDate: config.endDate,
    }, '[Backtest] Starting walk-forward simulation');

    for (let si = 0; si < config.symbols.length; si++) {
        const symbol = config.symbols[si];

        // Report progress
        if (onProgress) {
            onProgress({
                totalSymbols: config.symbols.length,
                completedSymbols: si,
                currentSymbol: symbol,
                totalSignals: signals.length,
                errors,
            });
        }

        try {
            // Fetch FULL history once per stock
            const fullDaily = await fetchHistory(symbol, '2y', '1d');
            const fullWeekly = await fetchHistory(symbol, '2y', '1wk');

            if (!fullDaily || fullDaily.length < 150) {
                logger.warn({ symbol, bars: fullDaily?.length }, '[Backtest] Skipping — insufficient data');
                continue;
            }

            // Track last signal date to avoid duplicate signals on consecutive days
            let lastSignalDate = '';

            for (const simDate of tradingDays) {
                // Skip if we already signaled this stock within last 7 days
                if (lastSignalDate) {
                    const daysSinceLastSignal = Math.round(
                        (new Date(simDate).getTime() - new Date(lastSignalDate).getTime()) / (1000 * 60 * 60 * 24)
                    );
                    if (daysSinceLastSignal < config.signalExpiry) continue;
                }

                // CRITICAL: Only use data UP TO simDate (no future leak)
                const dailyData = fullDaily.filter(bar => bar.date <= simDate);
                const weeklyData = fullWeekly.filter(bar => bar.date <= simDate);

                if (dailyData.length < 100) continue;

                try {
                    // Run analysis on truncated data
                    const analysis = runAnalysisOnHistoricalData(symbol, dailyData, weeklyData);

                    if (!analysis) continue;
                    if (analysis.recommendation !== 'BUY' && analysis.recommendation !== 'SELL') continue;
                    if (analysis.confidence < config.minConfidence) continue;

                    // Apply the same signal grading filter used in live analysis
                    // This ensures backtest reflects what users actually see
                    if (analysis.conditions) {
                        const grade = gradeSignal(analysis.conditions, analysis.confidence);
                        if (isBlockedGrade(grade.grade)) continue;
                    }

                    // Get FUTURE bars for outcome checking (NOT available to analysis)
                    const futureData = fullDaily
                        .filter(bar => bar.date > simDate)
                        .slice(0, config.signalExpiry);

                    if (futureData.length === 0) continue; // No future data to check

                    const direction = analysis.recommendation; // narrowed to 'BUY' | 'SELL'

                    // Check outcome
                    const outcome = checkOutcome({
                        direction,
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

        // Throttle Yahoo API to avoid rate limits (500ms between stocks)
        if (si < config.symbols.length - 1) {
            await delay(500);
        }
    }

    logger.info({
        totalSignals: signals.length,
        errors,
        symbols: config.symbols.length,
    }, '[Backtest] Walk-forward simulation complete');

    return signals;
}
