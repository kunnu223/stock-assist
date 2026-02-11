/**
 * Top Stocks Service
 * Screens NIFTY 100 stocks using code-level signal clarity scoring
 * to find the top 10 with clearest directional signals
 */

import { NIFTY_100, STOCK_NAMES } from '@stock-assist/shared';
import { fetchHistory } from '../data/yahooHistory';
import { fetchQuote } from '../data/yahooQuote';
import { DailyTopStocks, type IStockPick } from '../../models/DailyTopStocks';
import {
    calculateSignalClarity,
    MIN_CLARITY_THRESHOLD,
    type SignalClarityResult
} from './signalClarity';

/**
 * Get today's date in YYYY-MM-DD format
 */
const getTodayKey = (): string => {
    return new Date().toISOString().split('T')[0];
};

/**
 * Stage 1: Screen all NIFTY 100 stocks with signal clarity scoring
 * This is the code-level filter — no AI needed
 */
export const screenStocksForClarity = async (): Promise<SignalClarityResult[]> => {
    const universe = NIFTY_100;
    console.log(`🔍 Screening ${universe.length} stocks for signal clarity...`);

    const results: SignalClarityResult[] = [];
    let processed = 0;
    let skipped = 0;
    let failed = 0;

    for (const symbol of universe) {
        try {
            // Fetch 3 months of daily history
            const history = await fetchHistory(symbol, '3mo', '1d');

            if (history.length < 26) {
                console.log(`⚠️ Skip ${symbol}: Insufficient data (${history.length} days)`);
                skipped++;
                continue;
            }

            // Calculate signal clarity
            const clarity = calculateSignalClarity(symbol, history);

            if (clarity && clarity.clarityScore >= MIN_CLARITY_THRESHOLD) {
                results.push(clarity);
                console.log(`✅ ${symbol}: ${clarity.summary} (clarity: ${clarity.clarityScore}, weighted: ${clarity.weightedScore})`);
            } else {
                console.log(`⛔ ${symbol}: Low clarity (${clarity?.clarityScore ?? 0}%) — skipped`);
            }

            processed++;

            // Rate limit: 300ms between calls to respect Yahoo Finance
            await new Promise(resolve => setTimeout(resolve, 300));

        } catch (error) {
            console.warn(`❌ Error screening ${symbol}:`, error);
            failed++;
        }
    }

    // Sort by weighted score (considers both agreement AND signal strength)
    results.sort((a, b) => b.weightedScore - a.weightedScore);

    console.log(`\n📊 Screening Complete:`);
    console.log(`   Processed: ${processed}/${universe.length}`);
    console.log(`   Skipped: ${skipped}, Failed: ${failed}`);
    console.log(`   Passed clarity filter: ${results.length}`);

    return results;
};

/**
 * Stage 2: Build top picks from clarity results
 * Fetches live quotes and constructs the final top 10 list
 */
export const buildTopPicks = async (
    clarityResults: SignalClarityResult[]
): Promise<IStockPick[]> => {
    console.log(`\n🏆 Building top ${Math.min(10, clarityResults.length)} picks...`);

    const picks: IStockPick[] = [];
    const top = clarityResults.slice(0, 10);

    for (const result of top) {
        try {
            const quote = await fetchQuote(result.symbol);

            // Confidence = weighted clarity score
            const confidence = Math.min(95, result.weightedScore);

            // Build descriptive reason from top signals
            const alignedSignals = result.signals
                .filter(s => s.direction === result.direction)
                .map(s => s.name)
                .join(', ');

            const reason = `${result.summary}. Key signals: ${alignedSignals}`;

            picks.push({
                symbol: result.symbol,
                name: quote.name || STOCK_NAMES[result.symbol] || result.symbol,
                price: quote.price,
                changePercent: quote.changePercent,
                confidence: Math.round(confidence),
                reason,
                technicalScore: result.weightedScore,
                direction: result.direction,
                signalClarity: result.clarityScore,
                signals: result.signals,
                updatedAt: new Date(),
            });

            console.log(`  #${picks.length} ${result.symbol}: ${result.direction} (confidence ${Math.round(confidence)}%)`);

            // Small delay for rate limiting
            await new Promise(resolve => setTimeout(resolve, 300));

        } catch (error) {
            console.warn(`❌ Error fetching quote for ${result.symbol}:`, error);
        }
    }

    // Final sort by confidence
    picks.sort((a, b) => b.confidence - a.confidence);

    console.log(`✅ Top ${picks.length} picks ready.\n`);
    return picks;
};

/**
 * Get today's top 10 stocks (with daily caching)
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

    console.log('🚀 Cache miss or force refresh: Running full screening...');
    const startTime = Date.now();

    // Stage 1: Screen all 100 stocks for signal clarity
    const clarityResults = await screenStocksForClarity();

    if (clarityResults.length === 0) {
        console.warn('⚠️ No stocks passed signal clarity filter');
        return [];
    }

    // Stage 2: Build top 10 picks with live data
    const top10 = await buildTopPicks(clarityResults);

    const elapsedSec = ((Date.now() - startTime) / 1000).toFixed(1);

    // Save to cache
    await DailyTopStocks.findOneAndUpdate(
        { date: today },
        {
            date: today,
            stocks: top10,
            totalAnalyzed: clarityResults.length,
            totalScanned: NIFTY_100.length,
            createdAt: new Date(),
        },
        { upsert: true, new: true }
    );

    console.log(`✅ Results cached for ${today} (took ${elapsedSec}s)`);
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
