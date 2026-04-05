/**
 * Outcome Checker — determines what happened after a signal fired
 * Checks 7 future bars for: partial profit (1.5R), full target (2.5R), stop loss, expiry
 * Pure function — no DB, no side effects
 * @module @stock-assist/api/services/backtest/outcomeChecker
 */

import type { OHLCData } from '@stock-assist/shared';

export interface OutcomeCheckInput {
    direction: 'BUY' | 'SELL';
    entryPrice: number;
    targetPrice: number;
    stopLoss: number;
    futureCandles: OHLCData[];
    partialTargetR: number;  // 1.5
    fullTargetR: number;     // 2.5
}

export interface OutcomeResult {
    outcome: 'TARGET_HIT' | 'STOP_HIT' | 'PARTIAL_PROFIT' | 'EXPIRED';
    exitPrice: number;
    pnlPercent: number;
    daysToOutcome: number;
    mfe: number;
    mae: number;
    exitReason: string;
}

/**
 * Check what actually happened in the 7 bars after a signal fired.
 * Implements the partial profit exit system (50% at 1.5R, trail remaining).
 */
export function checkOutcome(input: OutcomeCheckInput): OutcomeResult {
    const { direction, entryPrice, stopLoss, futureCandles } = input;

    if (futureCandles.length === 0) {
        return {
            outcome: 'EXPIRED',
            exitPrice: entryPrice,
            pnlPercent: 0,
            daysToOutcome: 0,
            mfe: 0,
            mae: 0,
            exitReason: 'no_future_data',
        };
    }

    const risk = Math.abs(entryPrice - stopLoss);
    const partialTarget = direction === 'BUY'
        ? entryPrice + risk * input.partialTargetR
        : entryPrice - risk * input.partialTargetR;
    const fullTarget = direction === 'BUY'
        ? entryPrice + risk * input.fullTargetR
        : entryPrice - risk * input.fullTargetR;

    let mfe = 0;
    let mae = 0;
    let partialFilled = false;
    let trailingStop = stopLoss;

    for (let i = 0; i < futureCandles.length; i++) {
        const bar = futureCandles[i];
        const day = i + 1;

        // Track MFE/MAE
        if (direction === 'BUY') {
            mfe = Math.max(mfe, ((bar.high - entryPrice) / entryPrice) * 100);
            mae = Math.max(mae, ((entryPrice - bar.low) / entryPrice) * 100);
        } else {
            mfe = Math.max(mfe, ((entryPrice - bar.low) / entryPrice) * 100);
            mae = Math.max(mae, ((bar.high - entryPrice) / entryPrice) * 100);
        }

        // ── STOP LOSS CHECK (priority — check first on same bar) ──
        const activeStop = partialFilled ? trailingStop : stopLoss;

        if (direction === 'BUY' && bar.low <= activeStop) {
            const exitPrice = activeStop;
            if (partialFilled) {
                const partialPnl = ((partialTarget - entryPrice) / entryPrice) * 100;
                const remainPnl = ((exitPrice - entryPrice) / entryPrice) * 100;
                return {
                    outcome: 'PARTIAL_PROFIT',
                    exitPrice,
                    pnlPercent: Number(((partialPnl * 0.5) + (remainPnl * 0.5)).toFixed(2)),
                    daysToOutcome: day,
                    mfe: Number(mfe.toFixed(2)),
                    mae: Number(mae.toFixed(2)),
                    exitReason: 'stop_trailing',
                };
            }
            return {
                outcome: 'STOP_HIT',
                exitPrice: stopLoss,
                pnlPercent: Number((((stopLoss - entryPrice) / entryPrice) * 100).toFixed(2)),
                daysToOutcome: day,
                mfe: Number(mfe.toFixed(2)),
                mae: Number(mae.toFixed(2)),
                exitReason: 'stop_initial',
            };
        }

        if (direction === 'SELL' && bar.high >= activeStop) {
            const exitPrice = activeStop;
            if (partialFilled) {
                const partialPnl = ((entryPrice - partialTarget) / entryPrice) * 100;
                const remainPnl = ((entryPrice - exitPrice) / entryPrice) * 100;
                return {
                    outcome: 'PARTIAL_PROFIT',
                    exitPrice,
                    pnlPercent: Number(((partialPnl * 0.5) + (remainPnl * 0.5)).toFixed(2)),
                    daysToOutcome: day,
                    mfe: Number(mfe.toFixed(2)),
                    mae: Number(mae.toFixed(2)),
                    exitReason: 'stop_trailing',
                };
            }
            return {
                outcome: 'STOP_HIT',
                exitPrice: stopLoss,
                pnlPercent: Number((((entryPrice - stopLoss) / entryPrice) * 100).toFixed(2)),
                daysToOutcome: day,
                mfe: Number(mfe.toFixed(2)),
                mae: Number(mae.toFixed(2)),
                exitReason: 'stop_initial',
            };
        }

        // ── PARTIAL PROFIT CHECK (1.5R) ──
        if (!partialFilled) {
            if (direction === 'BUY' && bar.high >= partialTarget) {
                partialFilled = true;
                const recentLows = futureCandles.slice(Math.max(0, i - 1), i + 1).map(b => b.low);
                trailingStop = Math.min(...recentLows);

                // Check if full target hit same bar
                if (bar.high >= fullTarget) {
                    const partialPnl = ((partialTarget - entryPrice) / entryPrice) * 100;
                    const fullPnl = ((fullTarget - entryPrice) / entryPrice) * 100;
                    return {
                        outcome: 'TARGET_HIT',
                        exitPrice: fullTarget,
                        pnlPercent: Number(((partialPnl * 0.5) + (fullPnl * 0.5)).toFixed(2)),
                        daysToOutcome: day,
                        mfe: Number(mfe.toFixed(2)),
                        mae: Number(mae.toFixed(2)),
                        exitReason: 'target_full',
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
                        pnlPercent: Number(((partialPnl * 0.5) + (fullPnl * 0.5)).toFixed(2)),
                        daysToOutcome: day,
                        mfe: Number(mfe.toFixed(2)),
                        mae: Number(mae.toFixed(2)),
                        exitReason: 'target_full',
                    };
                }
                continue;
            }
        }

        // ── UPDATE TRAILING STOP (only moves in favorable direction) ──
        if (partialFilled && i >= 1) {
            if (direction === 'BUY') {
                const newTrail = Math.min(futureCandles[i - 1].low, bar.low);
                trailingStop = Math.max(trailingStop, newTrail); // Only moves UP
            } else {
                const newTrail = Math.max(futureCandles[i - 1].high, bar.high);
                trailingStop = Math.min(trailingStop, newTrail); // Only moves DOWN
            }
        }

        // ── FULL TARGET CHECK (2.5R) after partial ──
        if (partialFilled) {
            if (direction === 'BUY' && bar.high >= fullTarget) {
                const partialPnl = ((partialTarget - entryPrice) / entryPrice) * 100;
                const fullPnl = ((fullTarget - entryPrice) / entryPrice) * 100;
                return {
                    outcome: 'TARGET_HIT',
                    exitPrice: fullTarget,
                    pnlPercent: Number(((partialPnl * 0.5) + (fullPnl * 0.5)).toFixed(2)),
                    daysToOutcome: day,
                    mfe: Number(mfe.toFixed(2)),
                    mae: Number(mae.toFixed(2)),
                    exitReason: 'target_full',
                };
            }
            if (direction === 'SELL' && bar.low <= fullTarget) {
                const partialPnl = ((entryPrice - partialTarget) / entryPrice) * 100;
                const fullPnl = ((entryPrice - fullTarget) / entryPrice) * 100;
                return {
                    outcome: 'TARGET_HIT',
                    exitPrice: fullTarget,
                    pnlPercent: Number(((partialPnl * 0.5) + (fullPnl * 0.5)).toFixed(2)),
                    daysToOutcome: day,
                    mfe: Number(mfe.toFixed(2)),
                    mae: Number(mae.toFixed(2)),
                    exitReason: 'target_full',
                };
            }
        }
    }

    // ── EXPIRED (Day 7 reached) ──
    const lastBar = futureCandles[futureCandles.length - 1];
    const exitPrice = lastBar.close;

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
            pnlPercent: Number(((partialPnl * 0.5) + (remainPnl * 0.5)).toFixed(2)),
            daysToOutcome: futureCandles.length,
            mfe: Number(mfe.toFixed(2)),
            mae: Number(mae.toFixed(2)),
            exitReason: 'time_expiry_partial',
        };
    }

    return {
        outcome: 'EXPIRED',
        exitPrice,
        pnlPercent: Number((direction === 'BUY'
            ? ((exitPrice - entryPrice) / entryPrice) * 100
            : ((entryPrice - exitPrice) / entryPrice) * 100
        ).toFixed(2)),
        daysToOutcome: futureCandles.length,
        mfe: Number(mfe.toFixed(2)),
        mae: Number(mae.toFixed(2)),
        exitReason: 'time_expiry',
    };
}
