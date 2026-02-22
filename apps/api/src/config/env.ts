/**
 * Environment Configuration
 * @module @stock-assist/api/config/env
 *
 * Validates environment variables at startup.
 * Warns for missing optional vars (demo-friendly).
 */

import { logger } from './logger';

export const config = {
    nodeEnv: (process.env.NODE_ENV || 'development') as 'development' | 'production' | 'test',
    port: Number(process.env.PORT) || 4000,
    mongoUri: process.env.MONGODB_URI || '',
    geminiKey: process.env.GEMINI_API_KEY || '',
    groqKey: process.env.GROQ_API_KEY || '',
    aiProvider: process.env.AI_PROVIDER || 'gemini',
    frontendUrl: process.env.FRONTEND_URL || '',
    adminKey: process.env.ADMIN_KEY || '',
    isDev: process.env.NODE_ENV !== 'production',
    isProd: process.env.NODE_ENV === 'production',
};

/** Validate environment — warns for missing vars, throws only for invalid values */
export const validateEnv = (): void => {
    // Critical validation
    if (isNaN(config.port) || config.port < 1 || config.port > 65535) {
        throw new Error(`Invalid PORT: ${process.env.PORT}`);
    }

    // Warnings for missing optional vars
    if (!config.mongoUri) {
        logger.warn('MONGODB_URI not set — running in demo mode');
    }
    if (!config.geminiKey || config.geminiKey === 'your-api-key-here') {
        logger.warn('GEMINI_API_KEY not configured — AI analysis will use fallback');
    }
    if (config.isProd && !config.frontendUrl) {
        logger.warn('FRONTEND_URL not set in production — CORS will accept all origins');
    }
    if (config.isProd && !config.adminKey) {
        logger.warn('ADMIN_KEY not set — /metrics relies on IP whitelist only');
    }

    logger.info({ env: config.nodeEnv, port: config.port, db: config.mongoUri ? 'configured' : 'demo' }, 'Environment validated');
};

