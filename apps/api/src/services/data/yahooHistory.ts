/**
 * Yahoo Finance - History Fetcher
 * @module @stock-assist/api/services/data/yahooHistory
 */

import axios from 'axios';
import type { OHLCData } from '@stock-assist/shared';

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


import yahooFinance from '../../config/yahoo';

/** Fetch historical OHLC data */
export const fetchHistory = async (
    symbol: string,
    range: string = '1mo', // '1d', '5d', '1mo', '3mo', '6mo', '1y', '2y', '5y', '10y', 'ytd', 'max'
    interval: string = '1d' // '1d', '1wk', '1mo'
): Promise<OHLCData[]> => {
    try {
        const nseSymbol = toNSE(symbol);

        // Calculate period1 based on range
        const now = new Date();
        let period1: Date;

        switch (range) {
            case '1d': period1 = new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000); break;
            case '5d': period1 = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000); break;
            case '1mo': period1 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000); break;
            case '3mo': period1 = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000); break;
            case '6mo': period1 = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000); break;
            case '1y': period1 = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000); break;
            default: period1 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000); // Default 1mo
        }

        const result = await yahooFinance.chart(nseSymbol, {
            period1,
            period2: now,
            interval: interval as '1d' | '1wk' | '1mo'
        });

        if (!result || !result.quotes) throw new Error(`No history found for ${symbol}`);

        const quotes = result.quotes;

        return quotes.map((q: any) => ({
            date: q.date ? new Date(q.date).toISOString().split('T')[0] : '',
            open: Number((q.open || 0).toFixed(2)),
            high: Number((q.high || 0).toFixed(2)),
            low: Number((q.low || 0).toFixed(2)),
            close: Number((q.close || 0).toFixed(2)),
            volume: q.volume || 0,
        })).filter((d: any) => d.date && d.close > 0);
    } catch (error) {
        console.warn(`⚠️ Yahoo History Fetch Failed for ${symbol} (${interval}):`, (error as Error).message);
        return [];
    }
};
