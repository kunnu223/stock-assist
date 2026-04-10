/**
 * API Client Service — Centralized HTTP layer for all backend calls.
 * Single source of truth for request/response handling, error formatting,
 * and endpoint configuration. Components should NEVER call fetch() directly.
 * @module @stock-assist/web/services/api
 */

import { API_ENDPOINTS } from '@/constants';
import { toast } from 'sonner';
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
async function request<T>(url: string, options?: RequestInit & { silent?: boolean }): Promise<T> {
    let res: Response;
    try {
        res = await fetch(url, {
            headers: { 'Content-Type': 'application/json' },
            ...options,
        });
    } catch (networkErr) {
        const msg = 'Network error — check your connection';
        if (!options?.silent) toast.error(msg);
        throw new ApiError(msg, 0, 'NETWORK_ERROR');
    }

    let data: any;
    try {
        data = await res.json();
    } catch {
        const msg = `Server returned invalid response (${res.status})`;
        if (!options?.silent) toast.error(msg);
        throw new ApiError(msg, res.status, 'PARSE_ERROR');
    }

    if (!res.ok || data.success === false) {
        const msg = data.error || data.message || `Request failed (${res.status})`;
        if (!options?.silent) {
            if (res.status === 429) {
                toast.warning('Rate limited — please wait a moment');
            } else if (res.status >= 500) {
                toast.error(`Server error: ${msg}`);
            } else {
                toast.error(msg);
            }
        }
        throw new ApiError(msg, res.status, data.code);
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

// ═══════════════════════════════════════════════════════════════
// BACKTEST SERVICE
// ═══════════════════════════════════════════════════════════════

export interface BacktestConfig {
    startDate?: string;
    endDate?: string;
    minConfidence?: number;
    signalExpiry?: number;
    partialTargetR?: number;
    fullTargetR?: number;
    /** 'legacy' = SMC + confidence scoring, 'momentum' = cross-sectional momentum + Donchian */
    strategy?: 'legacy' | 'momentum';
}

export interface BacktestRun {
    id: string;
    config: {
        startDate: string;
        endDate: string;
        symbolCount: number;
        minConfidence: number;
        partialTargetR: number;
        fullTargetR: number;
    };
    status: 'RUNNING' | 'COMPLETED' | 'FAILED';
    progress: string;
    duration?: number;
    error?: string;
    createdAt: string;
}

export interface BacktestReport {
    totalSignals: number;
    winRate: number;
    lossRate: number;
    profitFactor: number;
    expectancy: number;
    avgPnlPercent: number;
    totalPnlPercent: number;
    outcomes: { targetHit: number; stopHit: number; partialProfit: number; expired: number };
    // Flat timing fields
    avgDaysToOutcome: number;
    avgDaysWinners: number;
    avgDaysLosers: number;
    // Flat MFE/MAE fields
    avgMFE: number;
    avgMAE: number;
    mfeOnLosers: number;
    maeOnWinners: number;
    // Flat risk fields
    maxConsecutiveLosses: number;
    maxDrawdownPercent: number;
    sharpeRatio: number;
    // Record-based breakdowns
    byRegime: Record<string, { count: number; winRate: number; avgPnl: number; profitFactor: number }>;
    byConfidenceBucket: Record<string, { count: number; winRate: number; avgPnl: number; profitFactor: number }>;
    byPattern: Record<string, { count: number; winRate: number; avgPnl: number; profitFactor: number }>;
    insights: string[];
}

export interface BacktestResult {
    success: boolean;
    status: 'RUNNING' | 'COMPLETED' | 'FAILED';
    progress?: string;
    duration?: number;
    config?: BacktestRun['config'];
    report?: BacktestReport;
    topStacks?: Array<{
        conditions: string[];
        totalSignals: number;
        winRate: number;
        avgPnl: number;
        profitFactor: number;
        edge: number;
    }>;
    worstStacks?: Array<{
        conditions: string[];
        totalSignals: number;
        winRate: number;
        avgPnl: number;
        profitFactor: number;
        edge: number;
    }>;
    signalCount?: number;
    error?: string;
}

/** Start a new historical walk-forward backtest */
export async function startBacktest(config: BacktestConfig = {}): Promise<{ success: boolean; backtestId: string; status: string; message: string }> {
    return request(API_ENDPOINTS.BACKTEST_HISTORICAL, {
        method: 'POST',
        body: JSON.stringify(config),
    });
}

/** Poll backtest status and results by ID */
export async function fetchBacktestResult(id: string): Promise<BacktestResult> {
    return request(`${API_ENDPOINTS.BACKTEST_HISTORICAL}/${id}`);
}

/** List all past backtest runs */
export async function fetchBacktestRuns(): Promise<{ success: boolean; count: number; results: BacktestRun[] }> {
    return request(API_ENDPOINTS.BACKTEST_HISTORICAL);
}

/** Get live prediction accuracy stats */
export async function fetchBacktestStats(): Promise<{ success: boolean; stats: { totalClosed: number; winRate: number; netPnL: number }; calibrationReady: boolean }> {
    return request(API_ENDPOINTS.BACKTEST_STATS, { silent: true });
}
