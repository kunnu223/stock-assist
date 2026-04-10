/**
 * Raw Fundamentals Fetcher — returns numeric metrics (not labels) for screening
 *
 * The existing fundamentals.ts service produces qualitative labels
 * ('strong'/'weak'/'undervalued') which is good for the analysis UI but
 * useless for the Quality Momentum screener which needs raw numbers to
 * compare and filter against thresholds.
 *
 * This service hits the same Yahoo Finance quoteSummary endpoint but
 * returns the raw metrics needed by the screener:
 *   - ROE (return on equity)
 *   - Net profit margin
 *   - Quarterly EPS YoY growth
 *   - Debt-to-equity ratio
 *   - 52-week high (for the "near 52w high" setup filter)
 *   - Current price
 *   - Market cap (for liquidity-ish proxy)
 *
 * Yahoo's data quality for Indian stocks is patchy. We return null for any
 * field we couldn't get and let the screener decide how to handle missing
 * data (typically: skip the stock).
 *
 * @module @stock-assist/api/services/data/rawFundamentals
 */

import yahooFinance from '../../config/yahoo';
import { logger } from '../../config/logger';

export interface RawFundamentals {
    symbol: string;
    /** Yahoo's reported sector (e.g. 'Financial Services'). null = data unavailable */
    sector: string | null;
    /** Yahoo's reported industry (e.g. 'Banks—Regional') */
    industry: string | null;
    /** True if Yahoo classifies this as a financial-sector company. Banks/NBFCs
     *  legitimately don't have a debtToEquity ratio in the traditional sense
     *  because their entire business is leveraged deposits. The screener should
     *  waive the D/E check for these stocks. */
    isFinancial: boolean;
    /** Return on equity (e.g. 0.18 = 18%). null = data unavailable */
    roe: number | null;
    /** Net profit margin (e.g. 0.12 = 12%) */
    profitMargin: number | null;
    /** Quarterly EPS YoY growth (e.g. 0.20 = +20%) */
    earningsGrowth: number | null;
    /** Debt to equity ratio (Yahoo returns this as a percentage in v3 — we normalise to a ratio: 0.5 = 50%) */
    debtToEquity: number | null;
    /** 52-week high (price) */
    fiftyTwoWeekHigh: number | null;
    /** Current / latest close price */
    currentPrice: number | null;
    /** Market cap in absolute currency units */
    marketCap: number | null;
    /** True if the screening fields needed for THIS company are all present.
     *  For financials this is roe + profitMargin + earningsGrowth (D/E waived).
     *  For non-financials it's all four. */
    isComplete: boolean;
}

/** NSE-format the symbol so yahoo-finance2 accepts it */
function toNSE(symbol: string): string {
    const s = symbol.toUpperCase().trim();
    if (s.endsWith('.NS') || s.endsWith('.BO') || s.startsWith('^')) return s;
    return `${s}.NS`;
}

/**
 * Fetch raw fundamentals for one symbol. Never throws — returns nulls on
 * failure so the screener can keep going.
 */
export async function fetchRawFundamentals(symbol: string): Promise<RawFundamentals> {
    const empty: RawFundamentals = {
        symbol,
        sector: null,
        industry: null,
        isFinancial: false,
        roe: null,
        profitMargin: null,
        earningsGrowth: null,
        debtToEquity: null,
        fiftyTwoWeekHigh: null,
        currentPrice: null,
        marketCap: null,
        isComplete: false,
    };

    try {
        const result = await yahooFinance.quoteSummary(toNSE(symbol), {
            modules: ['financialData', 'defaultKeyStatistics', 'summaryDetail', 'price', 'assetProfile'],
        });

        if (!result) return empty;

        const fin = result.financialData;
        const stats = result.defaultKeyStatistics;
        const summary = result.summaryDetail;
        const price = result.price;
        const profile = result.assetProfile;

        // Yahoo's debtToEquity is reported as a percentage (e.g. 50 means 0.5)
        // — normalise to a ratio.
        const dteRaw = fin?.debtToEquity;
        const dte = (dteRaw !== undefined && dteRaw !== null) ? dteRaw / 100 : null;

        // ROE: Yahoo populates `financialData.returnOnEquity` for some stocks
        // but NOT others (e.g. RELIANCE has nothing in either module). When the
        // direct field is missing, compute it ourselves from primitives that
        // are usually available:
        //   ROE = netIncomeToCommon / (bookValue × sharesOutstanding)
        // bookValue is per-share, so multiplying by sharesOutstanding gives
        // total shareholder equity.
        let roe: number | null = fin?.returnOnEquity ?? null;
        if (roe === null) {
            const netIncome = stats?.netIncomeToCommon ?? null;
            const bookValuePerShare = stats?.bookValue ?? null;
            const sharesOut = stats?.sharesOutstanding ?? null;
            if (netIncome !== null && bookValuePerShare !== null && sharesOut !== null) {
                const equity = bookValuePerShare * sharesOut;
                if (equity > 0) roe = netIncome / equity;
            }
        }

        const profitMargin = fin?.profitMargins ?? stats?.profitMargins ?? null;
        const earningsGrowth = fin?.earningsGrowth ?? stats?.earningsQuarterlyGrowth ?? null;

        const sector = profile?.sector ?? null;
        const industry = profile?.industry ?? null;
        // Yahoo's sector strings for Indian banks/NBFCs include
        // 'Financial Services' and the industry usually contains 'Bank',
        // 'Insurance', or 'Capital Markets'.
        const isFinancial = sector === 'Financial Services';

        const out: RawFundamentals = {
            symbol,
            sector,
            industry,
            isFinancial,
            roe,
            profitMargin,
            earningsGrowth,
            debtToEquity: dte,
            fiftyTwoWeekHigh: summary?.fiftyTwoWeekHigh ?? null,
            currentPrice: price?.regularMarketPrice ?? null,
            marketCap: summary?.marketCap ?? price?.marketCap ?? null,
            isComplete: false,
        };

        // Completeness depends on whether the stock is a financial.
        // Financials don't have a meaningful debt/equity ratio so we waive that check.
        const coreOk = out.roe !== null && out.profitMargin !== null && out.earningsGrowth !== null;
        out.isComplete = isFinancial ? coreOk : (coreOk && out.debtToEquity !== null);

        return out;
    } catch (err) {
        logger.warn({ symbol, err: (err as Error).message }, '[rawFundamentals] fetch failed');
        return empty;
    }
}

/**
 * Fetch fundamentals for many symbols, with a small concurrency cap so we
 * don't hammer Yahoo. Returns the array in input order.
 */
export async function fetchManyRawFundamentals(
    symbols: string[],
    concurrency: number = 4,
): Promise<RawFundamentals[]> {
    const results: RawFundamentals[] = new Array(symbols.length);
    let cursor = 0;

    async function worker() {
        while (true) {
            const i = cursor++;
            if (i >= symbols.length) return;
            results[i] = await fetchRawFundamentals(symbols[i]);
            // Tiny pause between calls per worker to be polite to Yahoo
            await new Promise(r => setTimeout(r, 150));
        }
    }

    const workers = Array.from({ length: Math.min(concurrency, symbols.length) }, () => worker());
    await Promise.all(workers);
    return results;
}
