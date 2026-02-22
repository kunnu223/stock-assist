/**
 * Zod Validation Schemas for all API endpoints
 * @module @stock-assist/api/middleware/schemas
 */

import { z } from 'zod';

// ═══════════════════════════════════════════════════════════════
// COMMON VALIDATORS
// ═══════════════════════════════════════════════════════════════

/** Safe stock symbol: 1-20 alphanumeric chars + dots/hyphens (e.g. M&M, BAJAJ-AUTO) */
const symbolSchema = z.string()
    .min(1, 'Symbol is required')
    .max(20, 'Symbol too long')
    .regex(/^[A-Za-z0-9&.\-]+$/, 'Invalid symbol format');

const languageSchema = z.enum(['en', 'hi']).optional().default('en');

const isoDateSchema = z.string().refine(
    (val) => !isNaN(Date.parse(val)),
    { message: 'Invalid date format (use ISO 8601)' }
);

// ═══════════════════════════════════════════════════════════════
// ANALYZE ROUTES
// ═══════════════════════════════════════════════════════════════

export const analyzeSingleBody = z.object({
    symbol: symbolSchema,
    language: languageSchema,
});

export const analyzeHistoryQuery = z.object({
    symbol: z.string().max(20).regex(/^[A-Za-z0-9&.\-]*$/, 'Invalid symbol').optional(),
    startDate: isoDateSchema.optional(),
    endDate: isoDateSchema.optional(),
    minConfidence: z.coerce.number().min(0).max(100).optional(),
    minBullish: z.coerce.number().min(0).max(100).optional(),
    minBearish: z.coerce.number().min(0).max(100).optional(),
});

// ═══════════════════════════════════════════════════════════════
// COMMODITY ROUTES
// ═══════════════════════════════════════════════════════════════

export const commodityAnalyzeBody = z.object({
    symbol: z.string().min(1, 'Symbol is required').max(20),
    exchange: z.enum(['COMEX', 'MCX', 'SPOT', 'comex', 'mcx', 'spot']).optional(),
    language: languageSchema,
});

// ═══════════════════════════════════════════════════════════════
// TRADE ROUTES
// ═══════════════════════════════════════════════════════════════

export const tradeCreateBody = z.object({
    symbol: symbolSchema,
    direction: z.enum(['LONG', 'SHORT']),
    entryPrice: z.number().positive('Entry price must be positive'),
    quantity: z.number().int().positive('Quantity must be a positive integer'),
    pattern: z.string().optional(),
    notes: z.string().max(1000).optional(),
    stopLoss: z.number().positive().optional(),
    target: z.number().positive().optional(),
});

export const tradeUpdateBody = z.object({
    exitPrice: z.number().positive().optional(),
    status: z.enum(['OPEN', 'CLOSED']).optional(),
    notes: z.string().max(1000).optional(),
}).refine(data => Object.keys(data).length > 0, {
    message: 'At least one field must be provided',
});

// ═══════════════════════════════════════════════════════════════
// WATCHLIST ROUTES
// ═══════════════════════════════════════════════════════════════

export const watchlistAddBody = z.object({
    symbol: symbolSchema,
    notes: z.string().max(500).optional(),
});

// ═══════════════════════════════════════════════════════════════
// JOURNAL ROUTES
// ═══════════════════════════════════════════════════════════════

export const journalCreateBody = z.object({
    content: z.string().min(1, 'Content is required').max(5000),
    sentiment: z.string().max(50).optional(),
    isPinned: z.boolean().optional(),
    type: z.string().max(50).optional(),
    tradeDetails: z.any().optional(),
});

export const journalUpdateBody = z.object({
    content: z.string().min(1).max(5000).optional(),
    sentiment: z.string().max(50).optional(),
    isPinned: z.boolean().optional(),
}).refine(data => Object.keys(data).length > 0, {
    message: 'At least one field must be provided',
});

// ═══════════════════════════════════════════════════════════════
// BACKTEST ROUTES
// ═══════════════════════════════════════════════════════════════

export const backtestPredictionBody = z.object({
    analysis: z.object({}).passthrough(),
});

// ═══════════════════════════════════════════════════════════════
// PARAM VALIDATORS
// ═══════════════════════════════════════════════════════════════

export const idParam = z.object({
    id: z.string().min(1, 'ID is required'),
});

export const symbolParam = z.object({
    symbol: z.string().min(1).max(20),
});
