'use client';

/**
 * useChartData — Custom hook for fetching OHLC chart data.
 * Manages range state, caching via React Query, live auto-refresh, and loading states.
 * Works for both stocks (RELIANCE) and commodities (GC=F).
 * @module @stock-assist/web/hooks/useChartData
 */

import { useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchChartData } from '@/services/api';
import { QUERY_KEYS, DEFAULT_CHART_RANGE } from '@/constants';
import type { ChartRange, OHLCBar } from '@/types';

interface UseChartDataOptions {
    /** Stock or commodity symbol to fetch chart data for */
    symbol: string;
    /** Whether to enable the query (e.g., only after analysis loads) */
    enabled?: boolean;
    /** Auto-refresh interval in seconds (0 = disabled, default 0) */
    refreshInterval?: number;
}

interface UseChartDataReturn {
    /** OHLC bars for the chart */
    data: OHLCBar[];
    /** Current selected range */
    range: ChartRange;
    /** Update the chart range */
    setRange: (range: ChartRange) => void;
    /** Whether data is being fetched */
    isLoading: boolean;
    /** Error message if fetch failed */
    error: string | null;
    /** Force a manual refresh */
    refresh: () => void;
    /** Auto-refresh interval in seconds */
    refreshInterval: number;
}

export function useChartData({ symbol, enabled = true, refreshInterval = 0 }: UseChartDataOptions): UseChartDataReturn {
    const [range, setRange] = useState<ChartRange>(DEFAULT_CHART_RANGE as ChartRange);

    const { data: response, isLoading, error, refetch } = useQuery({
        queryKey: QUERY_KEYS.CHART_DATA(symbol, range),
        queryFn: () => fetchChartData(symbol, range),
        enabled: enabled && !!symbol,
        staleTime: refreshInterval > 0 ? refreshInterval * 1000 : 5 * 60 * 1000,
        refetchInterval: refreshInterval > 0 ? refreshInterval * 1000 : false,
        retry: 1,
    });

    const refresh = useCallback(() => {
        refetch();
    }, [refetch]);

    return {
        data: response?.data || [],
        range,
        setRange,
        isLoading,
        error: error?.message || null,
        refresh,
        refreshInterval,
    };
}
