/**
 * Rate Limiting Middleware
 * @module @stock-assist/api/middleware/rateLimiter
 */

import rateLimit from 'express-rate-limit';

/** General API rate limiter — 100 requests per minute per IP */
export const generalLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        success: false,
        error: 'Too many requests, please try again later.',
        code: 'RATE_LIMIT_EXCEEDED',
    },
});

/** Analysis endpoints — 10 requests per minute per IP (expensive AI calls) */
export const analysisLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        success: false,
        error: 'Too many analysis requests. Please wait before trying again.',
        code: 'RATE_LIMIT_EXCEEDED',
    },
});

/** Screening endpoints — 5 requests per minute per IP (batch processing) */
export const screeningLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        success: false,
        error: 'Screening is resource-intensive. Please wait before triggering again.',
        code: 'RATE_LIMIT_EXCEEDED',
    },
});
