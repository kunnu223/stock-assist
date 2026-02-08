/**
 * Technical Pre-Filter Service
 * Filters stocks based on technical criteria to reduce AI analysis load
 */

import type { OHLCData } from '@stock-assist/shared';
import { calcRSI } from '../indicators/rsi';
import { detectTrend } from '../patterns/trend';

export interface PreFilterCriteria {
    minVolumeRatio: number;      // e.g., 1.2 = 120% of average
    minPriceChangePercent: number; // e.g., 1.5 = 1.5%
    rsiRange: { min: number; max: number };
    minTrendStrength: number;     // e.g., 2
}

export interface FilteredStock {
    symbol: string;
    score: number;
    volumeRatio: number;
    priceChange: number;
    rsi: number;
    trendStrength: number;
    passedFilters: string[];
}

/**
 * Calculate volume ratio (current vs 20-day average)
 */
export const calculateVolumeRatio = (history: OHLCData[]): number => {
    if (history.length < 21) return 0;

    const last20Days = history.slice(-21, -1);
    const avgVolume = last20Days.reduce((sum, d) => sum + d.volume, 0) / 20;
    const currentVolume = history[history.length - 1].volume;

    return avgVolume > 0 ? currentVolume / avgVolume : 0;
};

/**
 * Check if stock passes volume filter
 */
export const passesVolumeFilter = (history: OHLCData[], minRatio: number): boolean => {
    const ratio = calculateVolumeRatio(history);
    return ratio >= minRatio;
};

/**
 * Calculate today's price change percentage
 */
export const calculatePriceChange = (history: OHLCData[]): number => {
    if (history.length < 2) return 0;

    const latest = history[history.length - 1];
    const previous = history[history.length - 2];

    return ((latest.close - previous.close) / previous.close) * 100;
};

/**
 * Check if stock passes price movement filter
 */
export const passesPriceMovementFilter = (history: OHLCData[], minChange: number): boolean => {
    const change = Math.abs(calculatePriceChange(history));
    return change >= minChange;
};

/**
 * Check if stock passes RSI filter
 */
export const passesRSIFilter = (history: OHLCData[], range: { min: number; max: number }): boolean => {
    if (history.length < 15) return false;

    const closes = history.map(h => h.close);
    const rsiResult = calcRSI(closes);
    const rsi = rsiResult.value;

    return rsi >= range.min && rsi <= range.max;
};

/**
 * Check if stock passes trend clarity filter
 */
export const passesTrendFilter = (history: OHLCData[], minStrength: number): boolean => {
    if (history.length < 20) return false;

    const trend = detectTrend(history);
    return trend.strength >= minStrength && trend.direction !== 'sideways';
};

/**
 * Calculate overall technical score (0-100)
 */
export const calculateTechnicalScore = (
    volumeRatio: number,
    priceChange: number,
    rsi: number,
    trendStrength: number
): number => {
    // Normalize each metric to 0-25 scale
    const volumeScore = Math.min(25, (volumeRatio - 1) * 25); // Above 1.0 is good
    const priceScore = Math.min(25, Math.abs(priceChange) * 2); // Up to 12.5% movement
    const rsiScore = rsi > 50 ? (70 - rsi) : (rsi - 30); // Best at 50
    const trendScore = Math.min(25, trendStrength * 5); // Up to strength 5

    return Math.round(volumeScore + priceScore + rsiScore + trendScore);
};

/**
 * Apply all technical filters to a stock
 */
export const applyTechnicalFilters = (
    symbol: string,
    history: OHLCData[],
    criteria: PreFilterCriteria
): FilteredStock | null => {
    if (history.length < 21) {
        return null; // Insufficient data
    }

    const passedFilters: string[] = [];

    // Volume filter
    const volumeRatio = calculateVolumeRatio(history);
    if (volumeRatio < criteria.minVolumeRatio) return null;
    passedFilters.push('volume');

    // Price movement filter
    const priceChange = calculatePriceChange(history);
    if (Math.abs(priceChange) < criteria.minPriceChangePercent) return null;
    passedFilters.push('priceMovement');

    // RSI filter
    const closes = history.map(h => h.close);
    const rsiResult = calcRSI(closes);
    const rsi = rsiResult.value;
    if (rsi < criteria.rsiRange.min || rsi > criteria.rsiRange.max) return null;
    passedFilters.push('rsi');

    // Trend filter
    const trend = detectTrend(history);
    if (trend.strength < criteria.minTrendStrength || trend.direction === 'sideways') return null;
    passedFilters.push('trend');

    // Calculate technical score
    const score = calculateTechnicalScore(volumeRatio, priceChange, rsi, trend.strength);

    return {
        symbol,
        score,
        volumeRatio,
        priceChange,
        rsi,
        trendStrength: trend.strength,
        passedFilters,
    };
};

/**
 * Default filtering criteria
 */
export const DEFAULT_FILTER_CRITERIA: PreFilterCriteria = {
    minVolumeRatio: 1.2,           // 20% above average
    minPriceChangePercent: 1.5,    // 1.5% movement
    rsiRange: { min: 30, max: 70 }, // Exclude extremes
    minTrendStrength: 2,            // Clear trend
};
