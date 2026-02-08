/**
 * Gemini AI Client
 * @module @stock-assist/api/services/ai/gemini
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import type { StockAnalysis } from '@stock-assist/shared';
import { buildPrompt, type PromptInput } from './prompt';

let genAI: GoogleGenerativeAI | null = null;

// Helper for delay
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/** Initialize Gemini client */
const getClient = (): GoogleGenerativeAI => {
    const key = process.env.GEMINI_API_KEY;
    if (!key || key === 'demo-key') {
        throw new Error('Valid GEMINI_API_KEY not found in .env (Demo Mode AI enabled)');
    }
    if (!genAI) {
        genAI = new GoogleGenerativeAI(key);
    }
    return genAI;
};

/** Parse AI response to JSON */
const parseResponse = (text: string): StockAnalysis | null => {
    try {
        let clean = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        const start = clean.indexOf('{');
        const end = clean.lastIndexOf('}');
        if (start === -1 || end === -1) return null;

        const data = JSON.parse(clean.substring(start, end + 1));
        if (!data.stock || !data.bias) return null;

        return data as StockAnalysis;
    } catch {
        return null;
    }
};

/** Analyze stock with Gemini AI */
export const analyzeWithGemini = async (input: PromptInput): Promise<StockAnalysis | null> => {
    // Models found in your account
    const modelsToTry = [
        'gemini-2.0-flash', // The only model confirmed to exist (others 404)
    ];

    const client = getClient();
    const prompt = buildPrompt(input);

    for (const modelName of modelsToTry) {
        // Simple retry logic for 429 (Rate Limit)
        let attempts = 0;
        const maxAttempts = 2;

        while (attempts < maxAttempts) {
            try {
                attempts++;
                const model = client.getGenerativeModel({ model: modelName });
                console.log(`[Gemini] Attempting to generate with model: ${modelName} (Attempt ${attempts})`);

                const result = await model.generateContent(prompt);
                const text = result.response.text();

                console.log(`[Gemini] ✅ Success with ${modelName}`);
                return parseResponse(text);
            } catch (error) {
                const msg = (error as Error).message;

                // Handle Demo Mode gracefully
                if (msg.includes('Demo Mode')) {
                    console.log('[Gemini] Demo Mode active - Skipping AI generation');
                    return null;
                }

                // Handle Rate Limit (429)
                if (msg.includes('429') || msg.includes('Too Many Requests')) {
                    console.warn(`[Gemini] ⏳ Rate limit hit on ${modelName}. Waiting 2s...`);
                    await delay(2000); // Backoff for 2 seconds
                    continue; // Retry same model
                }

                // For other errors (404, 500), log and break to try next model
                console.warn(`[Gemini] ⚠️ Failed with ${modelName}: ${msg.split(']')[1] || msg}`);
                break; // Break inner loop, go to next model
            }
        }
    }

    console.error('[Gemini] ❌ All models failed (likely due to rate limits or invalid models).');
    return null;
};
