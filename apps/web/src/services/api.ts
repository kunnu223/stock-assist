/**
 * API Client Service — Centralized HTTP layer for all backend calls.
 * Single source of truth for request/response handling, error formatting,
 * and endpoint configuration. Components should NEVER call fetch() directly.
 * @module @stock-assist/web/services/api
 */

import { API_ENDPOINTS } from '@/constants';
import type {
    AnalysisResponse,
    TopStocksResponse,
    ChartDataResponse,
    ChartRange,
} from '@/types';

// ═══════════════════════════════════════════════════════════════
// CORE HTTP CLIENT
// ═══════════════════════════════════════════════════════════════

class ApiError extends Error {
    constructor(
        message: string,
        public status: number,
        public code?: string,
    ) {
        super(message);
        this.name = 'ApiError';
    }
}

/**
 * Core fetch wrapper with error handling and JSON parsing.
 * All service methods should use this instead of raw fetch().
 */
async function request<T>(url: string, options?: RequestInit): Promise<T> {
    const res = await fetch(url, {
        headers: { 'Content-Type': 'application/json' },
        ...options,
    });

    const data = await res.json();

    if (!res.ok || data.success === false) {
        throw new ApiError(
            data.error || data.message || `Request failed (${res.status})`,
            res.status,
            data.code,
        );
    }

    return data as T;
}

// ═══════════════════════════════════════════════════════════════
// ANALYSIS SERVICE
// ═══════════════════════════════════════════════════════════════

/** Run single stock analysis */
export async function analyzeStock(symbol: string, language: string = 'en'): Promise<AnalysisResponse> {
    return request<AnalysisResponse>(API_ENDPOINTS.ANALYZE_SINGLE, {
        method: 'POST',
        body: JSON.stringify({ symbol, language }),
    });
}

// ═══════════════════════════════════════════════════════════════
// SCREENING SERVICE
// ═══════════════════════════════════════════════════════════════

/** Fetch cached top stocks */
export async function fetchTopStocks(): Promise<TopStocksResponse> {
    return request<TopStocksResponse>(API_ENDPOINTS.TOP_STOCKS);
}

/** Force refresh top stocks screening */
export async function refreshTopStocks(): Promise<TopStocksResponse> {
    return request<TopStocksResponse>(API_ENDPOINTS.TOP_STOCKS_REFRESH, {
        method: 'POST',
    });
}

// ═══════════════════════════════════════════════════════════════
// CHART DATA SERVICE
// ═══════════════════════════════════════════════════════════════

/** Fetch OHLC chart data for a stock symbol */
export async function fetchChartData(
    symbol: string,
    range: ChartRange = '3mo',
): Promise<ChartDataResponse> {
    const params = new URLSearchParams({ symbol, range });
    return request<ChartDataResponse>(`${API_ENDPOINTS.CHART_DATA}?${params}`);
}

/** Fetch OHLC chart data for a commodity (GOLD, SILVER, etc.) */
export async function fetchCommodityChartData(
    symbol: string,
    range: ChartRange = '3mo',
): Promise<ChartDataResponse> {
    const params = new URLSearchParams({ symbol, range });
    return request<ChartDataResponse>(`${API_ENDPOINTS.COMMODITY_CHART_DATA}?${params}`);
}

// ═══════════════════════════════════════════════════════════════
// WATCHLIST SERVICE
// ═══════════════════════════════════════════════════════════════

/** Fetch user's watchlist */
export async function fetchWatchlist(): Promise<{ success: boolean; data: Array<{ symbol: string }> }> {
    return request(API_ENDPOINTS.WATCHLIST);
}

/** Add symbol to watchlist */
export async function addToWatchlist(symbol: string): Promise<{ success: boolean }> {
    return request(`${API_ENDPOINTS.WATCHLIST}`, {
        method: 'POST',
        body: JSON.stringify({ symbol: symbol.toUpperCase() }),
    });
}

/** Remove symbol from watchlist */
export async function removeFromWatchlist(symbol: string): Promise<{ success: boolean }> {
    return request(`${API_ENDPOINTS.WATCHLIST}/${symbol.toUpperCase()}`, {
        method: 'DELETE',
    });
}
