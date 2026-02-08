/**
 * Stock Data Service - Main export
 * @module @stock-assist/api/services/data/stock
 */

import type { StockData } from '@stock-assist/shared';
import { fetchQuote } from './yahooQuote';
import { fetchHistory } from './yahooHistory';

/** Fetch complete stock data with multi-timeframe analysis */
export const getStockData = async (
    symbol: string,
    days: number = 30
): Promise<StockData> => {
    // Parallel fetch for speed
    const [quote, daily, weekly, monthly] = await Promise.all([
        fetchQuote(symbol),
        fetchHistory(symbol, `${days}d`, '1d'),    // Daily (short term)
        fetchHistory(symbol, '6mo', '1wk'),        // Weekly (medium term)
        fetchHistory(symbol, '2y', '1mo')          // Monthly (long term)
    ]);

    // Fallback for daily if empty (critical for basic function)
    const history = daily.length > 0 ? daily : [];

    return {
        symbol: symbol.toUpperCase(),
        quote,
        history, // Primary history for backward compatibility
        timeframes: {
            daily,
            weekly,
            monthly
        }
    };
};

/** Fetch multiple stocks data */
export const getMultipleStocks = async (
    symbols: readonly string[],
    days: number = 30
): Promise<StockData[]> => {
    const results = await Promise.allSettled(
        symbols.map((s) => getStockData(s, days))
    );

    return results
        .filter((r): r is PromiseFulfilledResult<StockData> =>
            r.status === 'fulfilled'
        )
        .map((r) => r.value);
};

export { fetchQuote, fetchHistory };
