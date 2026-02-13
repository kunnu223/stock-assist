/**
 * Ensemble AI Service
 * Runs Groq and Gemini in parallel, averages results,
 * penalizes disagreement, uses rule-based tiebreaker.
 * @module @stock-assist/api/services/ai/ensembleAI
 */

import type { StockAnalysis } from '@stock-assist/shared';
import { analyzeWithGroq } from './groq';
import { analyzeWithGemini } from './gemini';
import type { PromptInput } from './prompt';

export interface EnsembleResult {
    analysis: StockAnalysis;
    groqConfidence: number | null;
    geminiConfidence: number | null;
    agreement: 'HIGH' | 'MODERATE' | 'LOW';
    disagreementPenalty: number;
    modelUsed: 'ensemble' | 'groq' | 'gemini' | 'fallback';
}

/**
 * Run ensemble AI analysis
 * 1. Run Groq + Gemini in parallel with same prompt input
 * 2. Average confidence scores
 * 3. Apply disagreement penalty if >20 point gap
 * 4. Rule-based tiebreaker if models disagree on direction
 */
export async function analyzeWithEnsemble(
    input: PromptInput,
    systemConfidence: number
): Promise<EnsembleResult | null> {
    console.log(`[EnsembleAI] 🧠 Starting ensemble analysis for ${input.stock.symbol}...`);

    // Run both models in parallel
    const [groqResult, geminiResult] = await Promise.allSettled([
        analyzeWithGroq(input),
        analyzeWithGemini(input),
    ]);

    const groqAnalysis = groqResult.status === 'fulfilled' ? groqResult.value : null;
    const geminiAnalysis = geminiResult.status === 'fulfilled' ? geminiResult.value : null;

    if (groqResult.status === 'rejected') {
        console.warn(`[EnsembleAI] Groq rejected:`, groqResult.reason);
    }
    if (geminiResult.status === 'rejected') {
        console.warn(`[EnsembleAI] Gemini rejected:`, geminiResult.reason);
    }

    const groqConf = extractConfidence(groqAnalysis);
    const geminiConf = extractConfidence(geminiAnalysis);

    console.log(`[EnsembleAI] Groq: ${groqConf !== null ? groqConf + '%' : 'FAILED'}, Gemini: ${geminiConf !== null ? geminiConf + '%' : 'FAILED'}`);

    // Case 1: Both models succeeded → merge
    if (groqAnalysis && geminiAnalysis && groqConf !== null && geminiConf !== null) {
        const gap = Math.abs(groqConf - geminiConf);
        let agreement: EnsembleResult['agreement'];
        let disagreementPenalty = 0;

        if (gap <= 10) {
            agreement = 'HIGH';
        } else if (gap <= 20) {
            agreement = 'MODERATE';
        } else {
            agreement = 'LOW';
            disagreementPenalty = -15;
            console.log(`[EnsembleAI] ⚠️ HIGH disagreement: ${gap}pt gap → -15% penalty`);
        }

        // Average confidence
        let avgConfidence = Math.round((groqConf + geminiConf) / 2) + disagreementPenalty;
        avgConfidence = Math.max(20, Math.min(95, avgConfidence));

        // Merge: use Groq as base (larger model, more detailed), override confidence
        const merged = mergeAnalyses(groqAnalysis, geminiAnalysis, avgConfidence, systemConfidence);

        console.log(`[EnsembleAI] ✅ Ensemble complete: Groq=${groqConf}%, Gemini=${geminiConf}%, Avg=${avgConfidence}%, Agreement=${agreement}`);

        return {
            analysis: merged,
            groqConfidence: groqConf,
            geminiConfidence: geminiConf,
            agreement,
            disagreementPenalty,
            modelUsed: 'ensemble',
        };
    }

    // Case 2: Only Groq succeeded
    if (groqAnalysis) {
        console.log(`[EnsembleAI] Using Groq only (Gemini failed)`);
        return {
            analysis: groqAnalysis,
            groqConfidence: groqConf,
            geminiConfidence: null,
            agreement: 'MODERATE',
            disagreementPenalty: 0,
            modelUsed: 'groq',
        };
    }

    // Case 3: Only Gemini succeeded
    if (geminiAnalysis) {
        console.log(`[EnsembleAI] Using Gemini only (Groq failed)`);
        return {
            analysis: geminiAnalysis,
            groqConfidence: null,
            geminiConfidence: geminiConf,
            agreement: 'MODERATE',
            disagreementPenalty: 0,
            modelUsed: 'gemini',
        };
    }

    // Case 4: Both failed
    console.error(`[EnsembleAI] ❌ Both models failed for ${input.stock.symbol}`);
    return null;
}

/**
 * Extract confidence score from an AI analysis result
 */
function extractConfidence(analysis: StockAnalysis | null): number | null {
    if (!analysis) return null;

    // Try confidenceScore field first
    if (typeof analysis.confidenceScore === 'number') return analysis.confidenceScore;

    // Try extracting from confidence string
    if (analysis.confidence === 'HIGH') return 80;
    if (analysis.confidence === 'MEDIUM') return 60;
    if (analysis.confidence === 'LOW') return 40;

    return null;
}

/**
 * Merge two AI analyses with averaged confidence
 * Uses Groq as base (70b model = more detailed), applies averaged confidence,
 * and applies rule-based tiebreaker for direction disagreement
 */
function mergeAnalyses(
    groq: StockAnalysis,
    gemini: StockAnalysis,
    avgConfidence: number,
    systemConfidence: number
): StockAnalysis {
    // Use groq as base since 70b model gives richer analysis
    const merged = { ...groq };

    // Override confidence with ensemble average
    merged.confidenceScore = avgConfidence;
    merged.confidence = avgConfidence > 70 ? 'HIGH' : avgConfidence > 50 ? 'MEDIUM' : 'LOW';

    // Rule-based tiebreaker: if models disagree on direction
    const groqBias = normalizeBias(groq.bias);
    const geminiBias = normalizeBias(gemini.bias);

    if (groqBias !== geminiBias && groqBias !== 'NEUTRAL' && geminiBias !== 'NEUTRAL') {
        // Models disagree on direction → use system confidence as tiebreaker
        console.log(`[EnsembleAI] 🔄 Direction disagreement: Groq=${groqBias}, Gemini=${geminiBias} → Using system confidence (${systemConfidence}%) as tiebreaker`);

        if (systemConfidence >= 60) {
            // System has an opinion — keep the model that agrees with system
            const systemBias = systemConfidence >= 60 ? 'BULLISH' : 'BEARISH'; // From recommendation context
            if (geminiBias === systemBias) {
                merged.bias = gemini.bias;
                merged.recommendation = gemini.recommendation;
            }
            // else keep groq (already the base)
        } else {
            // System is uncertain too → downgrade to NEUTRAL/HOLD
            merged.bias = 'NEUTRAL';
            merged.recommendation = 'HOLD';
            merged.confidenceScore = Math.min(avgConfidence, 50);
            merged.confidence = 'LOW';
        }
    }

    // Merge risk arrays (combine unique risks) — AI returns extra fields not in StockAnalysis type
    const groqAny = groq as any;
    const geminiAny = gemini as any;
    if (groqAny.risks && geminiAny.risks) {
        const allRisks = new Set([
            ...(Array.isArray(groqAny.risks) ? groqAny.risks : []),
            ...(Array.isArray(geminiAny.risks) ? geminiAny.risks : [])
        ]);
        (merged as any).risks = Array.from(allRisks).slice(0, 5);
    }

    // Average bullish/bearish probabilities if both present
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
