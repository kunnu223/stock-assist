/**
 * Sector Comparison Service
 * Compares stock performance vs sector and market indices
 */

import { fetchQuote } from '../data/yahooQuote';

export interface SectorComparison {
    stockChange: number;
    stockSymbol: string;
    sectorChange: number | null;
    sectorSymbol: string | null;
    niftyChange: number | null;
    outperformance: number | null;
    verdict: 'STRONG_OUTPERFORMER' | 'OUTPERFORMER' | 'INLINE' | 'UNDERPERFORMER' | 'WEAK' | 'UNKNOWN';
    recommendation: string;
    confidenceModifier: number; // -10 to +10
}

// Sector mapping (simplified - can be expanded)
const SECTOR_INDICES: Record<string, string> = {
    // Banking
    'HDFCBANK': 'BANKNIFTY',
    'ICICIBANK': 'BANKNIFTY',
    'SBIN': 'BANKNIFTY',
    'AXISBANK': 'BANKNIFTY',
    'KOTAKBANK': 'BANKNIFTY',

    // IT
    'TCS': 'NIFTYIT',
    'INFY': 'NIFTYIT',
    'WIPRO': 'NIFTYIT',
    'HCLTECH': 'NIFTYIT',

    // Auto
    'MARUTI': 'NIFTYAUTO',
    'TATAMOTORS': 'NIFTYAUTO',

    // Default to NIFTY50
};

/**
 * Get sector index for a stock
 */
function getSectorIndex(symbol: string): string {
    return SECTOR_INDICES[symbol] || 'NIFTY50';
}

/**
 * Calculate relative strength and verdict
 */
function calculateVerdict(
    stockChange: number,
    sectorChange: number | null,
    niftyChange: number | null
): { verdict: SectorComparison['verdict']; confidenceModifier: number; recommendation: string } {

    // If no comparison data, return unknown
    if (sectorChange === null && niftyChange === null) {
        return {
            verdict: 'UNKNOWN',
            confidenceModifier: 0,
            recommendation: 'Sector data unavailable - rely on individual stock analysis'
        };
    }

    const referenceChange = sectorChange !== null ? sectorChange : niftyChange!;
    const outperformance = stockChange - referenceChange;

    let verdict: SectorComparison['verdict'];
    let confidenceModifier = 0;
    let recommendation = '';

    if (outperformance > 2) {
        verdict = 'STRONG_OUTPERFORMER';
        confidenceModifier = +10;
        recommendation = 'Strong relative strength - stock leading its sector';
    } else if (outperformance > 0.5) {
        verdict = 'OUTPERFORMER';
        confidenceModifier = +5;
        recommendation = 'Outperforming sector - positive momentum';
    } else if (outperformance > -0.5) {
        verdict = 'INLINE';
        confidenceModifier = 0;
        recommendation = 'Moving inline with sector';
    } else if (outperformance > -2) {
        verdict = 'UNDERPERFORMER';
        confidenceModifier = -5;
        recommendation = 'Underperforming sector - be cautious';
    } else {
        verdict = 'WEAK';
        confidenceModifier = -10;
        recommendation = 'Significant underperformance - avoid or wait for reversal';
    }

    return { verdict, confidenceModifier, recommendation };
}

/**
 * Compare stock performance vs sector and Nifty
 */
export async function compareSector(symbol: string, stockChangePercent: number): Promise<SectorComparison> {
    const sectorSymbol = getSectorIndex(symbol);

    let sectorChange: number | null = null;
    let niftyChange: number | null = null;

    try {
        // Fetch sector index
        if (sectorSymbol && sectorSymbol !== 'NIFTY50') {
            try {
                const sectorQuote = await fetchQuote(sectorSymbol);
                sectorChange = sectorQuote.changePercent;
            } catch (err) {
                console.warn(`[SectorComparison] Failed to fetch ${sectorSymbol}:`, err);
            }
        }

        // Fetch Nifty as fallback/comparison
        try {
            const niftyQuote = await fetchQuote('NIFTY50');
            niftyChange = niftyQuote.changePercent;
        } catch (err) {
            console.warn('[SectorComparison] Failed to fetch NIFTY50:', err);
        }

    } catch (error) {
        console.error('[SectorComparison] Error:', error);
    }

    const outperformance = sectorChange !== null
        ? stockChangePercent - sectorChange
        : niftyChange !== null
            ? stockChangePercent - niftyChange
            : null;

    const { verdict, confidenceModifier, recommendation } = calculateVerdict(
        stockChangePercent,
        sectorChange,
        niftyChange
    );

    return {
        stockChange: stockChangePercent,
        stockSymbol: symbol,
        sectorChange,
        sectorSymbol: sectorSymbol || null,
        niftyChange,
        outperformance,
        verdict,
        recommendation,
        confidenceModifier,
    };
}

/**
 * Get human-readable summary
 */
export function getSectorComparisonSummary(comparison: SectorComparison): string {
    if (comparison.verdict === 'UNKNOWN') {
        return 'Sector comparison unavailable';
    }

    const outperf = comparison.outperformance?.toFixed(2) || '0.00';
    const sign = parseFloat(outperf) >= 0 ? '+' : '';

    return `${comparison.verdict}: Stock ${sign}${comparison.stockChange.toFixed(2)}% vs ${comparison.sectorSymbol || 'NIFTY'} ${sign}${outperf}%`;
}
