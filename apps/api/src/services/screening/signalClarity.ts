/**
 * Signal Clarity Scoring Engine
 * 
 * Multi-indicator confluence system that scores how clearly
 * all technical indicators agree on a direction (bullish/bearish).
 * 
 * High clarity = strong agreement = more predictable stock
 * Low clarity = conflicting signals = skip it
 */

import type { OHLCData } from '@stock-assist/shared';
import { calcRSI } from '../indicators/rsi';
import { calcMA, calcEMA } from '../indicators/ma';
import { calcMACD } from '../indicators/volume';
import { calcBollingerBands } from '../indicators/bollinger';
import { analyzeVolume } from '../indicators/volume';
import { detectTrend } from '../patterns/trend';

// ─── Types ──────────────────────────────────────────────

export type SignalDirection = 'bullish' | 'bearish';

export interface IndicatorSignal {
    name: string;
    direction: SignalDirection | 'neutral';
    strength: number;  // 0-100 how strong this signal is
    detail: string;    // Human-readable explanation
}

export interface SignalClarityResult {
    symbol: string;
    direction: SignalDirection;
    clarityScore: number;         // 0-100: how strongly indicators agree
    weightedScore: number;        // 0-100: weighted clarity considering signal strengths
    signals: IndicatorSignal[];   // Individual indicator signals
    agreementRatio: string;       // e.g. "5/6" — how many agree
    summary: string;              // e.g. "Strong Bullish (5/6 indicators agree)"
    // Enhanced fields
    signalAge: number;            // 1-3: how many consecutive days the signal persists
    signalStrength: 'weak' | 'moderate' | 'strong';  // Human-readable persistence
    volumeConfirmed: boolean;     // Whether volume validates the move
    indicatorVotes: {
        bullish: number;
        bearish: number;
        neutral: number;
    };
}

// ─── Indicator Weights ──────────────────────────────────

const WEIGHTS = {
    rsi: 0.20,        // 20%
    macd: 0.20,       // 20%
    maTrend: 0.20,    // 20%
    bollinger: 0.15,  // 15%
    volume: 0.10,     // 10%
    trend: 0.15,      // 15%
};

// ─── Individual Signal Analyzers ────────────────────────

/**
 * RSI Signal: momentum direction
 */
const analyzeRSI = (prices: number[]): IndicatorSignal => {
    const rsiResult = calcRSI(prices);
    const rsi = rsiResult.value;

    let direction: IndicatorSignal['direction'] = 'neutral';
    let strength = 0;

    if (rsi >= 55) {
        direction = 'bullish';
        strength = Math.min(100, (rsi - 55) * 4 + 50); // 55→50%, 67→98%
    } else if (rsi <= 45) {
        direction = 'bearish';
        strength = Math.min(100, (45 - rsi) * 4 + 50);
    } else {
        strength = 30; // Weak neutral
    }

    return {
        name: 'RSI',
        direction,
        strength: Math.round(strength),
        detail: `RSI ${rsi.toFixed(1)} — ${rsiResult.interpretation}`,
    };
};

/**
 * MACD Signal: trend momentum
 */
const analyzeMACD = (prices: number[]): IndicatorSignal => {
    const macd = calcMACD(prices);

    let direction: IndicatorSignal['direction'] = 'neutral';
    let strength = 0;

    if (macd.histogram > 0 && macd.macd > 0) {
        direction = 'bullish';
        strength = Math.min(100, Math.abs(macd.histogram) * 20 + 60);
    } else if (macd.histogram < 0 && macd.macd < 0) {
        direction = 'bearish';
        strength = Math.min(100, Math.abs(macd.histogram) * 20 + 60);
    } else if (macd.histogram > 0) {
        direction = 'bullish';
        strength = 40; // Histogram positive but MACD negative = early bullish
    } else if (macd.histogram < 0) {
        direction = 'bearish';
        strength = 40;
    } else {
        strength = 20;
    }

    return {
        name: 'MACD',
        direction,
        strength: Math.round(strength),
        detail: `MACD ${macd.macd.toFixed(2)}, Hist ${macd.histogram.toFixed(2)} — ${macd.trend}`,
    };
};

/**
 * Moving Average Trend Signal: price vs SMA alignment
 */
const analyzeMATrend = (prices: number[]): IndicatorSignal => {
    const ma = calcMA(prices);
    const current = prices[prices.length - 1];

    let direction: IndicatorSignal['direction'] = 'neutral';
    let strength = 0;

    const above20 = current > ma.sma20;
    const above50 = current > ma.sma50;
    const sma20Above50 = ma.sma20 > ma.sma50;
    const ema9Above21 = ma.ema9 > ma.ema21;

    // Count bullish alignment signals
    const bullishCount = [above20, above50, sma20Above50, ema9Above21].filter(Boolean).length;

    if (bullishCount >= 3) {
        direction = 'bullish';
        strength = bullishCount === 4 ? 90 : 65;
    } else if (bullishCount <= 1) {
        direction = 'bearish';
        strength = bullishCount === 0 ? 90 : 65;
    } else {
        strength = 30;
    }

    return {
        name: 'MA Trend',
        direction,
        strength: Math.round(strength),
        detail: `Price ${above20 ? '>' : '<'} SMA20 ${above50 ? '>' : '<'} SMA50 — ${ma.trend}`,
    };
};

/**
 * Bollinger Bands Signal: price position within bands
 */
const analyzeBollinger = (prices: number[]): IndicatorSignal => {
    const bb = calcBollingerBands(prices);

    let direction: IndicatorSignal['direction'] = 'neutral';
    let strength = 0;

    if (bb.percentB > 0.7) {
        direction = 'bullish';
        strength = Math.min(100, (bb.percentB - 0.5) * 200);
    } else if (bb.percentB < 0.3) {
        direction = 'bearish';
        strength = Math.min(100, (0.5 - bb.percentB) * 200);
    } else {
        strength = 25;
    }

    return {
        name: 'Bollinger',
        direction,
        strength: Math.round(strength),
        detail: `%B ${bb.percentB.toFixed(3)}, Position: ${bb.position}`,
    };
};

/**
 * Volume Signal: confirms price direction
 */
const analyzeVolumeSignal = (data: OHLCData[]): IndicatorSignal => {
    const vol = analyzeVolume(data);
    const latest = data[data.length - 1];
    const prev = data[data.length - 2];
    const priceUp = latest.close > prev.close;

    let direction: IndicatorSignal['direction'] = 'neutral';
    let strength = 0;

    if (vol.ratio >= 1.2) {
        // Above-average volume
        direction = priceUp ? 'bullish' : 'bearish';
        strength = Math.min(100, (vol.ratio - 1) * 100);
    } else if (vol.ratio >= 0.8) {
        // Normal volume — weak signal
        direction = priceUp ? 'bullish' : 'bearish';
        strength = 30;
    } else {
        // Below average — no conviction
        strength = 15;
    }

    return {
        name: 'Volume',
        direction,
        strength: Math.round(strength),
        detail: `${vol.ratio.toFixed(2)}x avg volume — ${vol.trend}`,
    };
};

/**
 * Trend Signal: linear regression direction
 */
const analyzeTrendSignal = (data: OHLCData[]): IndicatorSignal => {
    const trend = detectTrend(data);

    let direction: IndicatorSignal['direction'] = 'neutral';
    let strength = 0;

    if (trend.direction === 'uptrend') {
        direction = 'bullish';
        strength = Math.min(100, trend.strength);
    } else if (trend.direction === 'downtrend') {
        direction = 'bearish';
        strength = Math.min(100, trend.strength);
    } else {
        direction = 'neutral';
        strength = trend.consolidating ? 10 : 20;
    }

    return {
        name: 'Trend',
        direction,
        strength: Math.round(strength),
        detail: `${trend.direction}, strength ${trend.strength}${trend.consolidating ? ' (consolidating)' : ''}`,
    };
};

// ─── Main Scoring Function ──────────────────────────────

/**
 * Internal: Calculate signal clarity for a data slice (no persistence check).
 * Used both for current data and for historical persistence checks.
 */
const calculateClarityForSlice = (
    symbol: string,
    data: OHLCData[]
): { direction: SignalDirection; clarityScore: number; weightedScore: number; signals: IndicatorSignal[]; bullishVotes: number; bearishVotes: number; neutralVotes: number } | null => {
    if (data.length < 26) return null;

    const prices = data.map(d => d.close);

    const signals: IndicatorSignal[] = [
        analyzeRSI(prices),
        analyzeMACD(prices),
        analyzeMATrend(prices),
        analyzeBollinger(prices),
        analyzeVolumeSignal(data),
        analyzeTrendSignal(data),
    ];

    const bullishVotes = signals.filter(s => s.direction === 'bullish').length;
    const bearishVotes = signals.filter(s => s.direction === 'bearish').length;
    const neutralVotes = signals.filter(s => s.direction === 'neutral').length;

    const direction: SignalDirection = bullishVotes >= bearishVotes ? 'bullish' : 'bearish';
    const majorityVotes = Math.max(bullishVotes, bearishVotes);
    const rawClarity = (majorityVotes / signals.length) * 100;

    const weights = [WEIGHTS.rsi, WEIGHTS.macd, WEIGHTS.maTrend, WEIGHTS.bollinger, WEIGHTS.volume, WEIGHTS.trend];
    let weightedScore = 0;

    for (let i = 0; i < signals.length; i++) {
        if (signals[i].direction === direction) {
            weightedScore += weights[i] * signals[i].strength;
        } else if (signals[i].direction === 'neutral') {
            weightedScore += weights[i] * 10;
        }
    }

    return {
        direction,
        clarityScore: Math.round(rawClarity),
        weightedScore: Math.round(weightedScore),
        signals,
        bullishVotes,
        bearishVotes,
        neutralVotes,
    };
};

/**
 * Calculate signal persistence (signalAge).
 * Checks if the majority direction is consistent across the last 1-3 days.
 * signalAge = 3 means the signal has been consistent for 3 days (strongest).
 */
const calculateSignalAge = (
    symbol: string,
    data: OHLCData[],
    currentDirection: SignalDirection
): number => {
    let age = 1; // Today always counts

    // Check yesterday (data ending at [-2])
    if (data.length >= 28) {
        const yesterdayData = data.slice(0, -1);
        const result = calculateClarityForSlice(symbol, yesterdayData);
        if (result && result.direction === currentDirection && result.clarityScore >= MIN_CLARITY_THRESHOLD) {
            age = 2;

            // Check 2 days ago (data ending at [-3])
            if (data.length >= 29) {
                const twoDaysAgoData = data.slice(0, -2);
                const result2 = calculateClarityForSlice(symbol, twoDaysAgoData);
                if (result2 && result2.direction === currentDirection && result2.clarityScore >= MIN_CLARITY_THRESHOLD) {
                    age = 3;
                }
            }
        }
    }

    return age;
};

/**
 * Calculate signal clarity for a stock.
 * Returns null if data is insufficient.
 * Includes signal persistence (signalAge) and volume confirmation.
 */
export const calculateSignalClarity = (
    symbol: string,
    data: OHLCData[]
): SignalClarityResult | null => {
    const result = calculateClarityForSlice(symbol, data);
    if (!result) return null;

    const { direction, clarityScore, weightedScore, signals, bullishVotes, bearishVotes, neutralVotes } = result;
    const majorityVotes = Math.max(bullishVotes, bearishVotes);

    // Signal persistence: check if direction was consistent 1-3 days ago
    const signalAge = calculateSignalAge(symbol, data, direction);
    const signalStrength: 'weak' | 'moderate' | 'strong' =
        signalAge === 3 ? 'strong' : signalAge === 2 ? 'moderate' : 'weak';

    // Volume confirmation
    const volumeSignal = signals.find(s => s.name === 'Volume');
    const volumeConfirmed = volumeSignal?.direction !== 'neutral' && (volumeSignal?.strength ?? 0) >= 30;

    // Build summary
    const agreementStr = `${majorityVotes}/${signals.length}`;
    let clarityLabel: string;
    if (majorityVotes >= 5) clarityLabel = 'Strong';
    else if (majorityVotes === 4) clarityLabel = 'Moderate';
    else clarityLabel = 'Weak';

    const persistStr = signalAge >= 2 ? ` [${signalAge}-day signal]` : '';
    const summary = `${clarityLabel} ${direction === 'bullish' ? '↑ Bullish' : '↓ Bearish'} (${agreementStr} indicators agree)${persistStr}`;

    return {
        symbol,
        direction,
        clarityScore,
        weightedScore,
        signals,
        agreementRatio: agreementStr,
        summary,
        signalAge,
        signalStrength,
        volumeConfirmed,
        indicatorVotes: {
            bullish: bullishVotes,
            bearish: bearishVotes,
            neutral: neutralVotes,
        },
    };
};

/**
 * Minimum clarity threshold to be included in top 10
 * At least 4 out of 6 indicators must agree (67%)
 */
export const MIN_CLARITY_THRESHOLD = 67;
