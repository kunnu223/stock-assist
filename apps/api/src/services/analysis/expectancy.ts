/**
 * Expectancy Filter Service — Phase B #4
 * 
 * Expectancy is the PRIMARY filter for trade acceptance.
 * Rejects signals where Expectancy ≤ 0, even if win rate is high.
 * 
 * Formula: Expectancy = (WinRate × AvgWin) - (LossRate × AvgLoss)
 * 
 * This is stored PER CONDITION HASH, not globally — because
 * AvgWin/AvgLoss vary massively across regimes.
 * 
 * Example:
 * | Win Rate | Avg Win | Avg Loss | Expectancy | Action   |
 * |:--------:|:-------:|:--------:|:----------:|:--------:|
 * | 65%      | +2.1%   | -3.8%    | +0.04%     | ✅ Accept |
 * | 62%      | +1.2%   | -2.5%    | -0.20%     | ❌ Reject |
 * 
 * @module @stock-assist/api/services/analysis/expectancy
 */

import type { EmpiricalProbability } from '../backtest/signalTracker';

// ═══════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════

export interface ExpectancyResult {
    /** Whether this trade should be accepted based on expectancy */
    accepted: boolean;

    /** The expectancy value (positive = profitable, negative = losing) */
    expectancy: number;

    /** Win rate used in calculation (0-100) */
    winRate: number;

    /** Average win PnL% */
    avgWinPnl: number;

    /** Average loss PnL% */
    avgLossPnl: number;

    /** Risk/reward ratio from empirical data */
    riskRewardRatio: number;

    /** Whether the empirical data was reliable enough to filter on */
    dataReliable: boolean;

    /** Reason for acceptance/rejection */
    reason: string;

    /** Detailed breakdown for logging */
    details: string;
}

// ═══════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════

/** Only ENFORCE expectancy filter when data is reliable (50+ samples) */
const ENFORCE_ON_RELIABLE_ONLY = true;

/** Minimum expectancy to accept a trade (per tick, in %) */
const MIN_EXPECTANCY = 0;

/** Minimum acceptable risk/reward ratio */
const MIN_RISK_REWARD = 0.8;

// ═══════════════════════════════════════════════════════════════
// CORE FUNCTION
// ═══════════════════════════════════════════════════════════════

/**
 * Evaluate whether a trade should be accepted based on expectancy.
 * This is THE primary filter — a signal with 63% win rate but negative
 * expectancy is WORSE than a 55% win rate signal with positive expectancy.
 * 
 * @param empirical - Result from getEmpiricalProbability()
 * @returns ExpectancyResult with accept/reject decision
 */
export function evaluateExpectancy(empirical: EmpiricalProbability): ExpectancyResult {
    // Case 1: No empirical data available yet
    if (!empirical.available || empirical.sampleSize === 0) {
        return {
            accepted: true,  // Allow trades through (no data to reject on)
            expectancy: 0,
            winRate: 0,
            avgWinPnl: 0,
            avgLossPnl: 0,
            riskRewardRatio: 0,
            dataReliable: false,
            reason: 'No empirical data — trade allowed (accumulating samples)',
            details: `Condition: ${empirical.conditionLabel} | Samples: 0 | Status: Accumulating`,
        };
    }

    const { winRate, avgWinPnl, avgLossPnl, expectancy, sampleSize, reliable, conditionLabel } = empirical;

    // Calculate risk/reward ratio
    const riskRewardRatio = avgLossPnl > 0 ? avgWinPnl / avgLossPnl : avgWinPnl > 0 ? Infinity : 0;

    // Case 2: Data exists but not enough for enforcement
    if (!reliable && ENFORCE_ON_RELIABLE_ONLY) {
        const isWarning = expectancy <= MIN_EXPECTANCY;
        return {
            accepted: true,  // Allow but warn
            expectancy,
            winRate,
            avgWinPnl,
            avgLossPnl,
            riskRewardRatio: Number(riskRewardRatio.toFixed(2)),
            dataReliable: false,
            reason: isWarning
                ? `⚠️ Low-sample warning: expectancy ${expectancy.toFixed(3)}% from ${sampleSize} samples (need 50+ for enforcement)`
                : `Preliminary data positive: expectancy ${expectancy.toFixed(3)}% from ${sampleSize} samples`,
            details: `Condition: ${conditionLabel} | WR: ${winRate}% | AvgWin: ${avgWinPnl}% | AvgLoss: -${avgLossPnl}% | E: ${expectancy.toFixed(3)}% | Samples: ${sampleSize} | Enforced: NO`,
        };
    }

    // Case 3: Reliable data — ENFORCE expectancy filter
    const isPositiveExpectancy = expectancy > MIN_EXPECTANCY;
    const isAcceptableRR = riskRewardRatio >= MIN_RISK_REWARD;

    if (!isPositiveExpectancy) {
        return {
            accepted: false,
            expectancy,
            winRate,
            avgWinPnl,
            avgLossPnl,
            riskRewardRatio: Number(riskRewardRatio.toFixed(2)),
            dataReliable: true,
            reason: `❌ REJECTED: Negative expectancy ${expectancy.toFixed(3)}% (${sampleSize} samples). Win rate ${winRate}% is misleading — avg loss (${avgLossPnl}%) exceeds scaled avg win.`,
            details: `Condition: ${conditionLabel} | WR: ${winRate}% | AvgWin: ${avgWinPnl}% | AvgLoss: -${avgLossPnl}% | E: ${expectancy.toFixed(3)}% | R:R: ${riskRewardRatio.toFixed(2)} | Samples: ${sampleSize} | REJECTED`,
        };
    }

    if (!isAcceptableRR) {
        return {
            accepted: false,
            expectancy,
            winRate,
            avgWinPnl,
            avgLossPnl,
            riskRewardRatio: Number(riskRewardRatio.toFixed(2)),
            dataReliable: true,
            reason: `❌ REJECTED: Risk/reward ratio ${riskRewardRatio.toFixed(2)} below ${MIN_RISK_REWARD} minimum. Positive expectancy ${expectancy.toFixed(3)}% is fragile.`,
            details: `Condition: ${conditionLabel} | WR: ${winRate}% | AvgWin: ${avgWinPnl}% | AvgLoss: -${avgLossPnl}% | E: ${expectancy.toFixed(3)}% | R:R: ${riskRewardRatio.toFixed(2)} | Samples: ${sampleSize} | REJECTED (R:R)`,
        };
    }

    // Case 4: Accepted — positive expectancy with acceptable risk/reward
    return {
        accepted: true,
        expectancy,
        winRate,
        avgWinPnl,
        avgLossPnl,
        riskRewardRatio: Number(riskRewardRatio.toFixed(2)),
        dataReliable: true,
        reason: `✅ ACCEPTED: Expectancy ${expectancy.toFixed(3)}% | WR: ${winRate}% | R:R: ${riskRewardRatio.toFixed(2)} (${sampleSize} samples)`,
        details: `Condition: ${conditionLabel} | WR: ${winRate}% | AvgWin: ${avgWinPnl}% | AvgLoss: -${avgLossPnl}% | E: ${expectancy.toFixed(3)}% | R:R: ${riskRewardRatio.toFixed(2)} | Samples: ${sampleSize} | ACCEPTED`,
    };
}

/**
 * Quick check: is expectancy positive for a given set of empirical data?
 * Utility function for inline checks without full object creation.
 */
export function hasPositiveExpectancy(empirical: EmpiricalProbability): boolean {
    if (!empirical.available || !empirical.reliable) return true; // Allow through if no data
    return empirical.expectancy > MIN_EXPECTANCY;
}
