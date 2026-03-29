'use client';

/**
 * useAnalysis — Custom hook for single stock analysis.
 * Wraps the mutation with proper types and scroll-to-results.
 * @module @stock-assist/web/hooks/useAnalysis
 */

import { useRef } from 'react';
import { useMutation } from '@tanstack/react-query';
import { analyzeStock } from '@/services/api';
import type { AnalysisData } from '@/types';

interface UseAnalysisReturn {
    /** Run analysis for a symbol */
    analyze: (symbol: string, language?: string) => void;
    /** Analysis result data */
    data: AnalysisData | null;
    /** Whether analysis is running */
    isLoading: boolean;
    /** Error message if analysis failed */
    error: string | null;
    /** Ref to attach to the results container for auto-scroll */
    resultsRef: React.RefObject<HTMLDivElement>;
}

export function useAnalysis(): UseAnalysisReturn {
    const resultsRef = useRef<HTMLDivElement>(null);

    const mutation = useMutation({
        mutationFn: ({ symbol, language }: { symbol: string; language: string }) =>
            analyzeStock(symbol, language),
        onSuccess: () => {
            setTimeout(() => {
                resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }, 100);
        },
    });

    return {
        analyze: (symbol: string, language: string = 'en') =>
            mutation.mutate({ symbol, language }),
        data: (mutation.data?.analysis as AnalysisData) || null,
        isLoading: mutation.isPending,
        error: mutation.error?.message || null,
        resultsRef,
    };
}
