/**
 * Fundamental Data Service
 * @module @stock-assist/api/services/data/fundamentals
 */

import yahooFinance from '../../config/yahoo';

// Local type definition (matches shared package)
export interface FundamentalData {
    valuation: 'undervalued' | 'fair' | 'overvalued' | 'unknown';
    growth: 'strong' | 'moderate' | 'weak' | 'unknown';
    metrics: {
        peRatio: number | null;
        pbRatio: number | null;
        marketCap: number | null;
        dividendYield: number | null;
        eps: number | null;
        bookValue: number | null;
    };
    sectorComparison: 'outperforming' | 'inline' | 'underperforming' | 'unknown';
}

// Simple in-memory cache (24-hour TTL)
interface CacheEntry {
    data: FundamentalData;
    timestamp: number;
}

const cache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Fetch fundamental data for a stock
 * Uses Yahoo Finance for basic metrics
 */
export const fetchFundamentals = async (symbol: string): Promise<FundamentalData> => {
    const cacheKey = symbol.toUpperCase();

    // Check cache
    const cached = cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
        console.log(`[Fundamentals] Cache hit for ${symbol}`);
        return cached.data;
    }

    try {
        const nseSymbol = symbol.endsWith('.NS') ? symbol : `${symbol}.NS`;

        // Use yahoo-finance2 to fetch data
        // It provides validation and handles cookies/crumbs
        const result = await yahooFinance.quoteSummary(nseSymbol, {
            modules: ['defaultKeyStatistics', 'financialData', 'summaryDetail']
        });

        if (!result) {
            console.warn(`[Fundamentals] No data found for ${symbol}`);
            return getDefaultFundamentals();
        }

        const stats = result.defaultKeyStatistics;
        const financial = result.financialData;
        const summary = result.summaryDetail;

        // In yahoo-finance2, values are numbers, not { raw: number }
        const peRatio = summary?.trailingPE || stats?.forwardPE || null;
        const pbRatio = stats?.priceToBook || null;
        const marketCap = summary?.marketCap || null;
        const dividendYield = summary?.dividendYield ? summary.dividendYield * 100 : null;
        const eps = stats?.trailingEps || null;
        const bookValue = stats?.bookValue || null;

        // Calculate valuation
        let valuation: FundamentalData['valuation'] = 'unknown';
        if (peRatio !== null) {
            if (peRatio < 15) valuation = 'undervalued';
            else if (peRatio > 30) valuation = 'overvalued';
            else valuation = 'fair';
        }

        // Calculate growth (based on revenue growth)
        let growth: FundamentalData['growth'] = 'unknown';
        const revenueGrowth = financial?.revenueGrowth;
        if (revenueGrowth !== undefined && revenueGrowth !== null) {
            if (revenueGrowth > 0.15) growth = 'strong';
            else if (revenueGrowth > 0.05) growth = 'moderate';
            else growth = 'weak';
        }

        // ROE-based sector comparison approximation
        let sectorComparison: FundamentalData['sectorComparison'] = 'unknown';
        const roe = financial?.returnOnEquity;
        if (roe !== undefined && roe !== null) {
            if (roe > 0.20) sectorComparison = 'outperforming';
            else if (roe > 0.10) sectorComparison = 'inline';
            else sectorComparison = 'underperforming';
        }

        const fundamentals: FundamentalData = {
            valuation,
            growth,
            metrics: {
                peRatio: peRatio ? Number(peRatio.toFixed(2)) : null,
                pbRatio: pbRatio ? Number(pbRatio.toFixed(2)) : null,
                marketCap,
                dividendYield: dividendYield ? Number(dividendYield.toFixed(2)) : null,
                eps: eps ? Number(eps.toFixed(2)) : null,
                bookValue: bookValue ? Number(bookValue.toFixed(2)) : null,
            },
            sectorComparison,
        };

        // Update cache
        cache.set(cacheKey, { data: fundamentals, timestamp: Date.now() });
        console.log(`[Fundamentals] Fetched data for ${symbol}: PE=${peRatio}, Growth=${growth}`);

        return fundamentals;
    } catch (error) {
        console.warn(`[Fundamentals] Error fetching ${symbol}:`, (error as Error).message);
        return getDefaultFundamentals();
    }
};

/** Default fundamentals when data unavailable */
const getDefaultFundamentals = (): FundamentalData => ({
    valuation: 'unknown',
    growth: 'unknown',
    metrics: {
        peRatio: null,
        pbRatio: null,
        marketCap: null,
        dividendYield: null,
        eps: null,
        bookValue: null,
    },
    sectorComparison: 'unknown',
});

/** Clear fundamentals cache (for testing) */
export const clearFundamentalsCache = (): void => {
    cache.clear();
};
