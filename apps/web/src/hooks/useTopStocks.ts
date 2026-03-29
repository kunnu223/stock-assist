'use client';

/**
 * useTopStocks — Custom hook for fetching and refreshing top screened stocks.
 * @module @stock-assist/web/hooks/useTopStocks
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchTopStocks, refreshTopStocks } from '@/services/api';
import { QUERY_KEYS } from '@/constants';
import type { TopStock, TopStocksResponse } from '@/types';

interface UseTopStocksReturn {
    /** List of top stocks */
    stocks: TopStock[];
    /** Total stocks scanned */
    totalScanned: number;
    /** When the data was last updated */
    updatedAt: Date | null;
    /** Whether initial data is loading */
    isLoading: boolean;
    /** Error message */
    error: string | null;
    /** Whether a refresh is in progress */
    isRefreshing: boolean;
    /** Trigger a fresh screening of all stocks */
    refresh: () => void;
    /** Retry the initial fetch */
    retry: () => void;
}

export function useTopStocks(): UseTopStocksReturn {
    const queryClient = useQueryClient();

    const { data, isLoading, error } = useQuery({
        queryKey: QUERY_KEYS.TOP_STOCKS,
        queryFn: fetchTopStocks,
    });

    const refreshMutation = useMutation({
        mutationFn: refreshTopStocks,
        onSuccess: (freshData: TopStocksResponse) => {
            queryClient.setQueryData(QUERY_KEYS.TOP_STOCKS, freshData);
        },
    });

    return {
        stocks: data?.stocks || [],
        totalScanned: data?.totalScanned || 0,
        updatedAt: data?.updatedAt ? new Date(data.updatedAt) : null,
        isLoading,
        error: error?.message || refreshMutation.error?.message || null,
        isRefreshing: refreshMutation.isPending,
        refresh: () => refreshMutation.mutate(),
        retry: () => queryClient.invalidateQueries({ queryKey: QUERY_KEYS.TOP_STOCKS }),
    };
}
