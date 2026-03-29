'use client';

/**
 * useCommodityChartData — Custom hook for fetching commodity OHLC chart data.
 * Maps commodity keys (GOLD, SILVER, etc.) to Yahoo futures symbols via backend.
 * Supports live auto-refresh for real-time price updates.
 * @module @stock-assist/web/hooks/useCommodityChartData
 */

import { useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchCommodityChartData } from '@/services/api';
import { DEFAULT_CHART_RANGE } from '@/constants';
import type { ChartRange, OHLCBar } from '@/types';

interface UseCommodityChartDataOptions {
    /** Commodity key: GOLD, SILVER, CRUDEOIL, NATURALGAS, COPPER */
    symbol: string;
    /** Whether to enable the query */
    enabled?: boolean;
    /** Auto-refresh interval in seconds (0 = disabled, default 30) */
    refreshInterval?: number;
}

interface UseCommodityChartDataReturn {
    data: OHLCBar[];
    range: ChartRange;
    setRange: (range: ChartRange) => void;
    isLoading: boolean;
    error: string | null;
    refresh: () => void;
    refreshInterval: number;
}

export function useCommodityChartData({
    symbol,
    enabled = true,
    refreshInterval = 30,
}: UseCommodityChartDataOptions): UseCommodityChartDataReturn {
    const [range, setRange] = useState<ChartRange>(DEFAULT_CHART_RANGE as ChartRange);

    const { data: response, isLoading, error, refetch } = useQuery({
        queryKey: ['commodityChartData', symbol, range],
        queryFn: () => fetchCommodityChartData(symbol, range),
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
