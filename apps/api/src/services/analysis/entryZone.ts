/**
 * Entry Zone Calculator
 * Takes SMC output + ATR → produces exact trade levels with risk management.
 * 
 * Entry priority: Liquidity Sweep > Order Block (FVG removed — unreliable on NSE)
 * Stop Loss: OB edge ± 1.2×ATR buffer
 * Targets: Nearest unfilled FVG or swing high/low, 2×ATR extension
 * Hard rule: R:R < 1:2 → isValid = false
 * 
 * @module @stock-assist/api/services/analysis/entryZone
 */

import type {
    SMCAnalysis,
    EntryZone,
    SwingPoint,
    OrderBlock,
    FairValueGap,
    LiquiditySweep,
} from '@stock-assist/shared';
import { calculateRoundTripCostPercent } from '@stock-assist/shared';

// ═══════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════

/** Minimum GROSS Risk:Reward ratio required for a valid signal */
const MIN_RISK_REWARD = 2.0;

/** Minimum NET Risk:Reward (after transaction costs) for a valid signal */
const MIN_NET_RISK_REWARD = 1.5;

/** ATR multiplier for stop loss buffer beyond OB edge (NSE-calibrated: 9,433 trade backtest) */
const SL_ATR_BUFFER = 1.2;

/** ATR multiplier for Target 2 extension */
const T2_ATR_EXTENSION = 2.0;

/** FVG must be within this many ATRs of current price to be used as entry */
const FVG_PROXIMITY_ATR = 1.0;

/** Fallback Target 1 distance if no FVG/swing exists */
const FALLBACK_T1_ATR = 1.5;

// ═══════════════════════════════════════════════════════════════
// MAIN CALCULATOR
// ═══════════════════════════════════════════════════════════════

/**
 * Calculate entry zone, stop loss, and targets from SMC analysis.
 * Returns null if no qualifying zone exists.
 * Returns { isValid: false } if a zone exists but R:R < 1:2.
 */
export function calculateEntryZone(
    smc: SMCAnalysis,
    currentPrice: number,
    atr: number,
    direction: 'bullish' | 'bearish'
): EntryZone | null {
    if (atr <= 0 || currentPrice <= 0) return null;

    // Try each entry trigger in priority order (FVG removed — unreliable on NSE)
    const fromSweep = tryLiquiditySweepEntry(smc.liquiditySweeps, direction);
    const fromOB = tryOrderBlockEntry(smc.orderBlocks, currentPrice, direction);

    // Pick the highest-priority available entry
    let entryZoneLow: number;
    let entryZoneHigh: number;
    let entryTrigger: EntryZone['entryTrigger'];
    let slAnchor: number; // The price used as the SL reference

    if (fromSweep) {
        entryZoneLow = fromSweep.low;
        entryZoneHigh = fromSweep.high;
        entryTrigger = 'LiquiditySweep';
        slAnchor = direction === 'bullish' ? fromSweep.low : fromSweep.high;
    } else if (fromOB) {
        entryZoneLow = fromOB.low;
        entryZoneHigh = fromOB.high;
        entryTrigger = 'OrderBlock';
        slAnchor = direction === 'bullish' ? fromOB.low : fromOB.high;
    } else {
        return null; // No qualifying zone found
    }

    // Calculate stop loss with ATR buffer
    const stopLoss = direction === 'bullish'
        ? Number((slAnchor - atr * SL_ATR_BUFFER).toFixed(2))
        : Number((slAnchor + atr * SL_ATR_BUFFER).toFixed(2));

    const entryMid = (entryZoneLow + entryZoneHigh) / 2;

    // Calculate targets
    const target1 = calculateTarget1(smc, entryMid, atr, direction);
    const target2 = calculateTarget2(entryMid, atr, direction);

    // Calculate Risk:Reward (gross)
    const risk = direction === 'bullish'
        ? entryMid - stopLoss
        : stopLoss - entryMid;
    const reward = direction === 'bullish'
        ? target1 - entryMid
        : entryMid - target1;

    const riskReward = risk > 0 ? Number((reward / risk).toFixed(2)) : 0;

    // Net R:R after transaction costs
    const costPercent = calculateRoundTripCostPercent();
    const grossRewardPercent = (reward / entryMid) * 100;
    const grossRiskPercent = (risk / entryMid) * 100;
    const netReward = grossRewardPercent - costPercent;
    const netRisk = grossRiskPercent + costPercent;
    const netRiskReward = netReward > 0 && netRisk > 0
        ? Number((netReward / netRisk).toFixed(2))
        : 0;

    // Valid only if BOTH gross R:R AND net R:R pass their thresholds
    const isValid = riskReward >= MIN_RISK_REWARD && netRiskReward >= MIN_NET_RISK_REWARD;

    return {
        entryZoneLow: Number(entryZoneLow.toFixed(2)),
        entryZoneHigh: Number(entryZoneHigh.toFixed(2)),
        stopLoss,
        target1: Number(target1.toFixed(2)),
        target2: Number(target2.toFixed(2)),
        riskReward,
        isValid,
        entryTrigger,
    };
}

// ═══════════════════════════════════════════════════════════════
// ENTRY TRIGGERS (Priority Order)
// ═══════════════════════════════════════════════════════════════

/**
 * Priority 1: Liquidity Sweep entry.
 * Entry zone = sweep candle extreme → sweep candle close.
 */
function tryLiquiditySweepEntry(
    sweeps: LiquiditySweep[],
    direction: 'bullish' | 'bearish'
): { low: number; high: number } | null {
    // Use the most recent confirmed sweep in the desired direction
    const confirmed = sweeps
        .filter(s => s.type === direction && s.confirmed)
        .sort((a, b) => b.index - a.index);

    if (confirmed.length === 0) return null;

    const sweep = confirmed[0];
    if (direction === 'bullish') {
        return { low: sweep.sweepExtreme, high: sweep.closePrice };
    } else {
        return { low: sweep.closePrice, high: sweep.sweepExtreme };
    }
}

/**
 * Priority 2: Order Block entry.
 * Uses the most recent unmitigated OB in the desired direction.
 */
function tryOrderBlockEntry(
    orderBlocks: OrderBlock[],
    currentPrice: number,
    direction: 'bullish' | 'bearish'
): { low: number; high: number } | null {
    // Filter for unmitigated OBs in the right direction, sorted by most recent
    const candidates = orderBlocks
        .filter(ob => ob.type === direction && ob.status === 'unmitigated')
        .sort((a, b) => a.age - b.age); // Most recent first (lowest age)

    if (candidates.length === 0) return null;

    // Use the most recent unmitigated OB
    const ob = candidates[0];
    return { low: ob.zone.low, high: ob.zone.high };
}

/**
 * Priority 3: Fair Value Gap entry.
 * Only use FVGs within 1×ATR of current price.
 */
function tryFVGEntry(
    fvgs: FairValueGap[],
    currentPrice: number,
    atr: number,
    direction: 'bullish' | 'bearish'
): { low: number; high: number } | null {
    const maxDistance = atr * FVG_PROXIMITY_ATR;

    // Unfilled FVGs in the right direction, within proximity
    const candidates = fvgs
        .filter(f => {
            if (f.filled || f.type !== direction) return false;
            const zoneMid = (f.zone.high + f.zone.low) / 2;
            return Math.abs(zoneMid - currentPrice) <= maxDistance;
        })
        .sort((a, b) => b.createdAtIndex - a.createdAtIndex); // Most recent first

    if (candidates.length === 0) return null;
    return { low: candidates[0].zone.low, high: candidates[0].zone.high };
}

// ═══════════════════════════════════════════════════════════════
// TARGET CALCULATIONS
// ═══════════════════════════════════════════════════════════════

/**
 * Calculate Target 1: nearest unfilled FVG or swing point in the trade direction.
 * Fallback: entry midpoint + 1.5×ATR.
 */
function calculateTarget1(
    smc: SMCAnalysis,
    entryMid: number,
    atr: number,
    direction: 'bullish' | 'bearish'
): number {
    // Try unfilled FVGs above entry (bullish) or below entry (bearish)
    const targetFVGs = smc.fairValueGaps.filter(f => {
        if (f.filled) return false;
        if (direction === 'bullish') {
            return f.zone.low > entryMid; // FVG above entry
        } else {
            return f.zone.high < entryMid; // FVG below entry
        }
    });

    if (targetFVGs.length > 0) {
        // Nearest FVG to entry
        targetFVGs.sort((a, b) => {
            const distA = direction === 'bullish'
                ? a.zone.low - entryMid
                : entryMid - a.zone.high;
            const distB = direction === 'bullish'
                ? b.zone.low - entryMid
                : entryMid - b.zone.high;
            return distA - distB;
        });
        return direction === 'bullish'
            ? targetFVGs[0].zone.low
            : targetFVGs[0].zone.high;
    }

    // Try swing points as target
    const targetSwings = smc.swingPoints.filter(s => {
        if (direction === 'bullish') {
            return s.type === 'high' && s.price > entryMid;
        } else {
            return s.type === 'low' && s.price < entryMid;
        }
    });

    if (targetSwings.length > 0) {
        targetSwings.sort((a, b) => {
            const distA = Math.abs(a.price - entryMid);
            const distB = Math.abs(b.price - entryMid);
            return distA - distB;
        });
        return targetSwings[0].price;
    }

    // Fallback: 1.5×ATR from entry
    return direction === 'bullish'
        ? entryMid + atr * FALLBACK_T1_ATR
        : entryMid - atr * FALLBACK_T1_ATR;
}

/**
 * Calculate Target 2: 2.0×ATR extension from entry midpoint.
 */
function calculateTarget2(
    entryMid: number,
    atr: number,
    direction: 'bullish' | 'bearish'
): number {
    return direction === 'bullish'
        ? entryMid + atr * T2_ATR_EXTENSION
        : entryMid - atr * T2_ATR_EXTENSION;
}
