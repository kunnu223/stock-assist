/**
 * Signal Composer
 * Takes all engine outputs → produces one complete SignalCard per asset.
 * 
 * Conviction scoring is SEPARATE from the existing confidenceScoring.ts pipeline.
 * This is a parallel, additive scoring system for SMC-based signals.
 * 
 * @module @stock-assist/api/services/analysis/signalComposer
 */

import type {
    SMCAnalysis,
    EntryZone,
    MTFAlignment,
    SignalCard,
} from '@stock-assist/shared';
import type { CandlestickAnalysis } from './candlestick';
import { calculateEntryZone } from './entryZone';

// ═══════════════════════════════════════════════════════════════
// CONVICTION SCORING WEIGHTS
// ═══════════════════════════════════════════════════════════════

/** Maximum points per component — total = 100 */
const CONVICTION = {
    MTF_ALIGNMENT: 25,  // Scale alignmentScore (0–100) → (0–25)
    CHOCH_DAILY: 20,  // CHoCH detected on daily
    UNMITIGATED_OB: 15,  // Unmitigated Order Block present
    LIQUIDITY_SWEEP: 15,  // Confirmed liquidity sweep
    VOLUME_SPIKE: 10,  // Volume > 1.5x average
    FVG_TARGET: 10,  // Unfilled FVG as target exists
    CANDLESTICK: 5,  // Existing candlestick engine alignment
};

/** Minimum conviction score to generate a signal */
const MIN_CONVICTION = 55;

/** Penalty applied in ranging markets (ADX < 20) */
const RANGING_PENALTY = -15;

// ═══════════════════════════════════════════════════════════════
// MAIN COMPOSER
// ═══════════════════════════════════════════════════════════════

export interface ComposeSignalInput {
    ticker: string;
    smc: SMCAnalysis;
    currentPrice: number;
    atr: number;
    adxValue: number;
    volumeRatio: number;
    weeklyTrend: 'bullish' | 'bearish' | 'neutral';
    monthlyTrend: 'bullish' | 'bearish' | 'neutral';
    dailyTrend: 'bullish' | 'bearish' | 'neutral';
    candlestickAnalysis?: CandlestickAnalysis;
}

/**
 * Compose a complete SignalCard from all engine outputs.
 * 
 * The card answers all 5 questions:
 * 1. Is a setup forming?           → SMC detectors
 * 2. Where exactly do I enter?     → Entry Zone Calculator
 * 3. Where is my stop loss?        → Entry Zone Calculator
 * 4. Where is my target?           → Entry Zone Calculator
 * 5. How confident should I be?    → Conviction Score
 */
export function composeSignal(input: ComposeSignalInput): SignalCard {
    const { ticker, smc, currentPrice, atr, adxValue, volumeRatio, weeklyTrend, monthlyTrend, dailyTrend, candlestickAnalysis } = input;

    // === Step 1: Determine signal direction from SMC ===
    const direction = determineDirection(smc, dailyTrend);

    // === Step 2: Build MTF alignment ===
    const mtfAlignment = buildMTFAlignment(weeklyTrend, monthlyTrend, direction, dailyTrend);

    // === Step 3: Calculate entry zone (if direction is set) ===
    let entryZone: EntryZone | null = null;
    if (direction !== 'none') {
        entryZone = calculateEntryZone(smc, currentPrice, atr, direction);
    }

    // === Step 4: Calculate conviction score ===
    const { score, explanation } = calculateConviction(
        smc, mtfAlignment, volumeRatio, adxValue, entryZone, candlestickAnalysis, direction
    );

    // === Step 5: Determine signal status ===
    const status = determineStatus(score, entryZone, currentPrice);

    return {
        ticker,
        direction,
        status,
        convictionScore: score,
        entryZone: status === 'NO_SETUP' ? null : entryZone,
        explanation,
        mtfAlignment,
        smcSummary: {
            trendState: smc.trendState,
            orderBlockCount: smc.orderBlocks.length,
            unmitigatedOBCount: smc.orderBlocks.filter(ob => ob.status === 'unmitigated').length,
            unfilledFVGCount: smc.fairValueGaps.filter(f => !f.filled).length,
            chochDetected: smc.chochEvents.length > 0,
            sweepDetected: smc.liquiditySweeps.filter(s => s.confirmed).length > 0,
        },
    };
}

// ═══════════════════════════════════════════════════════════════
// DIRECTION DETERMINATION
// ═══════════════════════════════════════════════════════════════

/**
 * Determine trade direction from SMC signals.
 * Priority: CHoCH > Liquidity Sweep > BOS > Daily trend fallback.
 */
function determineDirection(
    smc: SMCAnalysis,
    dailyTrend: 'bullish' | 'bearish' | 'neutral'
): 'bullish' | 'bearish' | 'none' {
    // CHoCH takes priority — it's the pre-move signal
    const recentCHoCH = smc.chochEvents
        .filter(c => c.confirmed)
        .sort((a, b) => b.index - a.index);
    if (recentCHoCH.length > 0) {
        return recentCHoCH[0].type;
    }

    // Confirmed liquidity sweep
    const recentSweep = smc.liquiditySweeps
        .filter(s => s.confirmed)
        .sort((a, b) => b.index - a.index);
    if (recentSweep.length > 0) {
        return recentSweep[0].type;
    }

    // Recent BOS (trend continuation)
    const recentBOS = smc.bosEvents.sort((a, b) => b.index - a.index);
    if (recentBOS.length > 0) {
        return recentBOS[0].type;
    }

    // Fallback to daily trend (but not neutral → none)
    if (dailyTrend !== 'neutral') {
        return dailyTrend;
    }

    return 'none';
}

// ═══════════════════════════════════════════════════════════════
// MTF ALIGNMENT
// ═══════════════════════════════════════════════════════════════

/**
 * Build MTF alignment scorecard.
 * Scoring:
 *   +40 pts: Weekly trend matches signal direction
 *   +30 pts: Daily CHoCH/setup matches direction
 *   +20 pts: Unmitigated OB exists (implied by having a direction)
 *   +10 pts: Monthly trend agrees
 */
function buildMTFAlignment(
    weeklyTrend: 'bullish' | 'bearish' | 'neutral',
    monthlyTrend: 'bullish' | 'bearish' | 'neutral',
    signalDirection: 'bullish' | 'bearish' | 'none',
    dailyTrend: 'bullish' | 'bearish' | 'neutral'
): MTFAlignment {
    let score = 0;

    const dailySetup = signalDirection === 'none' ? 'none' : signalDirection;

    if (signalDirection !== 'none') {
        // Weekly trend matches signal
        if (weeklyTrend === signalDirection) score += 40;

        // Daily setup matches direction
        if (dailyTrend === signalDirection || dailySetup === signalDirection) score += 30;

        // OB or SMC setup exists (baseline 20 points for having a direction)
        score += 20;

        // Monthly agrees
        if (monthlyTrend === signalDirection) score += 10;
    }

    return {
        weeklyTrend,
        dailySetup,
        alignmentScore: Math.min(100, score),
        alignmentValid: score >= 60,
    };
}

// ═══════════════════════════════════════════════════════════════
// CONVICTION SCORING
// ═══════════════════════════════════════════════════════════════

/**
 * Calculate the additive conviction score (0–100).
 * This is SEPARATE from confidenceScoring.ts — it does not interfere.
 */
function calculateConviction(
    smc: SMCAnalysis,
    mtf: MTFAlignment,
    volumeRatio: number,
    adxValue: number,
    entryZone: EntryZone | null,
    candlestick: CandlestickAnalysis | undefined,
    direction: 'bullish' | 'bearish' | 'none'
): { score: number; explanation: string[] } {
    let score = 0;
    const explanation: string[] = [];

    if (direction === 'none') {
        return { score: 0, explanation: ['No directional signal detected — no setup'] };
    }

    // 1. MTF Alignment (0–25 pts)
    const mtfPts = Math.round((mtf.alignmentScore / 100) * CONVICTION.MTF_ALIGNMENT);
    score += mtfPts;
    if (mtf.alignmentValid) {
        const matchingTFs: string[] = [];
        if (mtf.weeklyTrend === direction) matchingTFs.push('Weekly');
        if (mtf.dailySetup === direction) matchingTFs.push('Daily');
        explanation.push(`✅ Multi-timeframe alignment (${matchingTFs.join(' + ')}) — ${mtfPts}/${CONVICTION.MTF_ALIGNMENT} pts`);
    } else if (mtfPts > 0) {
        explanation.push(`⚠️ Partial timeframe alignment — ${mtfPts}/${CONVICTION.MTF_ALIGNMENT} pts`);
    }

    // 2. CHoCH on Daily (0 or 20 pts)
    const hasConfirmedCHoCH = smc.chochEvents.some(c => c.confirmed && c.type === direction);
    if (hasConfirmedCHoCH) {
        score += CONVICTION.CHOCH_DAILY;
        const choch = smc.chochEvents.find(c => c.confirmed && c.type === direction)!;
        explanation.push(`✅ Change of Character on Daily — first institutional sign of reversal at ₹${choch.priceAtEvent.toFixed(2)}`);
    }

    // 3. Unmitigated OB (0 or 15 pts)
    const hasUnmitigatedOB = smc.orderBlocks.some(
        ob => ob.type === direction && ob.status === 'unmitigated'
    );
    if (hasUnmitigatedOB) {
        score += CONVICTION.UNMITIGATED_OB;
        const ob = smc.orderBlocks.find(
            ob => ob.type === direction && ob.status === 'unmitigated'
        )!;
        explanation.push(`✅ ${direction === 'bullish' ? 'Bullish' : 'Bearish'} Order Block at ₹${ob.zone.low.toFixed(2)}–₹${ob.zone.high.toFixed(2)} — institutional ${direction === 'bullish' ? 'buy' : 'sell'} zone, unmitigated`);
    }

    // 4. Liquidity Sweep (0 or 15 pts)
    const hasConfirmedSweep = smc.liquiditySweeps.some(
        s => s.type === direction && s.confirmed
    );
    if (hasConfirmedSweep) {
        score += CONVICTION.LIQUIDITY_SWEEP;
        const sweep = smc.liquiditySweeps.find(s => s.type === direction && s.confirmed)!;
        explanation.push(`✅ Liquidity sweep completed ${direction === 'bullish' ? 'below' : 'above'} ₹${sweep.sweepExtreme.toFixed(2)} — smart money absorbed ${direction === 'bullish' ? 'sell' : 'buy'} stops`);
    }

    // 5. Volume spike (0–10 pts, graduated)
    const volumePts = volumeRatio >= 1.5
        ? CONVICTION.VOLUME_SPIKE
        : Math.round((volumeRatio / 1.5) * CONVICTION.VOLUME_SPIKE);
    score += volumePts;
    if (volumeRatio >= 1.5) {
        explanation.push(`✅ Volume ${volumeRatio.toFixed(1)}x average — institutional conviction on the move`);
    } else if (volumeRatio >= 1.0) {
        explanation.push(`⚠️ Volume ${volumeRatio.toFixed(1)}x average — moderate (${volumePts}/${CONVICTION.VOLUME_SPIKE} pts)`);
    }

    // 6. Unfilled FVG as target (0 or 10 pts)
    const hasUnfilledFVG = smc.fairValueGaps.some(f => !f.filled);
    if (hasUnfilledFVG) {
        score += CONVICTION.FVG_TARGET;
        const fvg = smc.fairValueGaps.find(f => !f.filled)!;
        explanation.push(`✅ Unfilled Fair Value Gap at ₹${fvg.zone.low.toFixed(2)}–₹${fvg.zone.high.toFixed(2)} — price historically returns to fill this`);
    }

    // 7. Candlestick pattern alignment (0 or 5 pts)
    if (candlestick && candlestick.patterns.length > 0 && candlestick.dominantBias === direction) {
        score += CONVICTION.CANDLESTICK;
        const patternNames = candlestick.patterns.slice(0, 2).map(p => p.name).join(', ');
        explanation.push(`✅ Candlestick confirmation: ${patternNames} at setup zone`);
    }

    // Ranging market dampener: ADX < 20 → −15 penalty
    if (adxValue < 20) {
        score += RANGING_PENALTY;
        explanation.push(`⚠️ Ranging market (ADX ${adxValue.toFixed(1)}) — conviction reduced by ${Math.abs(RANGING_PENALTY)} pts`);
    }

    // Clamp score
    score = Math.max(0, Math.min(100, score));

    // R:R rejection explanation
    if (entryZone && !entryZone.isValid) {
        explanation.push(`❌ Risk:Reward ${entryZone.riskReward.toFixed(2)} is below minimum 1:2 — setup rejected`);
    }

    return { score, explanation };
}

// ═══════════════════════════════════════════════════════════════
// STATUS DETERMINATION
// ═══════════════════════════════════════════════════════════════

/**
 * Determine the signal status based on conviction, entry zone, and price.
 */
function determineStatus(
    convictionScore: number,
    entryZone: EntryZone | null,
    currentPrice: number
): SignalCard['status'] {
    // Score too low → no setup
    if (convictionScore < MIN_CONVICTION) return 'NO_SETUP';

    // No valid entry zone → no setup
    if (!entryZone || !entryZone.isValid) return 'NO_SETUP';

    // Price is inside the entry zone → active setup
    if (currentPrice >= entryZone.entryZoneLow && currentPrice <= entryZone.entryZoneHigh) {
        return 'SETUP_ACTIVE';
    }

    // Valid setup but price hasn't reached the zone
    return 'WAITING_FOR_ENTRY';
}
