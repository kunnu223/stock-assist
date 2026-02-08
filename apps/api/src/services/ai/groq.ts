/**
 * Groq AI Client
 * @module @stock-assist/api/services/ai/groq
 */

import Groq from 'groq-sdk';
import type { StockAnalysis } from '@stock-assist/shared';
import { buildPrompt, type PromptInput } from './prompt';

let groqClient: Groq | null = null;

/** Initialize Groq client */
const getClient = (): Groq => {
    const key = process.env.GROQ_API_KEY;
    if (!key || key === 'demo-key') {
        throw new Error('Valid GROQ_API_KEY not found in .env');
    }
    if (!groqClient) {
        groqClient = new Groq({ apiKey: key });
    }
    return groqClient;
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

/** Analyze stock with Groq AI */
export const analyzeWithGroq = async (input: PromptInput): Promise<StockAnalysis | null> => {
    // Groq models - llama-3.3-70b is fast and capable
    const modelsToTry = [
        'llama-3.3-70b-versatile',
        'llama-3.1-8b-instant',
        'mixtral-8x7b-32768',
    ];

    try {
        const client = getClient();
        const prompt = buildPrompt(input);

        for (const modelName of modelsToTry) {
            try {
                console.log(`[Groq] Attempting with model: ${modelName}`);

                const completion = await client.chat.completions.create({
                    model: modelName,
                    messages: [
                        {
                            role: 'system',
                            content: 'You are a professional stock market analyst. Respond only with valid JSON.',
                        },
                        {
                            role: 'user',
                            content: prompt,
                        },
                    ],
                    temperature: 0.3,
                    max_tokens: 2048,
                });

                const text = completion.choices[0]?.message?.content;
                if (!text) {
                    console.warn(`[Groq] Empty response from ${modelName}`);
                    continue;
                }

                console.log(`[Groq] ✅ Success with ${modelName}`);
                return parseResponse(text);
            } catch (error) {
                const msg = (error as Error).message;

                // Rate limit - try next model
                if (msg.includes('429') || msg.includes('rate_limit')) {
                    console.warn(`[Groq] ⏳ Rate limit on ${modelName}, trying next...`);
                    continue;
                }

                console.warn(`[Groq] ⚠️ Failed with ${modelName}: ${msg}`);
                continue;
            }
        }
    } catch (error) {
        const msg = (error as Error).message;
        if (msg.includes('GROQ_API_KEY')) {
            console.log('[Groq] No API key configured');
        } else {
            console.error(`[Groq] Error: ${msg}`);
        }
    }

    console.warn('[Groq] ❌ All models failed');
    return null;
};
