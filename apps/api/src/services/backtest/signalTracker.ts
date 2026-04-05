/**
 * Signal Tracker Service
 * Logs every BUY/SELL signal with full context for statistical analysis.
 * Provides condition → win-rate matrix for replacing static modifiers.
 *
 * @module @stock-assist/api/services/backtest/signalTracker
 */

import { SignalRecord, SignalStatus, type ISignalRecord, type AdxRegime, type MarketRegime } from '../../models/SignalRecord';
import type { OHLCData } from '@stock-assist/shared';
import crypto from 'crypto';
import { alertSignalResolved } from '../notifications/telegram';
import { logger } from '../../config/logger';

// ═══════════════════════════════════════════════════════════════
// CONDITION HASHING (Phase A — #2)
// ═══════════════════════════════════════════════════════════════

/** Minimum resolved samples for a condition hash to be considered reliable */
const MIN_SAMPLES_FOR_EMPIRICAL = 50;

/**
 * Bucket alignment score into 3 categories (Risk #1: compress state space):
 * HIGH (≥70), MID (40-70), LOW (<40)
 * Reduced from 4 buckets to 3 → fewer hash combinations
 */
function bucketAlignment(score: number): string {
    if (score >= 70) return 'HIGH';
    if (score >= 40) return 'MID';
    return 'LOW';
}

/**
 * Bucket ADX value into 3 categories (Risk #1: compress state space):
 * STRONG (≥25), MODERATE (15-25), WEAK (<15)
 * Reduced from 4 buckets to 3
 */
function bucketADX(adx: number): string {
    if (adx >= 25) return 'STRONG';
    if (adx >= 15) return 'MODERATE';
    return 'WEAK';
}

/**
 * Bucket volume ratio into 3 categories (Risk #1: compress state space):
 * HIGH (≥1.5), NORMAL (1.0-1.5), LOW (<1.0)
 * Reduced from 4 buckets to 3
 */
function bucketVolume(ratio: number): string {
    if (ratio >= 1.5) return 'HIGH';
    if (ratio >= 1.0) return 'NORMAL';
    return 'LOW';
}

/**
 * Compress 5 regimes into 3 hash-level regimes (Risk #1: state space compression).
 * Full regime classification is preserved for other uses — this only affects the hash.
 * 
 * TREND    = TRENDING_STRONG + TRENDING_WEAK
 * RANGE    = RANGE
 * VOLATILE = VOLATILE + EVENT_DRIVEN
 */
function compressRegime(regime: MarketRegime): string {
    if (regime === 'TRENDING_STRONG' || regime === 'TRENDING_WEAK') return 'TREND';
    if (regime === 'VOLATILE' || regime === 'EVENT_DRIVEN') return 'VOLATILE';
    return 'RANGE';
}

/**
 * Generate a condition hash from the 4 core variables.
 * Risk #1 fix: Compressed to 3×3×3×3 = 81 combinations max.
 * Previously was 5×4×4×4 = 960.
 * Hash = deterministic string from: compressedRegime + alignBucket + adxBucket + volBucket
 */
function computeConditionHash(
    regime: MarketRegime,
    alignmentScore: number,
    adxValue: number,
    volumeRatio: number
): { hash: string; alignmentBucket: string; adxBucket: string; volumeBucket: string } {
    const alignmentBucket = bucketAlignment(alignmentScore);
    const adxBucket = bucketADX(adxValue);
    const volumeBucket = bucketVolume(volumeRatio);
    const compressedRegime = compressRegime(regime);

    const raw = `${compressedRegime}|${alignmentBucket}|${adxBucket}|${volumeBucket}`;
    const hash = crypto.createHash('md5').update(raw).digest('hex').substring(0, 12);

    return { hash, alignmentBucket, adxBucket, volumeBucket };
}

export interface SignalContext {
    symbol: string;
    direction: 'BUY' | 'SELL';
    confidence: number;         // System-adjusted
    baseConfidence: number;     // Before modifiers

    // Conditions
    adxValue: number;
    adxRegime: AdxRegime;
    volumeRatio: number;
    volumeConfirmed: boolean;
    alignmentScore: number;
    patternType: string | null;
    patternConfluence: number;
    sectorStrength: string;
    sectorModifier: number;
    rsiValue: number;
    fundamentalConflict: boolean;
    ftModifier: number;
    regime: MarketRegime;

    // Modifiers applied
    modifiers: {
        volume: number;
        multiTF: number;
        adx: number;
        confluence: number;
        ft: number;
        sector: number;
    };

    // Price levels
    entryPrice: number;
    targetPrice: number;
    stopLoss: number;

    // Attribution (Phase 3)
    attribution?: {
        technicalScore: number;
        patternScore: number;
        volumeScore: number;
        newsScore: number;
        fundamentalScore: number;
        macdValue: number;
        macdHistogram: number;
        macdTrend: string;
        maTrend: string;
        ema9: number;
        ema21: number;
        bollingerPercentB: number;
        hasOB: boolean;
        hasFVG: boolean;
        hasCHoCH: boolean;
        hasLiquiditySweep: boolean;
        smcConfluenceCount: number;
        entryTrigger: string;
        macdMomentum: string;
        volumeTrend: string;
        rsiDivergence: string;
    };

    // Phase 6: Signal Grade
    grade?: 'A+' | 'A' | 'B' | 'C' | 'F';
    gradeReason?: string;
}

export interface ConditionFilter {
    regime?: MarketRegime;
    adxRegime?: AdxRegime;
    volumeConfirmed?: boolean;
    minConfidence?: number;
    maxConfidence?: number;
    direction?: 'BUY' | 'SELL';
    symbol?: string;
}

export interface WinRateResult {
    condition: string;
    total: number;
    wins: number;
    losses: number;
    pending: number;
    winRate: number;         // 0-100
    avgPnl: number;
    sampleSize: number;     // Same as total resolved
}

// ═══════════════════════════════════════════════════════════════
// SAVE SIGNAL
// ═══════════════════════════════════════════════════════════════

/**
 * Save a signal with full context. Fire-and-forget from analyze.ts.
 * Phase A: Now computes and stores condition hash for empirical probability.
 */
export async function saveSignal(context: SignalContext): Promise<string | null> {
    try {
        // Prevent duplicate signals for same symbol on same day
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        // Phase A: Compute condition hash
        const { hash, alignmentBucket, adxBucket, volumeBucket } = computeConditionHash(
            context.regime,
            context.alignmentScore,
            context.adxValue,
            context.volumeRatio
        );

        const signalData = {
            ...context,
            conditionHash: hash,
            alignmentBucket,
            adxBucket,
            volumeBucket,
        };

        const existing = await SignalRecord.findOne({
            symbol: context.symbol,
            date: { $gte: today, $lt: tomorrow }
        });

        if (existing) {
            // Update existing signal instead of creating duplicate
            Object.assign(existing, signalData);
            await existing.save();
            logger.info(`[SignalTracker] Updated signal for ${context.symbol} (hash: ${hash})`);
            return existing._id.toString();
        }

        const created = await SignalRecord.create(signalData);
        logger.info(`[SignalTracker] Saved signal for ${context.symbol} (hash: ${hash}, regime: ${context.regime}, align: ${alignmentBucket}, adx: ${adxBucket}, vol: ${volumeBucket})`);
        return created._id.toString();
    } catch (error) {
        logger.error({ err: error }, `[SignalTracker] Failed to save signal for ${context.symbol}`);
        return null;
    }
}

// ═══════════════════════════════════════════════════════════════
// LAZY OUTCOME CHECK
// ═══════════════════════════════════════════════════════════════

/** Hard expiry for signals (research shows 5-10 day edge) */
const SIGNAL_EXPIRY_DAYS = 7;

/** Partial profit at 1.5R (50% of position) */
const PARTIAL_PROFIT_R = 1.5;

/** Full target at 2.5R (remaining 50%) */
const FULL_TARGET_R = 2.5;

/**
 * Calculate RSI for a price slice (lightweight — no full indicator pipeline).
 * Used for RSI exhaustion guardrail during outcome checking.
 */
function quickRSI(prices: number[], period: number = 10): number {
    if (prices.length < period + 1) return 50;
    const changes: number[] = [];
    for (let i = prices.length - period; i < prices.length; i++) {
        changes.push(prices[i] - prices[i - 1]);
    }
    let gains = 0, losses = 0;
    for (const c of changes) {
        if (c > 0) gains += c;
        else losses += Math.abs(c);
    }
    const avgGain = gains / period;
    const avgLoss = losses / period;
    if (avgLoss === 0) return 100;
    const rs = avgGain / avgLoss;
    return 100 - 100 / (1 + rs);
}

/**
 * Get lowest low of last N bars (for trailing stop on longs).
 */
function lowestLow(bars: OHLCData[], count: number): number {
    const recent = bars.slice(-count);
    return Math.min(...recent.map(b => b.low));
}

/**
 * Get highest high of last N bars (for trailing stop on shorts).
 */
function highestHigh(bars: OHLCData[], count: number): number {
    const recent = bars.slice(-count);
    return Math.max(...recent.map(b => b.high));
}

/**
 * Check pending signals against recent historical data.
 * Phase 2: Partial profit exit system.
 *
 * Exit logic:
 *   1. 50% exit at 1.5R → status = PARTIAL_PROFIT, trail remaining 50%
 *   2. Trail method: stop = max(current_stop, lowest_low_last_2_bars) for longs
 *   3. Full exit at 2.5R or day 7 (whichever first)
 *   4. RSI exhaustion: if RSI > 80 within 2-3 days → tighten to breakeven,
 *      if RSI then closes below 65 → exit remaining
 *   5. Hard expiry: 7 days
 */
export async function updateSignalOutcomes(symbol: string, history: OHLCData[]): Promise<number> {
    try {
        const pending = await SignalRecord.find({
            symbol,
            status: { $in: [SignalStatus.PENDING, SignalStatus.PARTIAL_PROFIT] }
        });

        if (pending.length === 0) return 0;

        let updated = 0;
        for (const signal of pending) {
            const daysSince = (Date.now() - signal.date.getTime()) / (1000 * 60 * 60 * 24);

            // Hard expiry: 7 days
            if (daysSince > SIGNAL_EXPIRY_DAYS) {
                const isPartial = signal.status === SignalStatus.PARTIAL_PROFIT;
                signal.status = SignalStatus.EXPIRED;
                signal.exitReason = 'time_expiry';
                signal.daysToOutcome = Math.round(daysSince);
                if (isPartial && signal.partialExitPnl !== undefined) {
                    // Blended PnL: 50% partial profit + 50% at current price (≈ last close)
                    const lastClose = history.length > 0 ? history[history.length - 1].close : signal.entryPrice;
                    const remainderPnl = signal.direction === 'BUY'
                        ? ((lastClose - signal.entryPrice) / signal.entryPrice) * 100
                        : ((signal.entryPrice - lastClose) / signal.entryPrice) * 100;
                    signal.pnlPercent = (signal.partialExitPnl * 0.5) + (remainderPnl * 0.5);
                    signal.outcomePrice = lastClose;
                } else {
                    signal.pnlPercent = 0;
                }
                await signal.save();
                updated++;
                continue;
            }

            // Check bars after signal date
            const relevantBars = history.filter(bar => new Date(bar.date) > signal.date);
            if (relevantBars.length === 0) continue;

            const initialRisk = Math.abs(signal.entryPrice - signal.stopLoss);
            const partialTarget = signal.direction === 'BUY'
                ? signal.entryPrice + initialRisk * PARTIAL_PROFIT_R
                : signal.entryPrice - initialRisk * PARTIAL_PROFIT_R;
            const fullTarget = signal.direction === 'BUY'
                ? signal.entryPrice + initialRisk * FULL_TARGET_R
                : signal.entryPrice - initialRisk * FULL_TARGET_R;

            let currentStopLoss = signal.trailingStop || signal.stopLoss;
            let isPartialTaken = signal.status === SignalStatus.PARTIAL_PROFIT;
            let rsiExhaustionTriggered = false;
            let resolved = false;

            // Phase 3: Track MFE/MAE (Maximum Favorable/Adverse Excursion)
            let maxFavorable = 0;  // Best unrealized PnL%
            let maxAdverse = 0;    // Worst unrealized PnL%

            // Build price array for RSI (use all history up to each bar)
            const allPrices = history.map(b => b.close);
            const signalBarIndex = history.findIndex(bar => new Date(bar.date) > signal.date);

            for (let i = 0; i < relevantBars.length; i++) {
                const bar = relevantBars[i];
                const barDate = new Date(bar.date);
                const barIndex = signalBarIndex + i;
                const daysSinceSignal = (barDate.getTime() - signal.date.getTime()) / (1000 * 60 * 60 * 24);

                // Phase 3: Track MFE/MAE
                if (signal.direction === 'BUY') {
                    const bestPnl = ((bar.high - signal.entryPrice) / signal.entryPrice) * 100;
                    const worstPnl = ((bar.low - signal.entryPrice) / signal.entryPrice) * 100;
                    maxFavorable = Math.max(maxFavorable, bestPnl);
                    maxAdverse = Math.min(maxAdverse, worstPnl);
                } else {
                    const bestPnl = ((signal.entryPrice - bar.low) / signal.entryPrice) * 100;
                    const worstPnl = ((signal.entryPrice - bar.high) / signal.entryPrice) * 100;
                    maxFavorable = Math.max(maxFavorable, bestPnl);
                    maxAdverse = Math.min(maxAdverse, worstPnl);
                }

                if (signal.direction === 'BUY') {
                    // === PARTIAL PROFIT CHECK (before stop check) ===
                    if (!isPartialTaken && bar.high >= partialTarget) {
                        // Take 50% profit at 1.5R
                        signal.partialExitPrice = Number(partialTarget.toFixed(2));
                        signal.partialExitPnl = ((partialTarget - signal.entryPrice) / signal.entryPrice) * 100;
                        signal.partialExitDate = barDate;
                        signal.status = SignalStatus.PARTIAL_PROFIT;
                        isPartialTaken = true;
                        // Move stop to breakeven for remaining 50%
                        currentStopLoss = signal.entryPrice;
                    }

                    // === FULL TARGET CHECK (2.5R) ===
                    if (isPartialTaken && bar.high >= fullTarget) {
                        signal.status = SignalStatus.TARGET_HIT;
                        signal.exitReason = 'target_full';
                        signal.outcomePrice = Number(fullTarget.toFixed(2));
                        const remainderPnl = ((fullTarget - signal.entryPrice) / signal.entryPrice) * 100;
                        signal.pnlPercent = (signal.partialExitPnl! * 0.5) + (remainderPnl * 0.5);
                        resolved = true;
                    }
                    // === TRAILING STOP (lowest low of last 2 bars) ===
                    else if (isPartialTaken && i >= 1) {
                        const trailBars = relevantBars.slice(Math.max(0, i - 1), i + 1);
                        const trailLevel = lowestLow(trailBars, trailBars.length);
                        currentStopLoss = Math.max(currentStopLoss, trailLevel);
                    }

                    // === RSI EXHAUSTION GUARDRAIL ===
                    if (isPartialTaken && daysSinceSignal <= 3 && barIndex < allPrices.length) {
                        const rsi = quickRSI(allPrices.slice(0, barIndex + 1));
                        if (rsi > 80) {
                            rsiExhaustionTriggered = true;
                            currentStopLoss = Math.max(currentStopLoss, signal.entryPrice); // Tighten to breakeven
                        }
                        if (rsiExhaustionTriggered && rsi < 65) {
                            // Exit remaining position
                            signal.status = SignalStatus.TARGET_HIT;
                            signal.exitReason = 'rsi_exhaustion';
                            signal.outcomePrice = bar.close;
                            const remainderPnl = ((bar.close - signal.entryPrice) / signal.entryPrice) * 100;
                            signal.pnlPercent = (signal.partialExitPnl! * 0.5) + (remainderPnl * 0.5);
                            resolved = true;
                        }
                    }

                    // === STOP LOSS CHECK ===
                    if (!resolved && bar.low <= currentStopLoss) {
                        signal.status = SignalStatus.STOP_HIT;
                        signal.outcomePrice = Number(currentStopLoss.toFixed(2));
                        if (isPartialTaken) {
                            signal.exitReason = currentStopLoss >= signal.entryPrice ? 'stop_breakeven' : 'stop_trailing';
                            const remainderPnl = ((currentStopLoss - signal.entryPrice) / signal.entryPrice) * 100;
                            signal.pnlPercent = (signal.partialExitPnl! * 0.5) + (remainderPnl * 0.5);
                        } else {
                            signal.exitReason = 'stop_initial';
                            signal.pnlPercent = ((currentStopLoss - signal.entryPrice) / signal.entryPrice) * 100;
                        }
                        resolved = true;
                    }
                } else {
                    // === SELL direction ===

                    // === PARTIAL PROFIT CHECK ===
                    if (!isPartialTaken && bar.low <= partialTarget) {
                        signal.partialExitPrice = Number(partialTarget.toFixed(2));
                        signal.partialExitPnl = ((signal.entryPrice - partialTarget) / signal.entryPrice) * 100;
                        signal.partialExitDate = barDate;
                        signal.status = SignalStatus.PARTIAL_PROFIT;
                        isPartialTaken = true;
                        currentStopLoss = signal.entryPrice; // Breakeven
                    }

                    // === FULL TARGET CHECK (2.5R) ===
                    if (isPartialTaken && bar.low <= fullTarget) {
                        signal.status = SignalStatus.TARGET_HIT;
                        signal.exitReason = 'target_full';
                        signal.outcomePrice = Number(fullTarget.toFixed(2));
                        const remainderPnl = ((signal.entryPrice - fullTarget) / signal.entryPrice) * 100;
                        signal.pnlPercent = (signal.partialExitPnl! * 0.5) + (remainderPnl * 0.5);
                        resolved = true;
                    }
                    // === TRAILING STOP (highest high of last 2 bars) ===
                    else if (isPartialTaken && i >= 1) {
                        const trailBars = relevantBars.slice(Math.max(0, i - 1), i + 1);
                        const trailLevel = highestHigh(trailBars, trailBars.length);
                        currentStopLoss = Math.min(currentStopLoss, trailLevel);
                    }

                    // === RSI EXHAUSTION GUARDRAIL (inverse for shorts) ===
                    if (isPartialTaken && daysSinceSignal <= 3 && barIndex < allPrices.length) {
                        const rsi = quickRSI(allPrices.slice(0, barIndex + 1));
                        if (rsi < 20) {
                            rsiExhaustionTriggered = true;
                            currentStopLoss = Math.min(currentStopLoss, signal.entryPrice);
                        }
                        if (rsiExhaustionTriggered && rsi > 35) {
                            signal.status = SignalStatus.TARGET_HIT;
                            signal.exitReason = 'rsi_exhaustion';
                            signal.outcomePrice = bar.close;
                            const remainderPnl = ((signal.entryPrice - bar.close) / signal.entryPrice) * 100;
                            signal.pnlPercent = (signal.partialExitPnl! * 0.5) + (remainderPnl * 0.5);
                            resolved = true;
                        }
                    }

                    // === STOP LOSS CHECK ===
                    if (!resolved && bar.high >= currentStopLoss) {
                        signal.status = SignalStatus.STOP_HIT;
                        signal.outcomePrice = Number(currentStopLoss.toFixed(2));
                        if (isPartialTaken) {
                            signal.exitReason = currentStopLoss <= signal.entryPrice ? 'stop_breakeven' : 'stop_trailing';
                            const remainderPnl = ((signal.entryPrice - currentStopLoss) / signal.entryPrice) * 100;
                            signal.pnlPercent = (signal.partialExitPnl! * 0.5) + (remainderPnl * 0.5);
                        } else {
                            signal.exitReason = 'stop_initial';
                            signal.pnlPercent = ((signal.entryPrice - currentStopLoss) / signal.entryPrice) * 100;
                        }
                        resolved = true;
                    }
                }

                if (resolved) {
                    signal.outcomeDate = barDate;
                    signal.daysToOutcome = Math.round((barDate.getTime() - signal.date.getTime()) / (1000 * 60 * 60 * 24));
                    signal.trailingStop = Number(currentStopLoss.toFixed(2));
                    signal.mfe = Number(maxFavorable.toFixed(2));
                    signal.mae = Number(maxAdverse.toFixed(2));
                    await signal.save();
                    updated++;

                    // Phase 4.1: Telegram alert on signal resolution
                    if (signal.status === SignalStatus.TARGET_HIT || signal.status === SignalStatus.STOP_HIT) {
                        alertSignalResolved({
                            symbol,
                            direction: signal.direction,
                            status: signal.status,
                            pnlPercent: signal.pnlPercent || 0,
                            entryPrice: signal.entryPrice,
                            outcomePrice: signal.outcomePrice || signal.entryPrice,
                            daysToOutcome: signal.daysToOutcome || 0,
                        }).catch(err => logger.error({ err }, 'Telegram resolution alert error'));
                    }

                    break;
                }
            }

            // Save trailing stop progress even if not yet resolved (for PARTIAL_PROFIT state)
            if (!resolved && isPartialTaken) {
                signal.trailingStop = Number(currentStopLoss.toFixed(2));
                await signal.save();
                updated++;
            }
        }

        if (updated > 0) {
            logger.info(`[SignalTracker] Updated ${updated}/${pending.length} pending signals for ${symbol}`);
        }
        return updated;
    } catch (error) {
        logger.error({ err: error }, `[SignalTracker] Error updating outcomes for ${symbol}`);
        return 0;
    }
}

// ═══════════════════════════════════════════════════════════════
// CONDITION → WIN RATE MATRIX
// ═══════════════════════════════════════════════════════════════

/**
 * Get win rates grouped by condition combinations.
 * This is the core function that replaces static modifiers with empirical data.
 */
export async function getConditionWinRates(filters?: ConditionFilter): Promise<WinRateResult[]> {
    try {
        const matchStage: any = {
            status: { $ne: SignalStatus.PENDING }
        };

        if (filters?.regime) matchStage.regime = filters.regime;
        if (filters?.adxRegime) matchStage.adxRegime = filters.adxRegime;
        if (filters?.volumeConfirmed !== undefined) matchStage.volumeConfirmed = filters.volumeConfirmed;
        if (filters?.direction) matchStage.direction = filters.direction;
        if (filters?.symbol) matchStage.symbol = filters.symbol;
        if (filters?.minConfidence || filters?.maxConfidence) {
            matchStage.confidence = {};
            if (filters.minConfidence) matchStage.confidence.$gte = filters.minConfidence;
            if (filters.maxConfidence) matchStage.confidence.$lte = filters.maxConfidence;
        }

        const results = await SignalRecord.aggregate([
            { $match: matchStage },
            {
                $group: {
                    _id: {
                        regime: '$regime',
                        adxRegime: '$adxRegime',
                        volumeConfirmed: '$volumeConfirmed',
                    },
                    total: { $sum: 1 },
                    wins: { $sum: { $cond: [{ $eq: ['$status', SignalStatus.TARGET_HIT] }, 1, 0] } },
                    losses: { $sum: { $cond: [{ $eq: ['$status', SignalStatus.STOP_HIT] }, 1, 0] } },
                    avgPnl: { $avg: '$pnlPercent' },
                }
            },
            { $sort: { total: -1 } }
        ]);

        return results.map(r => ({
            condition: `${r._id.regime}|${r._id.adxRegime}|vol:${r._id.volumeConfirmed}`,
            total: r.total,
            wins: r.wins,
            losses: r.losses,
            pending: 0,
            winRate: r.total > 0 ? Math.round((r.wins / r.total) * 100) : 0,
            avgPnl: Math.round((r.avgPnl || 0) * 100) / 100,
            sampleSize: r.total,
        }));
    } catch (error) {
        logger.error({ err: error }, '[SignalTracker] Error fetching condition win rates');
        return [];
    }
}

// ═══════════════════════════════════════════════════════════════
// EMPIRICAL PROBABILITY LOOKUP (Phase A — #2 + #6)
// ═══════════════════════════════════════════════════════════════

export interface EmpiricalProbability {
    available: boolean;           // true if sufficient samples exist
    conditionHash: string;
    conditionLabel: string;       // Human-readable: "TREND|HIGH|STRONG|HIGH"
    sampleSize: number;
    winRate: number;              // 0-100 (empirical)
    avgWinPnl: number;            // Average or median win PnL%
    avgLossPnl: number;           // Average or median loss PnL%
    expectancy: number;           // (WR × Win) - (LR × Loss)
    reliable: boolean;            // true if sampleSize >= MIN_SAMPLES AND has diversity
    message: string;
}

/**
 * Risk #3 helper: Calculate median of an array.
 * Median is resistant to outlier wins/losses that distort mean-based expectancy.
 */
function calcMedian(values: number[]): number {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0
        ? (sorted[mid - 1] + sorted[mid]) / 2
        : sorted[mid];
}

/**
 * Risk #2 helper: Check if the sample has direction diversity.
 * Requires at least 2 distinct signal directions (BUY + SELL).
 * Markets cluster — data from only BUY signals gives false stability.
 */
function checkDirectionDiversity(signals: any[]): boolean {
    const directions = new Set(signals.map(s => s.direction));
    return directions.size >= 2;
}

/**
 * Look up empirical win rate for a given set of conditions.
 * This is THE breakthrough function — replaces synthetic confidence with data.
 * Phase A, Doc #2: Condition-Set Hashing.
 * Phase A, Doc #6: Minimum Sample Threshold.
 * 
 * Risk #2 fix: Reliability now requires regime diversity, not just sample count.
 * Risk #3 fix: Uses median-based expectancy when < 150 samples to resist outlier distortion.
 */
export async function getEmpiricalProbability(
    regime: MarketRegime,
    alignmentScore: number,
    adxValue: number,
    volumeRatio: number
): Promise<EmpiricalProbability> {
    const { hash, alignmentBucket, adxBucket, volumeBucket } = computeConditionHash(
        regime, alignmentScore, adxValue, volumeRatio
    );
    const conditionLabel = `${compressRegime(regime)}|${alignmentBucket}|${adxBucket}|${volumeBucket}`;

    try {
        let resolved = await SignalRecord.find({
            conditionHash: hash,
            status: { $ne: SignalStatus.PENDING }
        }).lean();

        let sampleSize = resolved.length;
        let isFuzzy = false;

        // NEW: Fuzzy Regime Matching
        if (sampleSize < MIN_SAMPLES_FOR_EMPIRICAL) {
            // Helper to get adjacent buckets
            const getAdjacent = (b: string) => {
                if (b === 'STRONG' || b === 'HIGH') return [b, b === 'STRONG' ? 'MODERATE' : 'NORMAL'];
                if (b === 'WEAK' || b === 'LOW') return [b, b === 'WEAK' ? 'MODERATE' : 'NORMAL'];
                if (b === 'MODERATE') return ['STRONG', 'MODERATE', 'WEAK'];
                if (b === 'NORMAL') return ['HIGH', 'NORMAL', 'LOW'];
                return [b];
            };

            const getRegimesForCompressed = (compressed: string) => {
                if (compressed === 'TREND') return ['TRENDING_STRONG', 'TRENDING_WEAK'];
                if (compressed === 'VOLATILE') return ['VOLATILE', 'EVENT_DRIVEN'];
                return ['RANGE'];
            };

            const fuzzyQuery = {
                regime: { $in: getRegimesForCompressed(compressRegime(regime)) },
                alignmentBucket,
                adxBucket: { $in: getAdjacent(adxBucket) },
                volumeBucket: { $in: getAdjacent(volumeBucket) },
                status: { $ne: SignalStatus.PENDING }
            };

            const fuzzyResolved = await SignalRecord.find(fuzzyQuery).lean();
            if (fuzzyResolved.length > sampleSize) {
                resolved = fuzzyResolved;
                sampleSize = resolved.length;
                isFuzzy = true;
            }
        }

        if (sampleSize === 0) {
            return {
                available: false,
                conditionHash: hash,
                conditionLabel,
                sampleSize: 0,
                winRate: 0,
                avgWinPnl: 0,
                avgLossPnl: 0,
                expectancy: 0,
                reliable: false,
                message: `No historical data for condition: ${conditionLabel}`,
            };
        }

        const wins = resolved.filter(s => s.status === SignalStatus.TARGET_HIT);
        const losses = resolved.filter(s => s.status === SignalStatus.STOP_HIT);
        const winRate = Math.round((wins.length / sampleSize) * 100);

        // Risk #3: Use median for small samples (<150), mean for large samples
        const USE_MEDIAN_THRESHOLD = 150;
        let effectiveWinPnl: number;
        let effectiveLossPnl: number;

        if (sampleSize < USE_MEDIAN_THRESHOLD) {
            // Median-based: resistant to outlier wins/losses
            effectiveWinPnl = calcMedian(wins.map(s => s.pnlPercent || 0));
            effectiveLossPnl = Math.abs(calcMedian(losses.map(s => s.pnlPercent || 0)));
        } else {
            // Mean-based: accurate with sufficient data
            effectiveWinPnl = wins.length > 0
                ? wins.reduce((sum, s) => sum + (s.pnlPercent || 0), 0) / wins.length
                : 0;
            effectiveLossPnl = losses.length > 0
                ? Math.abs(losses.reduce((sum, s) => sum + (s.pnlPercent || 0), 0) / losses.length)
                : 0;
        }

        // Expectancy = (WR × Win) - (LR × Loss)
        const wr = winRate / 100;
        const expectancy = (wr * effectiveWinPnl) - ((1 - wr) * effectiveLossPnl);

        // Risk #2: Regime diversity guard — require at least 2 directional regimes
        const hasDirectionDiversity = checkDirectionDiversity(resolved);
        const hasSufficientSamples = sampleSize >= MIN_SAMPLES_FOR_EMPIRICAL;
        const reliable = hasSufficientSamples && hasDirectionDiversity;

        const expectancyMethod = sampleSize < USE_MEDIAN_THRESHOLD ? 'median' : 'mean';
        let reliabilityNote = '';
        if (hasSufficientSamples && !hasDirectionDiversity) {
            reliabilityNote = ' (⚠️ lacks direction diversity — all same direction)';
        }

        return {
            available: true,
            conditionHash: hash,
            conditionLabel,
            sampleSize,
            winRate,
            avgWinPnl: Number(effectiveWinPnl.toFixed(2)),
            avgLossPnl: Number(effectiveLossPnl.toFixed(2)),
            expectancy: Number(expectancy.toFixed(3)),
            reliable,
            message: reliable
                ? `Empirical probability from ${sampleSize} samples${isFuzzy ? ' (Fuzzy Match)' : ''}: ${winRate}% win rate (expectancy[${expectancyMethod}]: ${expectancy.toFixed(3)}%)`
                : `Low reliability (${sampleSize}/${MIN_SAMPLES_FOR_EMPIRICAL} samples). Win rate ${winRate}%${reliabilityNote}. Expectancy[${expectancyMethod}]: ${expectancy.toFixed(3)}%`,
        };
    } catch (error) {
        logger.error({ err: error }, `[SignalTracker] Error fetching empirical probability for ${conditionLabel}`);
        return {
            available: false,
            conditionHash: hash,
            conditionLabel,
            sampleSize: 0,
            winRate: 0,
            avgWinPnl: 0,
            avgLossPnl: 0,
            expectancy: 0,
            reliable: false,
            message: `Error fetching empirical data: ${error}`,
        };
    }
}

/**
 * Get overall signal statistics (enhanced with Phase A condition hash data)
 */
export async function getSignalStats(): Promise<{
    total: number;
    resolved: number;
    pending: number;
    winRate: number;
    avgPnl: number;
    byRegime: WinRateResult[];
    byConfidenceBucket: { bucket: string; total: number; winRate: number; avgPnl: number }[];
    byConditionHash: { hash: string; label: string; total: number; winRate: number; avgPnl: number; reliable: boolean }[];
    conditionHashCoverage: { totalHashes: number; reliableHashes: number; minSamplesRequired: number };
    ready: boolean;      // true when 300+ resolved signals exist
}> {
    try {
        const total = await SignalRecord.countDocuments();
        const pending = await SignalRecord.countDocuments({ status: SignalStatus.PENDING });
        const resolved = total - pending;

        // Overall win rate
        const wins = await SignalRecord.countDocuments({ status: SignalStatus.TARGET_HIT });
        const winRate = resolved > 0 ? Math.round((wins / resolved) * 100) : 0;

        // Average PnL
        const pnlResult = await SignalRecord.aggregate([
            { $match: { pnlPercent: { $exists: true, $ne: null } } },
            { $group: { _id: null, avg: { $avg: '$pnlPercent' } } }
        ]);
        const avgPnl = Math.round((pnlResult[0]?.avg || 0) * 100) / 100;

        // By regime
        const byRegime = await getConditionWinRates();

        // By confidence bucket (5% buckets)
        const bucketResults = await SignalRecord.aggregate([
            { $match: { status: { $ne: SignalStatus.PENDING } } },
            {
                $bucket: {
                    groupBy: '$confidence',
                    boundaries: [0, 30, 40, 50, 55, 60, 65, 70, 75, 80, 85, 90, 100],
                    default: 'other',
                    output: {
                        total: { $sum: 1 },
                        wins: { $sum: { $cond: [{ $eq: ['$status', SignalStatus.TARGET_HIT] }, 1, 0] } },
                        avgPnl: { $avg: '$pnlPercent' },
                    }
                }
            }
        ]);

        const byConfidenceBucket = bucketResults.map(b => ({
            bucket: b._id === 'other' ? 'other' : `${b._id}-${b._id + 5}`,
            total: b.total,
            winRate: b.total > 0 ? Math.round((b.wins / b.total) * 100) : 0,
            avgPnl: Math.round((b.avgPnl || 0) * 100) / 100,
        }));

        // Phase A: Condition hash statistics
        const hashResults = await SignalRecord.aggregate([
            { $match: { status: { $ne: SignalStatus.PENDING }, conditionHash: { $exists: true } } },
            {
                $group: {
                    _id: { hash: '$conditionHash', regime: '$regime', alignBucket: '$alignmentBucket', adxBucket: '$adxBucket', volBucket: '$volumeBucket' },
                    total: { $sum: 1 },
                    wins: { $sum: { $cond: [{ $eq: ['$status', SignalStatus.TARGET_HIT] }, 1, 0] } },
                    avgPnl: { $avg: '$pnlPercent' },
                }
            },
            { $sort: { total: -1 } },
            { $limit: 20 }
        ]);

        const byConditionHash = hashResults.map(r => ({
            hash: r._id.hash || 'unknown',
            label: `${r._id.regime || ''}|${r._id.alignBucket || ''}|${r._id.adxBucket || ''}|${r._id.volBucket || ''}`,
            total: r.total,
            winRate: r.total > 0 ? Math.round((r.wins / r.total) * 100) : 0,
            avgPnl: Math.round((r.avgPnl || 0) * 100) / 100,
            reliable: r.total >= MIN_SAMPLES_FOR_EMPIRICAL,
        }));

        const totalHashes = hashResults.length;
        const reliableHashes = byConditionHash.filter(h => h.reliable).length;

        return {
            total,
            resolved,
            pending,
            winRate,
            avgPnl,
            byRegime,
            byConfidenceBucket,
            byConditionHash,
            conditionHashCoverage: {
                totalHashes,
                reliableHashes,
                minSamplesRequired: MIN_SAMPLES_FOR_EMPIRICAL,
            },
            ready: resolved >= 300,
        };
    } catch (error) {
        logger.error({ err: error }, '[SignalTracker] Error fetching stats');
        return {
            total: 0,
            resolved: 0,
            pending: 0,
            winRate: 0,
            avgPnl: 0,
            byRegime: [],
            byConfidenceBucket: [],
            byConditionHash: [],
            conditionHashCoverage: { totalHashes: 0, reliableHashes: 0, minSamplesRequired: MIN_SAMPLES_FOR_EMPIRICAL },
            ready: false,
        };
    }
}
