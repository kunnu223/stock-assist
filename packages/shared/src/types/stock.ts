/**
 * Stock Types - Core types for stock data
 * @module @stock-assist/shared/types/stock
 */

/** OHLC candle data */
export interface OHLCData {
    date: string;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
}

/** Real-time stock quote */
export interface StockQuote {
    symbol: string;
    name: string;
    price: number;
    previousClose: number;
    open: number;
    dayHigh: number;
    dayLow: number;
    volume: number;
    change: number;
    changePercent: number;
}

/** Complete stock data with history */
export interface StockData {
    symbol: string;
    quote: StockQuote;
    history: OHLCData[];
    timeframes?: {
        daily: OHLCData[];
        weekly: OHLCData[];
        monthly: OHLCData[];
    };
}

/** Stock search result */
export interface StockSearchResult {
    symbol: string;
    name: string;
    exchange: string;
}
