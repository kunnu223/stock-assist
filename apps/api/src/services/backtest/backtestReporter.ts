/**
 * Backtest Reporter + Condition Stack Finder
 * Generates comprehensive stats and discovers highest-probability condition stacks
 * @module @stock-assist/api/services/backtest/backtestReporter
 */

import type { BacktestSignal } from './walkForwardEngine';

// ═══════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════

export interface ConditionStack {
    conditions: string[];
    totalSignals: number;
    winRate: number;
    avgPnl: number;
    profitFactor: number;
    sampleSize: number;
    edge: number;  // winRate - baselineWinRate
}

interface BucketStats {
    count: number;
    winRate: number;
    avgPnl: number;
    profitFactor: number;
}

export interface BacktestReport {
    // Overview
    totalSignals: number;
    dateRange: string;
    symbolCount: number;

    // Core metrics
    winRate: number;
    lossRate: number;
    profitFactor: number;
    expectancy: number;
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

    // MFE/MAE analysis
    avgMFE: number;
    avgMAE: number;
    mfeOnLosers: number;
    maeOnWinners: number;

    // Component breakdowns
    byRegime: Record<string, BucketStats>;
    byConfidenceBucket: Record<string, BucketStats>;
    byPattern: Record<string, BucketStats>;
    bySMC: {
        withSMC: BucketStats;
        withoutSMC: BucketStats;
        edge: number;
    };
    byWeeklyTrend: Record<string, BucketStats>;
    byVolumeRatio: Record<string, BucketStats>;

    // Risk metrics
    maxConsecutiveLosses: number;
    maxDrawdownPercent: number;
    sharpeRatio: number;

    // Condition stacks
    topStacks: ConditionStack[];
    worstStacks: ConditionStack[];

    // Actionable insights
    insights: string[];
}

// ═══════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════

function isWinner(s: BacktestSignal): boolean {
    return s.outcome === 'TARGET_HIT' || (s.outcome === 'PARTIAL_PROFIT' && s.pnlPercent > 0);
}

function calcWinRate(signals: BacktestSignal[]): number {
    if (signals.length === 0) return 0;
    return (signals.filter(isWinner).length / signals.length) * 100;
}

function calcAvgPnl(signals: BacktestSignal[]): number {
    if (signals.length === 0) return 0;
    return signals.reduce((sum, s) => sum + s.pnlPercent, 0) / signals.length;
}

function calcProfitFactor(signals: BacktestSignal[]): number {
    const winners = signals.filter(s => s.pnlPercent > 0);
    const losers = signals.filter(s => s.pnlPercent < 0);
    const grossProfit = winners.reduce((sum, s) => sum + s.pnlPercent, 0);
    const grossLoss = Math.abs(losers.reduce((sum, s) => sum + s.pnlPercent, 0));
    if (grossLoss === 0) return grossProfit > 0 ? 99.9 : 0;
    return Number((grossProfit / grossLoss).toFixed(2));
}

function average(arr: number[]): number {
    if (arr.length === 0) return 0;
    return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function sum(arr: number[]): number {
    return arr.reduce((a, b) => a + b, 0);
}

function toBucketStats(signals: BacktestSignal[]): BucketStats {
    return {
        count: signals.length,
        winRate: Number(calcWinRate(signals).toFixed(1)),
        avgPnl: Number(calcAvgPnl(signals).toFixed(2)),
        profitFactor: calcProfitFactor(signals),
    };
}

function groupAndAnalyze(
    signals: BacktestSignal[],
    keyFn: (s: BacktestSignal) => string,
): Record<string, BucketStats> {
    const groups: Record<string, BacktestSignal[]> = {};
    for (const s of signals) {
        const key = keyFn(s);
        if (!groups[key]) groups[key] = [];
        groups[key].push(s);
    }
    const result: Record<string, BucketStats> = {};
    for (const [key, group] of Object.entries(groups)) {
        result[key] = toBucketStats(group);
    }
    return result;
}

function calcMaxConsecutiveLosses(signals: BacktestSignal[]): number {
    let max = 0;
    let current = 0;
    for (const s of signals) {
        if (!isWinner(s)) {
            current++;
            max = Math.max(max, current);
        } else {
            current = 0;
        }
    }
    return max;
}

function calcMaxDrawdown(signals: BacktestSignal[]): number {
    let cumPnl = 0;
    let peak = 0;
    let maxDD = 0;
    for (const s of signals) {
        cumPnl += s.pnlPercent;
        peak = Math.max(peak, cumPnl);
        const dd = peak - cumPnl;
        maxDD = Math.max(maxDD, dd);
    }
    return Number(maxDD.toFixed(2));
}

function calcSharpeRatio(signals: BacktestSignal[]): number {
    if (signals.length < 2) return 0;
    const returns = signals.map(s => s.pnlPercent);
    const mean = average(returns);
    const variance = returns.reduce((sum, r) => sum + (r - mean) ** 2, 0) / (returns.length - 1);
    const std = Math.sqrt(variance);
    if (std === 0) return 0;
    // Annualized: assume ~1 trade per day, 252 trading days
    return Number(((mean / std) * Math.sqrt(252 / Math.max(1, signals.length))).toFixed(2));
}

// ═══════════════════════════════════════════════════════════════
// CONDITION STACK FINDER
// ═══════════════════════════════════════════════════════════════

/** Boolean condition keys to test in stacks */
const BOOLEAN_CONDITION_KEYS = [
    'isStrongTrend',
    'isTransition',
    'weeklyAligned',
    'allTimeframesAligned',
    'volumeHigh',
    'volumeConfirmed',
    'volumeIncreasing',
    'rsiInZone',
    'macdBullish',
    'macdAccelerating',
    'emaCrossover',
    'hasStrongPattern',
    'hasOrderBlock',
    'hasCHoCH',
    'hasLiquiditySweep',
    'noBearishDivergence',
    'noFTConflict',
    'bollingerSqueeze',
] as const;

type BoolConditionKey = typeof BOOLEAN_CONDITION_KEYS[number];

/** Minimum signals per stack for statistical reliability */
const MIN_STACK_SAMPLE = 20;

/** Minimum edge over baseline to report */
const MIN_EDGE = 3;

function matchesStack(signal: BacktestSignal, keys: BoolConditionKey[]): boolean {
    for (const key of keys) {
        if (!signal.conditions[key]) return false;
    }
    return true;
}

function evaluateStack(
    signals: BacktestSignal[],
    keys: BoolConditionKey[],
    baselineWinRate: number,
): ConditionStack | null {
    const filtered = signals.filter(s => matchesStack(s, keys));
    if (filtered.length < MIN_STACK_SAMPLE) return null;

    const winRate = calcWinRate(filtered);
    const edge = winRate - baselineWinRate;

    return {
        conditions: [...keys],
        totalSignals: filtered.length,
        winRate: Number(winRate.toFixed(1)),
        avgPnl: Number(calcAvgPnl(filtered).toFixed(2)),
        profitFactor: calcProfitFactor(filtered),
        sampleSize: filtered.length,
        edge: Number(edge.toFixed(1)),
    };
}

/**
 * Find condition stacks with highest and lowest win rates.
 * Tests all 2, 3, 4-condition combinations (5 is too expensive for most datasets).
 */
export function findConditionStacks(signals: BacktestSignal[]): {
    topStacks: ConditionStack[];
    worstStacks: ConditionStack[];
} {
    const baselineWinRate = calcWinRate(signals);
    const allStacks: ConditionStack[] = [];
    const keys = BOOLEAN_CONDITION_KEYS;
    const n = keys.length;

    // 2-condition pairs
    for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
            const stack = evaluateStack(signals, [keys[i], keys[j]], baselineWinRate);
            if (stack) allStacks.push(stack);
        }
    }

    // 3-condition triples
    for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
            for (let k = j + 1; k < n; k++) {
                const stack = evaluateStack(signals, [keys[i], keys[j], keys[k]], baselineWinRate);
                if (stack) allStacks.push(stack);
            }
        }
    }

    // 4-condition quads: only test combinations that include at least one condition
    // from the top 2-condition pairs (reduces combinatorial explosion)
    const top2Conditions = new Set<string>();
    const sorted2 = allStacks
        .filter(s => s.conditions.length === 2)
        .sort((a, b) => b.edge - a.edge)
        .slice(0, 15);
    for (const s of sorted2) {
        for (const c of s.conditions) top2Conditions.add(c);
    }
    const topCondKeys = [...top2Conditions] as BoolConditionKey[];

    for (let i = 0; i < topCondKeys.length; i++) {
        for (let j = i + 1; j < topCondKeys.length; j++) {
            for (let k = j + 1; k < topCondKeys.length; k++) {
                for (let l = k + 1; l < topCondKeys.length; l++) {
                    const stack = evaluateStack(
                        signals,
                        [topCondKeys[i], topCondKeys[j], topCondKeys[k], topCondKeys[l]],
                        baselineWinRate,
                    );
                    if (stack) allStacks.push(stack);
                }
            }
        }
    }

    // Sort by edge and return top/bottom
    allStacks.sort((a, b) => b.edge - a.edge);

    const topStacks = allStacks
        .filter(s => s.edge >= MIN_EDGE)
        .slice(0, 15);

    const worstStacks = allStacks
        .filter(s => s.edge < -MIN_EDGE)
        .sort((a, b) => a.edge - b.edge)
        .slice(0, 10);

    return { topStacks, worstStacks };
}

// ═══════════════════════════════════════════════════════════════
// REPORT GENERATOR
// ═══════════════════════════════════════════════════════════════

/**
 * Generate comprehensive backtest report from signal array.
 */
export function generateReport(signals: BacktestSignal[]): BacktestReport {
    if (signals.length === 0) {
        return emptyReport();
    }

    const winners = signals.filter(isWinner);
    const losers = signals.filter(s => !isWinner(s));
    const winRate = calcWinRate(signals);
    const avgWin = average(winners.map(s => s.pnlPercent));
    const avgLoss = Math.abs(average(losers.map(s => s.pnlPercent)));
    const profitFactor = calcProfitFactor(signals);

    // MFE/MAE
    const mfeOnLosers = average(losers.map(s => s.mfe));
    const maeOnWinners = average(winners.map(s => s.mae));

    // Component breakdowns
    const byRegime = groupAndAnalyze(signals, s => s.regime);
    const byConfidence = groupAndAnalyze(signals, s => {
        if (s.confidence >= 80) return '80-100';
        if (s.confidence >= 70) return '70-79';
        if (s.confidence >= 65) return '65-69';
        return '<65';
    });
    const byPattern = groupAndAnalyze(signals, s => s.conditions.primaryPattern ?? 'none');
    const byWeeklyTrend = groupAndAnalyze(signals, s => {
        if (s.conditions.weeklyAligned) return 'aligned';
        return 'conflicting';
    });
    const byVolumeRatio = groupAndAnalyze(signals, s => {
        if (s.conditions.volumeRatio >= 2.0) return '2.0+';
        if (s.conditions.volumeRatio >= 1.5) return '1.5-2.0';
        if (s.conditions.volumeRatio >= 1.0) return '1.0-1.5';
        return '<1.0';
    });

    // SMC A/B
    const withSMC = signals.filter(s => s.conditions.smcConfluenceCount >= 1);
    const withoutSMC = signals.filter(s => s.conditions.smcConfluenceCount === 0);
    const smcEdge = calcWinRate(withSMC) - calcWinRate(withoutSMC);

    // Stack finder
    const { topStacks, worstStacks } = findConditionStacks(signals);

    // Generate insights
    const insights = generateInsights(signals, winners, losers, {
        winRate, mfeOnLosers, maeOnWinners, smcEdge,
        byRegime, topStacks, worstStacks, profitFactor,
    });

    return {
        totalSignals: signals.length,
        dateRange: `${signals[0]?.date} to ${signals[signals.length - 1]?.date}`,
        symbolCount: new Set(signals.map(s => s.symbol)).size,

        winRate: Number(winRate.toFixed(1)),
        lossRate: Number((100 - winRate).toFixed(1)),
        profitFactor,
        expectancy: Number(((winRate / 100 * avgWin) - ((100 - winRate) / 100 * avgLoss)).toFixed(2)),
        avgPnlPercent: Number(calcAvgPnl(signals).toFixed(2)),
        totalPnlPercent: Number(sum(signals.map(s => s.pnlPercent)).toFixed(2)),

        outcomes: {
            targetHit: signals.filter(s => s.outcome === 'TARGET_HIT').length,
            stopHit: signals.filter(s => s.outcome === 'STOP_HIT').length,
            partialProfit: signals.filter(s => s.outcome === 'PARTIAL_PROFIT').length,
            expired: signals.filter(s => s.outcome === 'EXPIRED').length,
        },

        avgDaysToOutcome: Number(average(signals.map(s => s.daysToOutcome)).toFixed(1)),
        avgDaysWinners: Number(average(winners.map(s => s.daysToOutcome)).toFixed(1)),
        avgDaysLosers: Number(average(losers.map(s => s.daysToOutcome)).toFixed(1)),

        avgMFE: Number(average(signals.map(s => s.mfe)).toFixed(2)),
        avgMAE: Number(average(signals.map(s => s.mae)).toFixed(2)),
        mfeOnLosers: Number(mfeOnLosers.toFixed(2)),
        maeOnWinners: Number(maeOnWinners.toFixed(2)),

        byRegime,
        byConfidenceBucket: byConfidence,
        byPattern,
        bySMC: {
            withSMC: toBucketStats(withSMC),
            withoutSMC: toBucketStats(withoutSMC),
            edge: Number(smcEdge.toFixed(1)),
        },
        byWeeklyTrend,
        byVolumeRatio,

        maxConsecutiveLosses: calcMaxConsecutiveLosses(signals),
        maxDrawdownPercent: calcMaxDrawdown(signals),
        sharpeRatio: calcSharpeRatio(signals),

        topStacks,
        worstStacks,
        insights,
    };
}

// ═══════════════════════════════════════════════════════════════
// INSIGHT GENERATOR
// ═══════════════════════════════════════════════════════════════

function generateInsights(
    signals: BacktestSignal[],
    winners: BacktestSignal[],
    losers: BacktestSignal[],
    data: {
        winRate: number;
        mfeOnLosers: number;
        maeOnWinners: number;
        smcEdge: number;
        byRegime: Record<string, BucketStats>;
        topStacks: ConditionStack[];
        worstStacks: ConditionStack[];
        profitFactor: number;
    },
): string[] {
    const insights: string[] = [];

    // Overall assessment
    if (data.winRate >= 60) {
        insights.push(`SYSTEM PROFITABLE: ${data.winRate.toFixed(1)}% win rate, PF ${data.profitFactor}. Foundation is solid.`);
    } else if (data.winRate >= 50) {
        insights.push(`SYSTEM MARGINAL: ${data.winRate.toFixed(1)}% win rate. Needs selectivity (use condition stacks to filter).`);
    } else {
        insights.push(`SYSTEM NEEDS WORK: ${data.winRate.toFixed(1)}% win rate. Focus on blocking worst stacks and tightening entries.`);
    }

    // MFE/MAE insights
    if (data.mfeOnLosers > 1.0) {
        insights.push(
            `EXITS TOO EARLY: Losing trades had avg ${data.mfeOnLosers.toFixed(1)}% MFE — ` +
            `many were winning before hitting stop. Consider wider stops or faster partial profit.`
        );
    }
    if (data.maeOnWinners > 2.0) {
        insights.push(
            `TAKING TOO MUCH HEAT: Winning trades had avg ${data.maeOnWinners.toFixed(1)}% MAE — ` +
            `entries could be tighter (closer to support/OB zones).`
        );
    }

    // SMC edge
    if (data.smcEdge > 3) {
        insights.push(`SMC HELPS: +${data.smcEdge.toFixed(1)}% win rate with SMC confluence. Keep or increase SMC weight.`);
    } else if (data.smcEdge < -3) {
        insights.push(`SMC HURTS: ${data.smcEdge.toFixed(1)}% win rate with SMC. Consider reducing SMC weight.`);
    } else {
        insights.push(`SMC NEUTRAL: ${data.smcEdge.toFixed(1)}% difference. Keep as light filter.`);
    }

    // Best/worst regime
    const regimeEntries = Object.entries(data.byRegime).filter(([, v]) => v.count >= 10);
    if (regimeEntries.length >= 2) {
        regimeEntries.sort((a, b) => b[1].winRate - a[1].winRate);
        const best = regimeEntries[0];
        const worst = regimeEntries[regimeEntries.length - 1];
        insights.push(
            `BEST REGIME: ${best[0]} (${best[1].winRate}% win rate, ${best[1].count} trades). ` +
            `WORST: ${worst[0]} (${worst[1].winRate}%, ${worst[1].count} trades). ` +
            (worst[1].winRate < 45 ? `Consider BLOCKING signals in ${worst[0]} regime.` : '')
        );
    }

    // Top stacks
    if (data.topStacks.length > 0) {
        const best = data.topStacks[0];
        insights.push(
            `TOP STACK: [${best.conditions.join(' + ')}] → ${best.winRate}% win rate ` +
            `(${best.sampleSize} signals, +${best.edge}% edge). This is your A+ setup.`
        );
    }

    // Worst stacks
    if (data.worstStacks.length > 0) {
        const worst = data.worstStacks[0];
        insights.push(
            `WORST STACK: [${worst.conditions.join(' + ')}] → ${worst.winRate}% win rate ` +
            `(${worst.sampleSize} signals, ${worst.edge}% edge). BLOCK this combination.`
        );
    }

    return insights;
}

// ═══════════════════════════════════════════════════════════════
// EMPTY REPORT
// ═══════════════════════════════════════════════════════════════

function emptyReport(): BacktestReport {
    return {
        totalSignals: 0, dateRange: 'N/A', symbolCount: 0,
        winRate: 0, lossRate: 0, profitFactor: 0, expectancy: 0,
        avgPnlPercent: 0, totalPnlPercent: 0,
        outcomes: { targetHit: 0, stopHit: 0, partialProfit: 0, expired: 0 },
        avgDaysToOutcome: 0, avgDaysWinners: 0, avgDaysLosers: 0,
        avgMFE: 0, avgMAE: 0, mfeOnLosers: 0, maeOnWinners: 0,
        byRegime: {}, byConfidenceBucket: {}, byPattern: {},
        bySMC: { withSMC: { count: 0, winRate: 0, avgPnl: 0, profitFactor: 0 }, withoutSMC: { count: 0, winRate: 0, avgPnl: 0, profitFactor: 0 }, edge: 0 },
        byWeeklyTrend: {}, byVolumeRatio: {},
        maxConsecutiveLosses: 0, maxDrawdownPercent: 0, sharpeRatio: 0,
        topStacks: [], worstStacks: [], insights: ['No signals generated — check date range and symbol list.'],
    };
}
