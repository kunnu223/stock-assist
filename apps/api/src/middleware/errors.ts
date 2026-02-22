/**
 * Custom Error Classes & Global Error Handler
 * @module @stock-assist/api/middleware/errors
 */

import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { logger } from '../config/logger';

// ═══════════════════════════════════════════════════════════════
// CUSTOM ERROR CLASSES
// ═══════════════════════════════════════════════════════════════

export class AppError extends Error {
    public readonly statusCode: number;
    public readonly code: string;
    public readonly isOperational: boolean;

    constructor(message: string, statusCode: number, code: string, isOperational = true) {
        super(message);
        this.statusCode = statusCode;
        this.code = code;
        this.isOperational = isOperational;
        Object.setPrototypeOf(this, AppError.prototype);
    }
}

export class ValidationError extends AppError {
    public readonly details: any[];

    constructor(message: string, details: any[] = []) {
        super(message, 400, 'VALIDATION_ERROR');
        this.details = details;
        Object.setPrototypeOf(this, ValidationError.prototype);
    }
}

export class NotFoundError extends AppError {
    constructor(resource: string) {
        super(`${resource} not found`, 404, 'NOT_FOUND');
        Object.setPrototypeOf(this, NotFoundError.prototype);
    }
}

export class UpstreamError extends AppError {
    public readonly upstream: string;

    constructor(upstream: string, message: string) {
        super(`Upstream error from ${upstream}: ${message}`, 502, 'UPSTREAM_ERROR');
        this.upstream = upstream;
        Object.setPrototypeOf(this, UpstreamError.prototype);
    }
}

export class RateLimitError extends AppError {
    constructor(message = 'Too many requests') {
        super(message, 429, 'RATE_LIMIT_EXCEEDED');
        Object.setPrototypeOf(this, RateLimitError.prototype);
    }
}

// ═══════════════════════════════════════════════════════════════
// GLOBAL ERROR HANDLER MIDDLEWARE
// ═══════════════════════════════════════════════════════════════

export function errorHandler(err: Error, req: Request, res: Response, _next: NextFunction): void {
    const requestId = (req as any).requestId || 'unknown';

    // Zod validation errors
    if (err instanceof ZodError) {
        const details = err.issues.map((e: any) => ({
            field: e.path.join('.'),
            message: e.message,
            code: e.code,
        }));

        logger.warn({ requestId, errors: details }, `Validation failed: ${err.issues.length} error(s)`);

        res.status(400).json({
            success: false,
            error: 'Validation failed',
            code: 'VALIDATION_ERROR',
            details,
            requestId,
        });
        return;
    }

    // Custom AppError subclasses
    if (err instanceof AppError) {
        const logLevel = err.statusCode >= 500 ? 'error' : 'warn';
        logger[logLevel]({ requestId, code: err.code, statusCode: err.statusCode }, err.message);

        const response: any = {
            success: false,
            error: err.message,
            code: err.code,
            requestId,
        };

        if (err instanceof ValidationError && err.details.length > 0) {
            response.details = err.details;
        }

        res.status(err.statusCode).json(response);
        return;
    }

    // Unknown / unhandled errors
    logger.error({ requestId, err }, 'Unhandled error');

    res.status(500).json({
        success: false,
        error: process.env.NODE_ENV === 'production'
            ? 'Internal server error'
            : err.message || 'Internal server error',
        code: 'INTERNAL_ERROR',
        requestId,
    });
}
