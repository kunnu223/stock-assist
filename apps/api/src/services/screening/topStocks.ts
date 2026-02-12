/**
 * Top Stocks Service (Enhanced)
 * Screens NIFTY 100 stocks using code-level signal clarity scoring
 * with quality gates, signal persistence, and parallel processing.
 *
 * Pipeline: NIFTY 100 → Pre-Filter → Clarity Filter → Quality Gates → Top 10
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
import { runQualityGates } from './qualityGates';
import type { OHLCData } from '@stock-assist/shared';

// ─── In-Memory History Cache (6-hour TTL) ───────────────

interface CachedHistory {
    data: OHLCData[];
    timestamp: number;
}

const historyCache = new Map<string, CachedHistory>();
const CACHE_TTL = 6 * 60 * 60 * 1000; // 6 hours

function getCachedHistory(symbol: string): OHLCData[] | null {
    const cached = historyCache.get(symbol);
    if (cached && (Date.now() - cached.timestamp) < CACHE_TTL) {
        return cached.data;
    }
    return null;
}

function setCachedHistory(symbol: string, data: OHLCData[]): void {
    historyCache.set(symbol, { data, timestamp: Date.now() });
}

// ─── Helpers ────────────────────────────────────────────

const getTodayKey = (): string => {
    return new Date().toISOString().split('T')[0];
};

/** Split array into chunks */
function chunk<T>(arr: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < arr.length; i += size) {
        chunks.push(arr.slice(i, i + size));
    }
    return chunks;
}

/** Delay helper */
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// ─── Stage 0: Pre-Filter ───────────────────────────────

interface PreFilterResult {
    symbol: string;
    history: OHLCData[];
}

/**
 * Light pre-filter: fetch history and skip stocks with
 * insufficient data or extremely low volume.
 */
async function preFilterStock(symbol: string): Promise<PreFilterResult | null> {
    try {
        // Check in-memory cache first
        let history = getCachedHistory(symbol);
        if (!history) {
            history = await fetchHistory(symbol, '3mo', '1d');
            if (history.length > 0) {
                setCachedHistory(symbol, history);
            }
        }

        // Skip: insufficient data for EMA26
        if (history.length < 26) {
            return null;
        }

        // Skip: volume < 50% of 20-day average (inactive)
        if (history.length >= 21) {
            const last20 = history.slice(-21, -1);
            const avgVol = last20.reduce((sum, d) => sum + d.volume, 0) / 20;
            const currentVol = history[history.length - 1].volume;
            if (avgVol > 0 && currentVol / avgVol < 0.5) {
                return null;
            }
        }

        return { symbol, history };
    } catch {
        return null;
    }
}

// ─── Stage 1: Clarity Filter + Quality Gates ────────────

interface ScreeningResult {
    clarity: SignalClarityResult;
    history: OHLCData[];
    confidenceAdjustment: number;
}

/**
 * Analyze a single stock: clarity scoring + quality gates.
 */
function analyzeStock(symbol: string, history: OHLCData[]): ScreeningResult | null {
    const clarity = calculateSignalClarity(symbol, history);

    if (!clarity || clarity.clarityScore < MIN_CLARITY_THRESHOLD) {
        return null;
    }

    // Run quality gates
    const gateResult = runQualityGates(symbol, clarity, history);
    if (!gateResult.passed) {
        return null;
    }

    return {
        clarity,
        history,
        confidenceAdjustment: gateResult.confidenceAdjustment,
    };
}

// ─── Enhanced Confidence Formula ─────────────────────────

function calculateEnhancedConfidence(
    weightedScore: number,
    clarityScore: number,
    volumeConfirmed: boolean,
    signalAge: number,
    gateAdjustment: number
): number {
    let confidence = weightedScore;

    // Boost: strong consensus (5-6 indicators agree)
    if (clarityScore >= 83) {
        confidence += 5;
    }

    // Boost/penalty: volume confirmation
    if (volumeConfirmed) {
        confidence += 5;
    } else if (clarityScore >= 80) {
        confidence -= 10; // High clarity but no volume = suspicious
    }

    // Graduated signal persistence
    if (signalAge === 3) {
        confidence += 8;  // 3-day persistence (strongest)
    } else if (signalAge === 2) {
        confidence += 5;  // 2-day persistence (moderate)
    } else {
        confidence -= 8;  // 1-day spike (weakest)
    }

    // Quality gate adjustments
    confidence += gateAdjustment;

    // Clamp [50, 95]
    return Math.min(95, Math.max(50, Math.round(confidence)));
}

// ─── Main Pipeline ──────────────────────────────────────

/**
 * Stage 1: Screen all NIFTY 100 stocks with pre-filter + clarity + quality gates.
 * Uses parallel batch processing (5 at a time).
 */
export const screenStocksForClarity = async (): Promise<{
    results: ScreeningResult[];
    stats: {
        totalScanned: number;
        passedPreFilter: number;
        passedClarity: number;
        passedQualityGates: number;
    };
}> => {
    const universe = NIFTY_100;
    console.log(`\n🔍 [TopStocks] Screening ${universe.length} stocks...`);

    // ── Stage 0: Pre-Filter (parallel batches of 5) ──
    console.log(`[TopStocks] Stage 0: Pre-filtering...`);
    const preFiltered: PreFilterResult[] = [];
    const batches = chunk(universe, 5);

    for (const batch of batches) {
        const batchResults = await Promise.all(batch.map(preFilterStock));
        for (const result of batchResults) {
            if (result) preFiltered.push(result);
        }
        await delay(1000); // Respect rate limits between batches
    }

    console.log(`[TopStocks] Pre-filter: ${universe.length} → ${preFiltered.length} stocks`);

    // ── Stage 1: Clarity Filter + Quality Gates ──
    console.log(`[TopStocks] Stage 1: Clarity analysis + quality gates...`);
    const results: ScreeningResult[] = [];
    let passedClarity = 0;

    for (const { symbol, history } of preFiltered) {
        const result = analyzeStock(symbol, history);
        if (result) {
            // Count clarity passes (before quality gates may have filtered)
            passedClarity++;
            results.push(result);

            const { clarity } = result;
            const ageLabel = clarity.signalAge >= 2 ? ` [${clarity.signalAge}-day]` : '';
            console.log(`  ✅ ${symbol}: ${clarity.summary}${ageLabel} (weighted: ${clarity.weightedScore})`);
        }
    }

    // Sort by weighted score
    results.sort((a, b) => b.clarity.weightedScore - a.clarity.weightedScore);

    const stats = {
        totalScanned: universe.length,
        passedPreFilter: preFiltered.length,
        passedClarity,
        passedQualityGates: results.length,
    };

    // Filter funnel log
    console.log(`\n📊 [TopStocks] Filter Funnel:`);
    console.log(`   NIFTY 100 (${stats.totalScanned}) → Pre-filter (${stats.passedPreFilter}) → Clarity+Gates (${stats.passedQualityGates})`);

    return { results, stats };
};

/**
 * Stage 2: Build top picks from screening results.
 * Fetches live quotes and applies enhanced confidence formula.
 */
export const buildTopPicks = async (
    screeningResults: ScreeningResult[]
): Promise<IStockPick[]> => {
    console.log(`\n🏆 Building top ${Math.min(10, screeningResults.length)} picks...`);

    const picks: IStockPick[] = [];
    const top = screeningResults.slice(0, 10);

    for (const { clarity, confidenceAdjustment } of top) {
        try {
            const quote = await fetchQuote(clarity.symbol);

            // Enhanced confidence
            const confidence = calculateEnhancedConfidence(
                clarity.weightedScore,
                clarity.clarityScore,
                clarity.volumeConfirmed,
                clarity.signalAge,
                confidenceAdjustment
            );

            // Build descriptive reason
            const alignedSignals = clarity.signals
                .filter(s => s.direction === clarity.direction)
                .map(s => s.name)
                .join(', ');

            const volStr = clarity.volumeConfirmed ? ' ✓vol' : '';
            const ageStr = clarity.signalAge >= 2 ? ` [${clarity.signalAge}-day]` : '';
            const reason = `${clarity.summary}${volStr}${ageStr}. Key signals: ${alignedSignals}`;

            picks.push({
                symbol: clarity.symbol,
                name: quote.name || STOCK_NAMES[clarity.symbol] || clarity.symbol,
                price: quote.price,
                changePercent: quote.changePercent,
                confidence,
                reason,
                technicalScore: clarity.weightedScore,
                direction: clarity.direction,
                signalClarity: clarity.clarityScore,
                signals: clarity.signals,
                updatedAt: new Date(),
                // Enhanced fields
                volumeConfirmed: clarity.volumeConfirmed,
                indicatorVotes: clarity.indicatorVotes,
                signalAge: clarity.signalAge,
                signalStrength: clarity.signalStrength,
            });

            console.log(`  #${picks.length} ${clarity.symbol}: ${clarity.direction} (conf ${confidence}%, age ${clarity.signalAge})`);

            await delay(300);
        } catch (error) {
            console.warn(`❌ Error fetching quote for ${clarity.symbol}:`, error);
        }
    }

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

    console.log('🚀 Cache miss or force refresh: Running full enhanced screening...');
    const startTime = Date.now();

    // Stage 1: Screen all stocks
    const { results, stats } = await screenStocksForClarity();

    if (results.length === 0) {
        console.warn('⚠️ No stocks passed all filters');
        return [];
    }

    // Stage 2: Build top 10 picks with live data
    const top10 = await buildTopPicks(results);
    const elapsedSec = ((Date.now() - startTime) / 1000).toFixed(1);

    // Calculate signal persistence stats
    const signalPersistence = {
        age3: top10.filter(s => s.signalAge === 3).length,
        age2: top10.filter(s => s.signalAge === 2).length,
        age1: top10.filter(s => s.signalAge === 1).length,
    };

    const avgConfidence = top10.length > 0
        ? Math.round(top10.reduce((sum, s) => sum + s.confidence, 0) / top10.length)
        : 0;

    // Save to cache
    await DailyTopStocks.findOneAndUpdate(
        { date: today },
        {
            date: today,
            stocks: top10,
            totalAnalyzed: stats.passedQualityGates,
            totalScanned: NIFTY_100.length,
            createdAt: new Date(),
            // Enhanced metadata
            passedPreFilter: stats.passedPreFilter,
            passedClarity: stats.passedClarity,
            passedQualityGates: stats.passedQualityGates,
            avgConfidence,
            scanDuration: parseFloat(elapsedSec),
            signalPersistence,
        },
        { upsert: true, new: true }
    );

    // Final summary
    console.log(`\n✅ [TopStocks] Scan complete in ${elapsedSec}s:`);
    console.log(`   Avg Confidence: ${avgConfidence}%`);
    console.log(`   Signal Persistence: ${signalPersistence.age3} strong, ${signalPersistence.age2} moderate, ${signalPersistence.age1} weak`);
    console.log(`   Direction: ${top10.filter(s => s.direction === 'bullish').length} bullish, ${top10.filter(s => s.direction === 'bearish').length} bearish`);
    console.log(`   Results cached for ${today}\n`);

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
