/**
 * Trade Types - Trade journal and performance types
 * @module @stock-assist/shared/types/trade
 */

/** Trade direction */
export type Direction = 'LONG' | 'SHORT';

/** Trade status */
export type TradeStatus = 'OPEN' | 'CLOSED' | 'CANCELLED';

/** Trade entry */
export interface Trade {
    id: string;
    stock: string;
    direction: Direction;
    quantity: number;
    entryPrice: number;
    entryDate: string;
    entryReason: string;
    exitPrice?: number;
    exitDate?: string;
    exitReason?: string;
    profitLoss?: number;
    profitLossPercent?: number;
    pattern?: string;
    scenario: 'bullish' | 'bearish';
    aiScore?: number;
    status: TradeStatus;
    notes?: string;
}

/** Pattern performance stats */
export interface PatternStats {
    pattern: string;
    trades: number;
    wins: number;
    losses: number;
    winRate: number;
    totalPnL: number;
}

/** Overall performance metrics */
export interface Performance {
    totalTrades: number;
    wins: number;
    losses: number;
    winRate: number;
    totalPnL: number;
    avgWin: number;
    avgLoss: number;
    profitFactor: number;
    largestWin: number;
    largestLoss: number;
    patternStats: PatternStats[];
}
