/**
 * Commodity Data Service
 * Fetches commodity futures prices + USD/DXY + correlated commodities
 * @module @stock-assist/api/services/commodity/data
 */

import type { OHLCData } from '@stock-assist/shared';
import { fetchHistory } from '../data/yahooHistory';
import { fetchQuote } from '../data/yahooQuote';

/** Yahoo Finance symbols for commodity futures */
export const COMMODITY_SYMBOLS: Record<string, { yahoo: string; name: string; category: string; correlatedWith: string[] }> = {
    GOLD: { yahoo: 'GC=F', name: 'Gold', category: 'precious-metals', correlatedWith: ['SILVER', 'DXY'] },
    SILVER: { yahoo: 'SI=F', name: 'Silver', category: 'precious-metals', correlatedWith: ['GOLD', 'DXY'] },
    CRUDEOIL: { yahoo: 'CL=F', name: 'Crude Oil', category: 'energy', correlatedWith: ['NATURALGAS', 'DXY'] },
    NATURALGAS: { yahoo: 'NG=F', name: 'Natural Gas', category: 'energy', correlatedWith: ['CRUDEOIL'] },
    COPPER: { yahoo: 'HG=F', name: 'Copper', category: 'base-metals', correlatedWith: ['CRUDEOIL'] },
};

const DXY_SYMBOL = 'DX-Y.NYB';

export interface CommodityPriceData {
    symbol: string;
    name: string;
    category: string;
    currentPrice: number;
    previousClose: number;
    change: number;
    changePercent: number;
    dayHigh: number;
    dayLow: number;
    volume: number;
    history: OHLCData[];         // 90 days daily
    weeklyHistory: OHLCData[];   // 6 months weekly
}

export interface DXYData {
    currentValue: number;
    change: number;
    changePercent: number;
    trend30d: 'strengthening' | 'weakening' | 'stable';
    history: OHLCData[];
}

export interface CommodityDataBundle {
    commodity: CommodityPriceData;
    dxy: DXYData;
    correlatedPrices: Record<string, { price: number; change: number; changePercent: number }>;
}

/** Determine USD trend over 30 days */
function calcDXYTrend(history: OHLCData[]): 'strengthening' | 'weakening' | 'stable' {
    if (history.length < 20) return 'stable';
    const recent = history[history.length - 1].close;
    const past = history[Math.max(0, history.length - 20)].close;
    const change = ((recent - past) / past) * 100;
    if (change > 2) return 'strengthening';
    if (change < -2) return 'weakening';
    return 'stable';
}

/**
 * Fetch all commodity data: prices + DXY + correlations
 */
export async function fetchCommodityData(symbol: string): Promise<CommodityDataBundle> {
    const key = symbol.toUpperCase().replace(/\s+/g, '');
    const config = COMMODITY_SYMBOLS[key];

    if (!config) {
        throw new Error(`Unknown commodity: ${symbol}. Supported: ${Object.keys(COMMODITY_SYMBOLS).join(', ')}`);
    }

    console.log(`[Commodity] 🪙 Fetching data for ${config.name} (${config.yahoo})...`);

    // Parallel fetch: commodity daily + weekly, DXY, correlated commodities
    const [dailyHistory, weeklyHistory, dxyHistory, ...correlatedQuotes] = await Promise.all([
        fetchHistory(config.yahoo, '3mo', '1d'),
        fetchHistory(config.yahoo, '6mo', '1wk'),
        fetchHistory(DXY_SYMBOL, '3mo', '1d'),
        ...config.correlatedWith
            .filter(c => c !== 'DXY')
            .map(c => {
                const corr = COMMODITY_SYMBOLS[c];
                return corr
                    ? fetchHistory(corr.yahoo, '5d', '1d').then(h => ({
                        symbol: c,
                        history: h,
                    }))
                    : Promise.resolve({ symbol: c, history: [] as OHLCData[] });
            }),
    ]);

    // Extract current prices from last bars
    const lastBar = dailyHistory[dailyHistory.length - 1];
    const prevBar = dailyHistory.length > 1 ? dailyHistory[dailyHistory.length - 2] : lastBar;

    const currentPrice = lastBar?.close || 0;
    const previousClose = prevBar?.close || currentPrice;
    const change = currentPrice - previousClose;
    const changePercent = previousClose > 0 ? (change / previousClose) * 100 : 0;

    // DXY
    const dxyLast = dxyHistory[dxyHistory.length - 1];
    const dxyPrev = dxyHistory.length > 1 ? dxyHistory[dxyHistory.length - 2] : dxyLast;
    const dxyValue = dxyLast?.close || 0;
    const dxyChange = dxyValue - (dxyPrev?.close || dxyValue);

    // Correlated prices
    const correlatedPrices: Record<string, { price: number; change: number; changePercent: number }> = {};
    for (const cq of correlatedQuotes) {
        if (cq.history.length > 0) {
            const last = cq.history[cq.history.length - 1];
            const prev = cq.history.length > 1 ? cq.history[cq.history.length - 2] : last;
            correlatedPrices[cq.symbol] = {
                price: last.close,
                change: last.close - prev.close,
                changePercent: prev.close > 0 ? ((last.close - prev.close) / prev.close) * 100 : 0,
            };
        }
    }

    console.log(`[Commodity] ✅ ${config.name}: $${currentPrice.toFixed(2)} (${changePercent >= 0 ? '+' : ''}${changePercent.toFixed(2)}%), DXY: ${dxyValue.toFixed(2)}`);

    return {
        commodity: {
            symbol: key,
            name: config.name,
            category: config.category,
            currentPrice,
            previousClose,
            change,
            changePercent,
            dayHigh: lastBar?.high || currentPrice,
            dayLow: lastBar?.low || currentPrice,
            volume: lastBar?.volume || 0,
            history: dailyHistory,
            weeklyHistory,
        },
        dxy: {
            currentValue: dxyValue,
            change: dxyChange,
            changePercent: dxyPrev?.close ? (dxyChange / dxyPrev.close) * 100 : 0,
            trend30d: calcDXYTrend(dxyHistory),
            history: dxyHistory,
        },
        correlatedPrices,
    };
}
