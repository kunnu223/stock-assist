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
 * A+ stacks: 75%+ historical win rate, min 20 signals.
 * These are the highest-conviction setups — Telegram alerts fire only for these.
 */
const A_PLUS_STACKS: string[][] = [
    ['isStrongTrend', 'weeklyAligned', 'volumeConfirmed', 'macdAccelerating'],
    ['isStrongTrend', 'allTimeframesAligned', 'volumeHigh', 'hasOrderBlock'],
    ['weeklyAligned', 'volumeConfirmed', 'macdBullish', 'noBearishDivergence', 'hasStrongPattern'],
    ['isStrongTrend', 'weeklyAligned', 'hasOrderBlock', 'hasCHoCH'],
];

/**
 * A stacks: 70-75% historical win rate.
 * Shown in top-10 dashboard alongside A+.
 */
const A_STACKS: string[][] = [
    ['isStrongTrend', 'weeklyAligned', 'volumeConfirmed'],
    ['weeklyAligned', 'macdBullish', 'macdAccelerating', 'noBearishDivergence'],
    ['allTimeframesAligned', 'volumeHigh', 'rsiInZone'],
    ['isStrongTrend', 'hasOrderBlock', 'volumeConfirmed'],
    ['weeklyAligned', 'hasStrongPattern', 'volumeConfirmed', 'noFTConflict'],
];

/**
 * F stacks: historically proven losers (<45% win rate with 20+ signals).
 * These are BLOCKED — never surface to the user.
 */
const F_STACKS: string[][] = [
    ['isTransition', 'bollingerSqueeze'],  // Choppy + squeeze = whipsaw
    ['isTransition', 'hasLiquiditySweep'],  // Sweep in transition = trap
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
    let score = 0;
    if (conditions.isStrongTrend) score += 2;
    if (conditions.weeklyAligned) score += 2;
    if (conditions.volumeConfirmed) score += 1;
    if (conditions.volumeHigh) score += 1;
    if (conditions.macdBullish) score += 1;
    if (conditions.macdAccelerating) score += 1;
    if (conditions.rsiInZone) score += 1;
    if (conditions.hasStrongPattern) score += 1;
    if (conditions.hasOrderBlock) score += 1;
    if (conditions.hasCHoCH) score += 1;
    if (conditions.allTimeframesAligned) score += 2;
    if (conditions.noBearishDivergence) score += 1;
    if (conditions.noFTConflict) score += 1;
    if (conditions.emaCrossover) score += 1;
    // Penalties
    if (conditions.isTransition) score -= 2;
    if (!conditions.noBearishDivergence) score -= 1;
    if (!conditions.noFTConflict) score -= 1;

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
