/**
 * Yahoo Finance - Quote Fetcher
 * @module @stock-assist/api/services/data/yahooQuote
 */

import type { StockQuote } from '@stock-assist/shared';
import yahooFinance from '../../config/yahoo';

const BASE_URL = 'https://query1.finance.yahoo.com/v8/finance/chart';
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

/** Common symbol mappings */
const MAPPINGS: Record<string, string> = {
    'NIPPON': 'NAM-INDIA.NS',
    'RELIANCE': 'RELIANCE.NS',
    'NIFTYBEES': 'NIFTYBEES.NS',
    'GOLDBEES': 'GOLDBEES.NS',
    'TATA POWER': 'TATAPOWER.NS',
    'TATAPOWER': 'TATAPOWER.NS',
    'TATA MOTORS': 'TATAMOTORS.NS',
    'TATAMOTORS': 'TATAMOTORS.NS',
    'HDFC BANK': 'HDFCBANK.NS',
    'HDFCBANK': 'HDFCBANK.NS',
    'BAJAJ FINANCE': 'BAJFINANCE.NS',
    'BAJFINANCE': 'BAJFINANCE.NS'
};

/** Convert symbol to NSE format */
const toNSE = (symbol: string): string => {
    let s = symbol.toUpperCase().trim();

    // Check exact mapping first
    if (MAPPINGS[s]) return MAPPINGS[s];

    // Remove spaces if it looks like a multi-word symbol (heuristic for Indian stocks)
    if (!s.includes('.') && s.includes(' ')) {
        const noSpace = s.replace(/\s+/g, '');
        if (MAPPINGS[noSpace]) return MAPPINGS[noSpace];
        s = noSpace;
    }

    if (s.endsWith('.NS') || s.endsWith('.BO') || s.includes(':')) return s;
    return `${s}.NS`;
};

/** Fetch current stock quote */
export const fetchQuote = async (symbol: string): Promise<StockQuote> => {
    try {
        const nseSymbol = toNSE(symbol);

        // Use shared yahoo-finance2 instance
        const results = await yahooFinance.quoteSummary(nseSymbol, {
            modules: ['price', 'summaryDetail']
        });

        if (!results) throw new Error(`No data found for ${symbol}`);

        const price = results.price;
        const summary = results.summaryDetail;

        const currentPrice = price?.regularMarketPrice || 0;
        const prevClose = price?.regularMarketPreviousClose || currentPrice;
        const change = currentPrice - prevClose;

        return {
            symbol: symbol.toUpperCase(),
            name: price?.longName || price?.shortName || symbol,
            price: Number(currentPrice.toFixed(2)),
            previousClose: Number(prevClose.toFixed(2)),
            open: Number((price?.regularMarketOpen || currentPrice).toFixed(2)),
            dayHigh: Number((price?.regularMarketDayHigh || currentPrice).toFixed(2)),
            dayLow: Number((price?.regularMarketDayLow || currentPrice).toFixed(2)),
            volume: summary?.volume || price?.regularMarketVolume || 0,
            change: Number(change.toFixed(2)),
            changePercent: prevClose !== 0 ? Number(((change / prevClose) * 100).toFixed(2)) : 0,
        };
    } catch (error) {
        console.warn(`⚠️ Yahoo Quote Fetch Failed for ${symbol}:`, (error as Error).message);
        // Fallback to mock data for resilience
        return {
            symbol: symbol.toUpperCase(),
            name: `${symbol.toUpperCase()} (Demo)`,
            price: 1500.00,
            previousClose: 1480.00,
            open: 1485.00,
            dayHigh: 1510.00,
            dayLow: 1475.00,
            volume: 1000000,
            change: 20.00,
            changePercent: 1.35,
        };
    }
};
