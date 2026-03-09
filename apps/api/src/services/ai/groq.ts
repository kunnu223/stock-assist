/**
 * Groq AI Client
 * @module @stock-assist/api/services/ai/groq
 */

import Groq from 'groq-sdk';
import type { StockAnalysis } from '@stock-assist/shared';
import { buildPrompt, type PromptInput } from './prompt';
import { logger } from '../../config/logger';

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
                logger.debug({ model: modelName }, 'Groq model attempt');

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
                    logger.warn({ model: modelName }, 'Groq empty response');
                    continue;
                }

                logger.info({ model: modelName }, 'Groq analysis success');
                return parseResponse(text);
            } catch (error) {
                const msg = (error as Error).message;

                // Rate limit - try next model
                if (msg.includes('429') || msg.includes('rate_limit')) {
                    logger.warn({ model: modelName }, 'Groq rate limit, trying next model');
                    continue;
                }

                logger.warn({ model: modelName, error: msg }, 'Groq model failed');
                continue;
            }
        }
    } catch (error) {
        const msg = (error as Error).message;
        if (msg.includes('GROQ_API_KEY')) {
            logger.info('Groq: No API key configured');
        } else {
            logger.error({ error: msg }, 'Groq error');
        }
    }

    logger.error('Groq: All models failed');
    return null;
};
