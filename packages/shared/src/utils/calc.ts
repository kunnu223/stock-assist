/**
 * Calculation Utilities
 * @module @stock-assist/shared/utils/calc
 */

import { TRADING } from '../constants/trading';

/** Calculate position size based on risk */
export const calcPositionSize = (
    entry: number,
    stopLoss: number,
    maxRisk: number = TRADING.MAX_RISK
): number => {
    const riskPerShare = Math.abs(entry - stopLoss);
    if (riskPerShare === 0) return 0;

    const shares = Math.floor(maxRisk / riskPerShare);
    const positionValue = shares * entry;
    const maxPosition = TRADING.CAPITAL * (TRADING.MAX_POSITION_PERCENT / 100);

    return positionValue > maxPosition
        ? Math.floor(maxPosition / entry)
        : shares;
};

/** Calculate risk-reward ratio */
export const calcRiskReward = (
    entry: number,
    stopLoss: number,
    target: number
): number => {
    const risk = Math.abs(entry - stopLoss);
    const reward = Math.abs(target - entry);
    return risk === 0 ? 0 : parseFloat((reward / risk).toFixed(2));
};

/** Calculate profit/loss */
export const calcPnL = (
    entry: number,
    exit: number,
    qty: number,
    direction: 'LONG' | 'SHORT'
): number => {
    return direction === 'LONG'
        ? (exit - entry) * qty
        : (entry - exit) * qty;
};

/** Calculate win rate */
export const calcWinRate = (wins: number, total: number): number => {
    return total === 0 ? 0 : parseFloat(((wins / total) * 100).toFixed(2));
};

/** Calculate profit factor */
export const calcProfitFactor = (gross: number, losses: number): number => {
    return losses === 0 ? (gross > 0 ? Infinity : 0) : parseFloat((gross / Math.abs(losses)).toFixed(2));
};
