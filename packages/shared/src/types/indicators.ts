/**
 * Technical Indicator Types
 * @module @stock-assist/shared/types/indicators
 */

/** RSI calculation result */
export interface RSIResult {
    value: number;
    interpretation: 'oversold' | 'neutral' | 'overbought';
}

/** Moving average result */
export interface MAResult {
    sma20: number;
    sma50: number;
    sma200: number;
    ema9: number;
    ema21: number;
    trend: 'bullish' | 'bearish' | 'neutral';
}

/** Support and resistance levels */
export interface SRLevels {
    support: number;
    resistance: number;
    pivot: number;
    r1: number;
    r2: number;
    s1: number;
    s2: number;
}

/** Volume analysis result */
export interface VolumeAnalysis {
    current: number;
    average: number;
    ratio: number;
    trend: 'high' | 'normal' | 'low';
}

/** MACD indicator */
export interface MACDResult {
    macd: number;
    signal: number;
    histogram: number;
    trend: 'bullish' | 'bearish' | 'neutral';
    divergence?: 'bullish' | 'bearish' | 'none';
}

/** All technical indicators combined */
export interface TechnicalIndicators {
    rsi: RSIResult;
    ma: MAResult;
    sr: SRLevels;
    volume: VolumeAnalysis;
    macd: MACDResult;
    atr: number;
    vwap?: number;
}
