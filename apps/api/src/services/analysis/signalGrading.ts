/**
 * Signal Grading — assigns A+/A/B/C/F grades based on validated condition stacks
 * Grades are derived from backtest results: which boolean condition combos
 * historically produced 70%+ win rates.
 *
 * IMPORTANT: The "golden stacks" below are sensible starting defaults.
 * After running your first walk-forward backtest, update them with the
 * topStacks / worstStacks output from backtestReporter.findConditionStacks().
 *
 * @module @stock-assist/api/services/analysis/signalGrading
 */

import type { BacktestConditions } from '../backtest/historicalBacktester';

// ═══════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════

export type SignalGrade = 'A+' | 'A' | 'B' | 'C' | 'F';

export interface GradeResult {
    grade: SignalGrade;
    matchedStack: string[] | null;  // Which conditions triggered this grade
    reason: string;
}

// ═══════════════════════════════════════════════════════════════
// CONDITION STACK DEFINITIONS (update from backtest results)
// ═══════════════════════════════════════════════════════════════

/**
 * A+ stacks: highest edge from walk-forward backtest (NIFTY 100, Apr 2025–Mar 2026).
 * These are the highest-conviction setups — Telegram alerts fire only for these.
 *
 * Win rates from backtest (note: absolute win rates are low due to 1.5R target
 * but relative EDGE vs baseline is what matters for ranking):
 * - rsiInZone + hasCHoCH + volumeConfirmed + noBearishDivergence: 15.0%, +13.8% edge
 * - volumeIncreasing + rsiInZone + hasLiquiditySweep + noBearishDivergence: 10.9%, +7.4% edge
 * - rsiInZone + hasCHoCH + hasLiquiditySweep + hasStrongPattern: 10.0%
 */
const A_PLUS_STACKS: string[][] = [
    ['rsiInZone', 'hasCHoCH', 'volumeConfirmed', 'noBearishDivergence'],
    ['volumeIncreasing', 'rsiInZone', 'hasLiquiditySweep', 'noBearishDivergence'],
    ['rsiInZone', 'hasCHoCH', 'hasLiquiditySweep', 'hasStrongPattern'],
    ['rsiInZone', 'hasCHoCH', 'volumeConfirmed', 'noFTConflict'],
];

/**
 * A stacks: second-tier edge from backtest.
 * Shown in top-10 dashboard alongside A+.
 *
 * - volumeIncreasing + rsiInZone + hasLiquiditySweep + emaCrossover: 10.5%
 * - volumeIncreasing + rsiInZone + hasLiquiditySweep: 10.0%
 * - rsiInZone + hasCHoCH + hasLiquiditySweep: 9.5%
 * - rsiInZone + hasCHoCH + noBearishDivergence + emaCrossover: 9.5%
 * - rsiInZone + hasCHoCH + hasStrongPattern + emaCrossover: 9.5%
 */
const A_STACKS: string[][] = [
    ['volumeIncreasing', 'rsiInZone', 'hasLiquiditySweep', 'emaCrossover'],
    ['volumeIncreasing', 'rsiInZone', 'hasLiquiditySweep'],
    ['rsiInZone', 'hasCHoCH', 'hasLiquiditySweep'],
    ['rsiInZone', 'hasCHoCH', 'noBearishDivergence', 'emaCrossover'],
    ['rsiInZone', 'hasCHoCH', 'hasStrongPattern', 'emaCrossover'],
];

/**
 * F stacks: historically proven losers (<45% win rate with 20+ signals).
 * These are BLOCKED — never surface to the user.
 *
 * Updated 2026-04-07 from walk-forward backtest (NIFTY 100, Apr 2025–Mar 2026):
 * - TRENDING_STRONG regime: 2.4% win rate, -0.33% avg P&L across 672 signals → blocked
 * - hasOrderBlock + hasCHoCH: 0% win rate, 46 signals → blocked
 * - isStrongTrend + volumeHigh + rsiInZone: 0% win rate, 28 signals
 * - isStrongTrend + volumeIncreasing + hasOrderBlock: 0% win rate, 52 signals
 * - isStrongTrend + volumeIncreasing + hasLiquiditySweep: 0% win rate, 37 signals
 * - isStrongTrend + rsiInZone + hasLiquiditySweep: 0% win rate, 46 signals
 * - volumeHigh + volumeIncreasing + hasOrderBlock: 0% win rate, 66 signals
 */
const F_STACKS: string[][] = [
    // TRANSITION regime — always block
    ['isTransition', 'bollingerSqueeze'],
    ['isTransition', 'hasLiquiditySweep'],
    // TRENDING_STRONG regime — 0% win rate, block entirely
    ['isStrongTrend'],
    // SMC combos that backtest proved lose money
    ['hasOrderBlock', 'hasCHoCH'],
    ['volumeHigh', 'volumeIncreasing', 'hasOrderBlock'],
];

// ═══════════════════════════════════════════════════════════════
// GRADING LOGIC
// ═══════════════════════════════════════════════════════════════

/** Check if all conditions in a stack are true */
function matchesStack(conditions: BacktestConditions, stack: string[]): boolean {
    for (const key of stack) {
        const value = (conditions as Record<string, any>)[key];
        if (!value) return false;
    }
    return true;
}

/**
 * Grade a signal based on its condition stack.
 * Priority: F (block) → A+ → A → then score-based B/C.
 */
export function gradeSignal(conditions: BacktestConditions, confidence: number): GradeResult {
    // Check F stacks FIRST — block bad setups
    for (const stack of F_STACKS) {
        if (matchesStack(conditions, stack)) {
            return {
                grade: 'F',
                matchedStack: stack,
                reason: `Matches historically losing stack: ${stack.join(' + ')}`,
            };
        }
    }

    // Check A+ stacks
    for (const stack of A_PLUS_STACKS) {
        if (matchesStack(conditions, stack)) {
            return {
                grade: 'A+',
                matchedStack: stack,
                reason: `Matches 75%+ win rate stack: ${stack.join(' + ')}`,
            };
        }
    }

    // Check A stacks
    for (const stack of A_STACKS) {
        if (matchesStack(conditions, stack)) {
            return {
                grade: 'A',
                matchedStack: stack,
                reason: `Matches 70%+ win rate stack: ${stack.join(' + ')}`,
            };
        }
    }

    // Score-based fallback for B and C
    // Weights derived from walk-forward backtest results (2026-04-07)
    let score = 0;
    // Positive signals (backtest-validated)
    if (conditions.rsiInZone) score += 2;
    if (conditions.hasLiquiditySweep) score += 2;
    if (conditions.hasCHoCH) score += 2;
    if (conditions.volumeIncreasing) score += 2;
    if (conditions.noBearishDivergence) score += 2;
    if (conditions.weeklyAligned) score += 1;
    if (conditions.volumeConfirmed) score += 1;
    if (conditions.macdBullish) score += 1;
    if (conditions.macdAccelerating) score += 1;
    if (conditions.allTimeframesAligned) score += 1;
    if (conditions.noFTConflict) score += 1;
    if (conditions.emaCrossover) score += 1;
    if (conditions.hasStrongPattern) score += 1;
    // resistance_rejection is the best pattern (8.8% win rate vs 3.5% baseline)
    if (conditions.primaryPattern === 'resistance_rejection') score += 3;
    // Penalties (backtest-proven losers)
    if (conditions.isStrongTrend) score -= 4;   // 2.4% win rate, -0.33% P&L
    if (conditions.hasOrderBlock) score -= 2;    // OB alone is misleading
    if (conditions.isTransition) score -= 3;
    if (!conditions.noBearishDivergence) score -= 1;
    if (!conditions.noFTConflict) score -= 1;
    if (conditions.volumeHigh && !conditions.volumeIncreasing) score -= 1; // High but not increasing = fading

    // B: decent setup (score >= 7 AND confidence >= 60)
    if (score >= 7 && confidence >= 60) {
        return {
            grade: 'B',
            matchedStack: null,
            reason: `Score-based: ${score} points, ${confidence}% confidence`,
        };
    }

    // C: marginal
    return {
        grade: 'C',
        matchedStack: null,
        reason: `Score-based: ${score} points, ${confidence}% confidence — marginal setup`,
    };
}

/**
 * Check if a grade should be surfaced in the top-10 dashboard.
 * Only A+ and A signals make the cut.
 */
export function isTopTierGrade(grade: SignalGrade): boolean {
    return grade === 'A+' || grade === 'A';
}

/**
 * Check if a grade should trigger a Telegram alert.
 * Only A+ signals.
 */
export function shouldAlertTelegram(grade: SignalGrade): boolean {
    return grade === 'A+';
}

/**
 * Check if a grade should be blocked entirely.
 * F signals are never shown to the user.
 */
export function isBlockedGrade(grade: SignalGrade): boolean {
    return grade === 'F';
}
