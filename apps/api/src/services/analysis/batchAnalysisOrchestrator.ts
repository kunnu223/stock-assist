/**
 * Batch Analysis Orchestrator
 * Handles morning screening (batch processing multiple stocks)
 * Extracted from analyze.ts route handler
 * @module @stock-assist/api/services/analysis/batchAnalysisOrchestrator
 */

import { getMultipleStocks } from '../data';
import { calcIndicators } from '../indicators';
import { analyzePatterns } from '../patterns';
import { fetchNews } from '../news';
import { analyzeWithAI } from '../ai';
import { validateStockData, validateAIResponse, calculateAverageVolume } from '../../utils/validation';
import { shouldTrade, checkRedFlags } from '../../utils/tradeDecision';
import { savePrediction, applyCalibration } from '../backtest';
import { checkTimeframeAlignment, getAlignmentSummary } from '../../utils/timeframeAlignment';
import { logger } from '../../config/logger';
import type { StockData } from '@stock-assist/shared';

// ═══════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════

export interface ScreeningResult {
    success: boolean;
    date: string;
    processingTime: string;
    totalStocks: number;
    circuitBreakerTriggered: boolean;
    strongSetups: Record<string, unknown>[];
    neutral: Record<string, unknown>[];
    avoid: Record<string, unknown>[];
}

// ═══════════════════════════════════════════════════════════════
// BATCH PROCESSING
// ═══════════════════════════════════════════════════════════════

/** Time budget (ms) to ensure response before timeout */
const TIME_BUDGET_MS = 50000;

/**
 * Run morning screening on a watchlist of stocks.
 * Processes sequentially with circuit breaker for AI failures.
 */
export async function screenStocks(watchlist: string[]): Promise<ScreeningResult> {
    const start = Date.now();

    logger.info({ watchlist }, 'Morning screening started');
    const stocks = await getMultipleStocks(watchlist);
    logger.info({ count: stocks.length }, 'Stock data fetched');

    const results: Record<string, unknown>[] = [];
    let consecutiveAIFailures = 0;
    let skipAI = false;

    for (const stock of stocks) {
        // Check time budget
        if (Date.now() - start > TIME_BUDGET_MS) {
            logger.warn({ elapsed: ((Date.now() - start) / 1000).toFixed(1) }, 'Time budget exceeded, skipping remaining stocks');
            break;
        }

        // Execute analysis
        const result = await processStock(stock, skipAI);
        results.push(result);

        // Update circuit breaker
        if (!skipAI) {
            const aiFailed = (result.warnings as string[] | undefined)?.some((w: string) => w.includes('AI analysis not available'));
            if (aiFailed) {
                consecutiveAIFailures++;
                logger.warn({ symbol: stock.symbol, count: consecutiveAIFailures }, 'Consecutive AI failure');
            } else {
                consecutiveAIFailures = 0;
            }

            if (consecutiveAIFailures >= 2) {
                logger.warn('Circuit breaker triggered — disabling AI for remaining stocks');
                skipAI = true;
            }
        }

        // Delay between requests
        if (!skipAI && (Date.now() - start < TIME_BUDGET_MS - 5000)) {
            await new Promise(resolve => setTimeout(resolve, 500));
        }
    }

    const strongSetups = results.filter((r) => r.category === 'STRONG_SETUP');
    const avoid = results.filter((r) => r.category === 'AVOID');
    const neutral = results.filter((r) => r.category === 'NEUTRAL');

    logger.info({ strong: strongSetups.length, neutral: neutral.length, avoid: avoid.length }, 'Screening complete');

    return {
        success: true,
        date: new Date().toISOString().split('T')[0],
        processingTime: `${((Date.now() - start) / 1000).toFixed(1)}s`,
        totalStocks: results.length,
        circuitBreakerTriggered: skipAI,
        strongSetups,
        neutral,
        avoid,
    };
}

// ═══════════════════════════════════════════════════════════════
// SINGLE STOCK PROCESSOR (for batch)
// ═══════════════════════════════════════════════════════════════

/**
 * Analyze a single stock (for batch processing).
 * Simpler than the full single-stock orchestrator — uses basic AI analysis.
 */
async function processStock(stock: StockData, skipAI: boolean = false): Promise<Record<string, unknown>> {
    logger.debug({ symbol: stock.symbol, skipAI }, 'Processing stock');
    try {
        // Validate stock data quality
        const avgVolume = calculateAverageVolume(stock.history);
        const dataValidation = validateStockData({
            symbol: stock.symbol,
            history: stock.history,
            avgVolume
        });

        if (!dataValidation.isValid) {
            logger.error({ symbol: stock.symbol, errors: dataValidation.errors }, 'Data validation failed');
            return {
                stock: stock.symbol,
                category: 'AVOID',
                bias: 'NEUTRAL',
                confidence: 'LOW',
                recommendation: `Data quality issues: ${dataValidation.errors.join(', ')}`,
                errors: dataValidation.errors
            };
        }

        const indicators = calcIndicators(stock.history);

        // Calculate multi-timeframe indicators
        const weeklyIndicators = stock.timeframes?.weekly ? calcIndicators(stock.timeframes.weekly) : undefined;
        const monthlyIndicators = stock.timeframes?.monthly ? calcIndicators(stock.timeframes.monthly) : undefined;

        // Check multi-timeframe alignment
        const alignment = checkTimeframeAlignment(indicators, weeklyIndicators, monthlyIndicators);
        const alignmentSummary = getAlignmentSummary(indicators, weeklyIndicators, monthlyIndicators);
        logger.debug({ symbol: stock.symbol, alignment: alignmentSummary }, 'Timeframe alignment');

        const patterns = analyzePatterns(stock.history);
        const news = await fetchNews(stock.symbol);

        let aiResponse = null;

        if (!skipAI) {
            logger.debug({ symbol: stock.symbol }, 'Running AI analysis');
            aiResponse = await analyzeWithAI({
                stock,
                indicators,
                patterns,
                news,
                weeklyIndicators,
                monthlyIndicators
            });
        }

        if (!aiResponse) {
            const reason = skipAI ? 'AI Skipped (Circuit Breaker)' : 'AI unavailable (Rate Limit/Demo Mode)';
            if (!skipAI) logger.warn({ symbol: stock.symbol, reason }, 'AI unavailable');

            const redFlags = checkRedFlags({
                bias: 'NEUTRAL',
                confidence: 'LOW',
                explanation: reason,
                indicators,
                pattern: patterns.primary,
                news
            });

            return {
                stock: stock.symbol,
                category: 'NEUTRAL',
                tradeDecision: {
                    shouldTrade: false,
                    reason: reason
                },
                bias: 'NEUTRAL',
                confidence: 'LOW',
                recommendation: reason,
                warnings: ['AI analysis not available', reason],
                redFlags: redFlags.failedChecks,
                validationPassed: true,
                indicators,
                pattern: patterns.primary,
                news,
                timeframeAlignment: alignment
            };
        }

        // Validate AI response
        const aiValidation = validateAIResponse(aiResponse, stock.symbol);
        if (!aiValidation.isValid) {
            logger.error({ symbol: stock.symbol, errors: aiValidation.errors }, 'AI validation failed');
            return {
                stock: stock.symbol,
                category: 'AVOID',
                bias: 'NEUTRAL',
                confidence: 'LOW',
                recommendation: 'AI response validation failed',
                errors: aiValidation.errors
            };
        }

        // Apply probability calibration
        let calibratedResponse = aiResponse as Record<string, any>;
        try {
            calibratedResponse = await applyCalibration(aiResponse);
        } catch (calError) {
            logger.warn({ symbol: stock.symbol, err: calError }, 'Calibration failed, using raw AI response');
        }

        // Apply trade decision logic
        const decision = shouldTrade({
            ...calibratedResponse,
            indicators,
            pattern: patterns.primary
        });

        // Merge all warnings
        const allWarnings = [
            ...dataValidation.warnings,
            ...aiValidation.warnings,
            ...decision.warnings
        ];

        // Check red flags
        const redFlags = checkRedFlags({
            ...calibratedResponse,
            indicators,
            pattern: patterns.primary,
            news
        });

        // Build final analysis result
        const analysis = {
            ...calibratedResponse,
            category: decision.category,
            tradeDecision: {
                shouldTrade: decision.shouldTrade,
                reason: decision.reason
            },
            redFlags: redFlags.failedChecks,
            warnings: allWarnings,
            validationPassed: dataValidation.isValid && aiValidation.isValid,
            timeframeAlignment: alignment
        };

        // Auto-save prediction for strong setups
        if (decision.category === 'STRONG_SETUP') {
            savePrediction(analysis).catch((err: unknown) => {
                logger.warn({ symbol: stock.symbol, err }, 'Failed to save prediction');
            });
        }

        logger.debug({ symbol: stock.symbol, category: decision.category }, 'Stock processing complete');
        return analysis;

    } catch (err) {
        logger.error({ symbol: stock.symbol, err }, 'Error processing stock');
        return {
            stock: stock.symbol,
            category: 'AVOID',
            bias: 'NEUTRAL',
            confidence: 'LOW',
            recommendation: `Analysis failed: ${err}`,
            error: String(err)
        };
    }
}
