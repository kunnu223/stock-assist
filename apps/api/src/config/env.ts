/**
 * Environment Configuration
 * @module @stock-assist/api/config/env
 */

export const config = {
    port: Number(process.env.PORT) || 4000,
    mongoUri: process.env.MONGODB_URI || '',
    geminiKey: process.env.GEMINI_API_KEY || '',
    aiProvider: process.env.AI_PROVIDER || 'gemini',
    isDev: process.env.NODE_ENV !== 'production',
};

export const validateEnv = (): void => {
    const required = ['MONGODB_URI', 'GEMINI_API_KEY'];
    const missing = required.filter((key) => !process.env[key]);

    if (missing.length > 0) {
        throw new Error(`Missing env vars: ${missing.join(', ')}`);
    }
};
