/**
 * Ensemble AI Service — v2 (qualitative only)
 * Runs Groq and Gemini in parallel for richer analysis.
 * AI NO LONGER contributes to numeric probability scoring.
 * AI provides: reasoning, risks, bias explanation, scenario narratives.
 * 
 * v1: averaged AI confidence + disagreement penalty → numeric score
 * v2: AI is qualitative only — system confidence is the sole probability source
 * 
 * @module @stock-assist/api/services/ai/ensembleAI
 */

import type { StockAnalysis } from '@stock-assist/shared';
import { analyzeWithGroq } from './groq';
import { analyzeWithGemini } from './gemini';
import type { PromptInput } from './prompt';
import { logger } from '../../config/logger';

export interface EnsembleResult {
    analysis: StockAnalysis;
    role: 'qualitative-only';   // AI no longer votes on probability
    agreement: 'HIGH' | 'MODERATE' | 'LOW';  // Direction agreement between models
    modelUsed: 'ensemble' | 'groq' | 'gemini' | 'fallback';
}

/**
 * Run ensemble AI analysis — qualitative only
 * 1. Run Groq + Gemini in parallel
 * 2. Merge qualitative output (reasoning, risks, scenarios)
 * 3. Check direction agreement for logging purposes
 * 4. System confidence is NOT modified by AI
 */
export async function analyzeWithEnsemble(
    input: PromptInput,
    systemConfidence: number
): Promise<EnsembleResult | null> {
    logger.info({ symbol: input.stock.symbol }, 'Starting qualitative ensemble analysis');

    // Run both models in parallel
    const [groqResult, geminiResult] = await Promise.allSettled([
        analyzeWithGroq(input),
        analyzeWithGemini(input),
    ]);

    const groqAnalysis = groqResult.status === 'fulfilled' ? groqResult.value : null;
    const geminiAnalysis = geminiResult.status === 'fulfilled' ? geminiResult.value : null;

    if (groqResult.status === 'rejected') {
        logger.warn({ err: groqResult.reason }, 'EnsembleAI: Groq rejected');
    }
    if (geminiResult.status === 'rejected') {
        logger.warn({ err: geminiResult.reason }, 'EnsembleAI: Gemini rejected');
    }

    // Case 1: Both models succeeded → merge qualitative output
    if (groqAnalysis && geminiAnalysis) {
        const groqBias = normalizeBias(groqAnalysis.bias);
        const geminiBias = normalizeBias(geminiAnalysis.bias);

        let agreement: EnsembleResult['agreement'];
        if (groqBias === geminiBias) {
            agreement = 'HIGH';
        } else if (groqBias === 'NEUTRAL' || geminiBias === 'NEUTRAL') {
            agreement = 'MODERATE';
        } else {
            agreement = 'LOW';
            logger.info({ groq: groqBias, gemini: geminiBias }, 'EnsembleAI: Direction disagreement');
        }

        // Merge qualitative output (NO confidence override)
        const merged = mergeAnalyses(groqAnalysis, geminiAnalysis, systemConfidence);

        logger.info({ agreement }, 'Qualitative ensemble complete (both models)');

        return {
            analysis: merged,
            role: 'qualitative-only',
            agreement,
            modelUsed: 'ensemble',
        };
    }

    // Case 2: Only Groq succeeded
    if (groqAnalysis) {
        logger.info('EnsembleAI: Using Groq only (Gemini failed)');
        return {
            analysis: groqAnalysis,
            role: 'qualitative-only',
            agreement: 'MODERATE',
            modelUsed: 'groq',
        };
    }

    // Case 3: Only Gemini succeeded
    if (geminiAnalysis) {
        logger.info('EnsembleAI: Using Gemini only (Groq failed)');
        return {
            analysis: geminiAnalysis,
            role: 'qualitative-only',
            agreement: 'MODERATE',
            modelUsed: 'gemini',
        };
    }

    // Case 4: Both failed
    logger.error({ symbol: input.stock.symbol }, 'EnsembleAI: Both models failed');
    return null;
}

/**
 * Merge two AI analyses — qualitative only
 * Uses Groq as base (70b model = more detailed),
 * merges risks and scenarios from both models.
 * Does NOT touch confidenceScore — that is system-only.
 */
function mergeAnalyses(
    groq: StockAnalysis,
    gemini: StockAnalysis,
    systemConfidence: number
): StockAnalysis {
    // Use groq as base since 70b model gives richer analysis
    const merged = { ...groq };

    // DO NOT override confidence — system scoring is the sole authority
    // merged.confidenceScore is left as whatever Groq returned (for narrative only)
    // The actual confidence used in the response is `adjustedConfidence` from analyze.ts

    // Rule-based tiebreaker: if models disagree on direction
    const groqBias = normalizeBias(groq.bias);
    const geminiBias = normalizeBias(gemini.bias);

    if (groqBias !== geminiBias && groqBias !== 'NEUTRAL' && geminiBias !== 'NEUTRAL') {
        logger.info({ groq: groqBias, gemini: geminiBias }, 'EnsembleAI: Direction disagreement, using system direction');

        // System decides direction — AI doesn't get a vote
        if (systemConfidence >= 60) {
            // Keep groq's base analysis (richer) — direction is overridden by system in analyze.ts anyway
        } else {
            // System uncertain + AI disagrees → downgrade to neutral narrative
            merged.bias = 'NEUTRAL';
            merged.recommendation = 'HOLD';
        }
    }

    // Merge risk arrays (combine unique risks from both models)
    const groqAny = groq as any;
    const geminiAny = gemini as any;
    if (groqAny.risks && geminiAny.risks) {
        const allRisks = new Set([
            ...(Array.isArray(groqAny.risks) ? groqAny.risks : []),
            ...(Array.isArray(geminiAny.risks) ? geminiAny.risks : [])
        ]);
        (merged as any).risks = Array.from(allRisks).slice(0, 5);
    }

    // Average bullish/bearish probabilities from AI for narrative context only
    // (these are displayed as AI's view, not the system's probability)
    if (groq.bullish?.probability && gemini.bullish?.probability) {
        merged.bullish = {
            ...groq.bullish,
            probability: Math.round((groq.bullish.probability + gemini.bullish.probability) / 2),
        };
    }
    if (groq.bearish?.probability && gemini.bearish?.probability) {
        merged.bearish = {
            ...groq.bearish,
            probability: Math.round((groq.bearish.probability + gemini.bearish.probability) / 2),
        };
    }

    return merged;
}

/**
 * Normalize bias to standard form
 */
function normalizeBias(bias: any): string {
    if (typeof bias === 'object') {
        return String(bias.bias || bias.trend || 'NEUTRAL').toUpperCase();
    }
    return String(bias || 'NEUTRAL').toUpperCase();
}
