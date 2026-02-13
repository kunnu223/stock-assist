/**
 * Risk Metrics Calculator
 * Calculates Expected Return, Sharpe Ratio, and Max Drawdown
 * for trade quality assessment.
 * @module @stock-assist/api/services/analysis/riskMetrics
 */

import type { OHLCData, TechnicalIndicators } from '@stock-assist/shared';

export interface RiskMetrics {
    expectedReturn: number;       // % expected return based on ATR targets
    sharpeRatio: number;          // Risk-adjusted return (annualized)
    maxDrawdown: number;          // Max historical drawdown %
    volatility: number;           // Annualized volatility %
    riskRewardRatio: number;      // Reward / Risk
    winRate: number;              // Estimated win % based on signal strength
}

/**
 * Calculate risk metrics for a stock
 * @param data - OHLC price data
 * @param indicators - Calculated technical indicators
 * @param adjustedConfidence - Final adjusted confidence score (0-100)
 * @param direction - 'bullish' | 'bearish' | 'neutral'
 */
export function calculateRiskMetrics(
    data: OHLCData[],
    indicators: TechnicalIndicators,
    adjustedConfidence: number,
    direction: string
): RiskMetrics {
    if (data.length < 20) {
        return {
            expectedReturn: 0,
            sharpeRatio: 0,
            maxDrawdown: 0,
            volatility: 0,
            riskRewardRatio: 0,
            winRate: 0,
        };
    }

    // 1. Calculate daily returns
    const returns: number[] = [];
    for (let i = 1; i < data.length; i++) {
        returns.push((data[i].close - data[i - 1].close) / data[i - 1].close);
    }

    // 2. Volatility (annualized standard deviation of returns)
    const meanReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - meanReturn, 2), 0) / returns.length;
    const dailyStdDev = Math.sqrt(variance);
    const annualizedVolatility = dailyStdDev * Math.sqrt(252) * 100; // 252 trading days

    // 3. Max Drawdown (peak-to-trough)
    let peak = data[0].close;
    let maxDrawdown = 0;
    for (const bar of data) {
        if (bar.close > peak) peak = bar.close;
        const drawdown = ((peak - bar.close) / peak) * 100;
        if (drawdown > maxDrawdown) maxDrawdown = drawdown;
    }

    // 4. Win Rate estimation from confidence
    // Map adjusted confidence to estimated win rate
    // Conservative mapping: confidence 80 → win rate ~65%, confidence 60 → win rate ~52%
    const winRate = Math.max(40, Math.min(80,
        35 + (adjustedConfidence * 0.5)
    ));

    // 5. ATR-based Expected Return
    const atr = indicators.atr;
    const currentPrice = data[data.length - 1].close;

    // Target = 2x ATR gain, Stop = 1x ATR loss
    const avgGainPercent = (atr * 2 / currentPrice) * 100;
    const avgLossPercent = (atr / currentPrice) * 100;

    // Expected Return = (Win% × AvgGain) − (Loss% × AvgLoss)
    const expectedReturn = (winRate / 100 * avgGainPercent) - ((1 - winRate / 100) * avgLossPercent);

    // 6. Risk-Reward Ratio
    const riskRewardRatio = avgLossPercent > 0 ? avgGainPercent / avgLossPercent : 0;

    // 7. Sharpe Ratio (annualized)
    // Using expected return vs risk-free rate (7% for India)
    const riskFreeRate = 7; // RBI rate ~7%
    const sharpeRatio = annualizedVolatility > 0
        ? (expectedReturn * 252 - riskFreeRate) / annualizedVolatility
        : 0;

    return {
        expectedReturn: Number(expectedReturn.toFixed(2)),
        sharpeRatio: Number(sharpeRatio.toFixed(2)),
        maxDrawdown: Number((-maxDrawdown).toFixed(2)),
        volatility: Number(annualizedVolatility.toFixed(2)),
        riskRewardRatio: Number(riskRewardRatio.toFixed(2)),
        winRate: Number(winRate.toFixed(1)),
    };
}
