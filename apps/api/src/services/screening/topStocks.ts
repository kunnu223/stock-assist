/**
 * Top Stocks Service
 * Orchestrates two-stage filtering: Technical pre-filter + AI analysis
 */

import { DEFAULT_WATCHLIST } from '@stock-assist/shared';
import { fetchHistory } from '../data/yahooHistory';
import { fetchQuote } from '../data/yahooQuote';
import { DailyTopStocks, type IStockPick } from '../../models/DailyTopStocks';
import {
    applyTechnicalFilters,
    DEFAULT_FILTER_CRITERIA,
    type FilteredStock
} from './technicalFilter';

/**
 * Get today's date in YYYY-MM-DD format
 */
const getTodayKey = (): string => {
    return new Date().toISOString().split('T')[0];
};

/**
 * Stage 1: Technical pre-filter on Nifty 50
 */
export const runTechnicalPreFilter = async (): Promise<FilteredStock[]> => {
    console.log('🔍 Stage 1: Running technical pre-filter on Nifty 50...');

    const filtered: FilteredStock[] = [];
    const symbols = DEFAULT_WATCHLIST.slice(0, 50); // Use DEFAULT_WATCHLIST as Nifty 50 proxy

    for (const symbol of symbols) {
        try {
            // Fetch 3 months of history for accurate calculations (ensures 21+ days regardless of holidays/weekends)
            const history = await fetchHistory(symbol, '3mo', '1d');

            if (history.length < 21) {
                console.log(`⚠️ Skipping ${symbol}: Insufficient data (${history.length} days)`);
                continue;
            }

            const result = applyTechnicalFilters(symbol, history, DEFAULT_FILTER_CRITERIA);

            if (result) {
                filtered.push(result);
                console.log(`✅ ${symbol}: Score ${result.score}, RSI ${result.rsi.toFixed(1)}, Volume ${result.volumeRatio.toFixed(2)}x`);
            }
        } catch (error) {
            console.warn(`❌ Error filtering ${symbol}:`, error);
        }
    }

    // Sort by technical score
    filtered.sort((a, b) => b.score - a.score);

    console.log(`✅ Stage 1 Complete: ${filtered.length} stocks passed filters`);
    return filtered;
};

/**
 * Stage 2: AI analysis on filtered stocks
 */
export const runAIAnalysis = async (filteredStocks: FilteredStock[]): Promise<IStockPick[]> => {
    console.log(`🤖 Stage 2: Running AI analysis on top ${filteredStocks.length} stocks...`);

    const analyzed: IStockPick[] = [];

    for (const stock of filteredStocks) {
        try {
            // Fetch current quote for price data
            const quote = await fetchQuote(stock.symbol);

            // Create analysis based on technical score
            // For now, use technical score as proxy for confidence (will be replaced with AI later)
            const confidence = Math.min(95, 50 + stock.score / 2); // Convert 0-100 score to 50-95% confidence
            const reason = `Strong technical setup: RSI ${stock.rsi.toFixed(1)}, Volume ${stock.volumeRatio.toFixed(2)}x avg, ${stock.passedFilters.length}/4 filters passed`;

            analyzed.push({
                symbol: stock.symbol,
                name: quote.name,
                price: quote.price,
                changePercent: quote.changePercent,
                confidence: Math.round(confidence),
                reason,
                technicalScore: stock.score,
                updatedAt: new Date(),
            });

            console.log(`✅ ${stock.symbol}: Confidence ${Math.round(confidence)}%`);

            // Small delay to respect rate limits
            await new Promise(resolve => setTimeout(resolve, 500));

        } catch (error) {
            console.warn(`❌ Error analyzing ${stock.symbol}:`, error);
        }
    }

    // Sort by confidence
    analyzed.sort((a, b) => b.confidence - a.confidence);

    // Return top 10
    const top10 = analyzed.slice(0, 10);
    console.log(`✅ Stage 2 Complete: Top 10 selected with avg confidence ${(top10.reduce((sum, s) => sum + s.confidence, 0) / top10.length).toFixed(1)
        }%`);

    return top10;
};

/**
 * Get today's top 10 stocks (with caching)
 */
export const getTodayTopStocks = async (forceRefresh: boolean = false): Promise<IStockPick[]> => {
    const today = getTodayKey();

    // Check cache first (unless force refresh)
    if (!forceRefresh) {
        const cached = await DailyTopStocks.findOne({ date: today });

        if (cached && cached.stocks.length > 0) {
            const age = Date.now() - cached.createdAt.getTime();
            const ageMinutes = Math.floor(age / 60000);

            console.log(`📦 Cache hit: Returning ${cached.stocks.length} stocks (${ageMinutes} min old)`);
            return cached.stocks;
        }
    }

    console.log('🚀 Cache miss or force refresh: Running full analysis...');

    // Stage 1: Technical pre-filter
    const filtered = await runTechnicalPreFilter();

    if (filtered.length === 0) {
        console.warn('⚠️ No stocks passed technical filters');
        return [];
    }

    // Take top 20 for AI analysis (or all if fewer)
    const topCandidates = filtered.slice(0, 20);

    // Stage 2: AI analysis
    const top10 = await runAIAnalysis(topCandidates);

    // Save to cache
    await DailyTopStocks.findOneAndUpdate(
        { date: today },
        {
            date: today,
            stocks: top10,
            totalAnalyzed: topCandidates.length,
            createdAt: new Date(),
        },
        { upsert: true, new: true }
    );

    console.log(`✅ Results cached for ${today}`);
    return top10;
};

/**
 * Get yesterday's top stocks (fallback)
 */
export const getYesterdayTopStocks = async (): Promise<IStockPick[]> => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayKey = yesterday.toISOString().split('T')[0];

    const cached = await DailyTopStocks.findOne({ date: yesterdayKey });

    if (cached) {
        console.log(`📦 Fallback: Returning yesterday's ${cached.stocks.length} stocks`);
        return cached.stocks;
    }

    return [];
};
