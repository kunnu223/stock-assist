/**
 * API Types - Request and response types
 * @module @stock-assist/shared/types/api
 */

/** Base API response */
export interface ApiResponse<T> {
    success: boolean;
    data?: T;
    error?: string;
    code?: string;
}

/** Analyze single stock request */
export interface AnalyzeSingleRequest {
    symbol: string;
}

/** Save trade request */
export interface SaveTradeRequest {
    stock: string;
    direction: 'LONG' | 'SHORT';
    quantity: number;
    entryPrice: number;
    entryDate: string;
    entryReason: string;
    exitPrice?: number;
    exitDate?: string;
    exitReason?: string;
    pattern?: string;
    scenario: 'bullish' | 'bearish';
    notes?: string;
}

/** Watchlist update request */
export interface WatchlistRequest {
    symbol: string;
}

/** Analytics query params */
export interface AnalyticsQuery {
    period?: 'week' | 'month' | 'all';
}
