/**
 * Web App Constants — Centralized configuration values.
 * All magic numbers and config strings live here.
 * @module @stock-assist/web/constants
 */

// ═══════════════════════════════════════════════════════════════
// API CONFIGURATION
// ═══════════════════════════════════════════════════════════════

/** Base path for all API requests (proxied via Next.js rewrites) */
export const API_BASE = '/api';

/** API endpoint paths */
export const API_ENDPOINTS = {
    ANALYZE_SINGLE: `${API_BASE}/analyze/single`,
    TOP_STOCKS: `${API_BASE}/stocks/top-10`,
    TOP_STOCKS_REFRESH: `${API_BASE}/stocks/top-10/refresh`,
    CHART_DATA: `${API_BASE}/stocks/chart`,
    COMMODITY_CHART_DATA: `${API_BASE}/analyze/commodity/chart`,
    WATCHLIST: `${API_BASE}/watchlist`,
} as const;

// ═══════════════════════════════════════════════════════════════
// REACT QUERY KEYS
// ═══════════════════════════════════════════════════════════════

/** Standardized query keys for React Query cache management */
export const QUERY_KEYS = {
    TOP_STOCKS: ['topStocks'] as const,
    ANALYSIS: (symbol: string) => ['analysis', symbol] as const,
    CHART_DATA: (symbol: string, range: string) => ['chartData', symbol, range] as const,
    WATCHLIST: ['watchlist'] as const,
} as const;

// ═══════════════════════════════════════════════════════════════
// CHART CONFIGURATION
// ═══════════════════════════════════════════════════════════════

/** Available chart time ranges */
export const CHART_RANGES = [
    { label: '1M', value: '1mo' },
    { label: '3M', value: '3mo' },
    { label: '6M', value: '6mo' },
    { label: '1Y', value: '1y' },
    { label: '2Y', value: '2y' },
] as const;

/** Default chart range */
export const DEFAULT_CHART_RANGE = '3mo';

/** Chart color scheme (synced with Tailwind theme) */
export const CHART_COLORS = {
    /** Bullish candle colors */
    BULLISH: {
        body: '#10b981',       // emerald-500
        wick: '#10b981',
        border: '#10b981',
    },
    /** Bearish candle colors */
    BEARISH: {
        body: '#f43f5e',       // rose-500
        wick: '#f43f5e',
        border: '#f43f5e',
    },
    /** Volume bar colors */
    VOLUME: {
        up: 'rgba(16, 185, 129, 0.3)',    // emerald-500 @ 30%
        down: 'rgba(244, 63, 94, 0.3)',    // rose-500 @ 30%
    },
    /** Overlay line colors */
    SUPPORT: '#3b82f6',        // blue-500
    RESISTANCE: '#f59e0b',     // amber-500
    ENTRY_ZONE: '#8b5cf6',     // violet-500
    STOP_LOSS: '#ef4444',      // red-500
    TARGET_1: '#10b981',       // emerald-500
    TARGET_2: '#06b6d4',       // cyan-500
    /** Chart background */
    BACKGROUND: '#09090b',     // zinc-950
    GRID: 'rgba(39, 39, 42, 0.5)', // zinc-800 @ 50%
    TEXT: '#a1a1aa',           // zinc-400
    CROSSHAIR: '#52525b',     // zinc-600
} as const;

// ═══════════════════════════════════════════════════════════════
// UI CONSTANTS
// ═══════════════════════════════════════════════════════════════

/** Confidence score thresholds */
export const CONFIDENCE = {
    HIGH: 70,
    MEDIUM: 50,
} as const;

/** Recommendation style mappings */
export const RECOMMENDATION_STYLES = {
    BUY: 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20',
    SELL: 'bg-rose-500 text-white shadow-lg shadow-rose-500/20',
    HOLD: 'bg-amber-500 text-white shadow-lg shadow-amber-500/20',
    WAIT: 'bg-zinc-700 text-zinc-300',
} as const;

/** Confidence color mappings */
export const CONFIDENCE_COLORS = {
    HIGH: 'text-emerald-500',
    MEDIUM: 'text-amber-500',
    LOW: 'text-rose-500',
} as const;

/** Local storage keys */
export const STORAGE_KEYS = {
    THEME: 'stock-assist-theme',
    LANGUAGE: 'stock-assist-lang',
} as const;
