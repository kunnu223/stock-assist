/**
 * Response Time Middleware
 * @module @stock-assist/api/middleware/responseTime
 *
 * Tracks request duration, logs slow requests, and exposes
 * per-route metrics for the /metrics endpoint.
 */

import { Request, Response, NextFunction } from 'express';
import { logger } from '../config/logger';

// In-memory metrics store
interface RouteMetric {
    count: number;
    totalMs: number;
    maxMs: number;
    errors: number;
}

const routeMetrics = new Map<string, RouteMetric>();
const SLOW_THRESHOLD_MS = 5000;

/**
 * Middleware that measures response time, sets X-Response-Time header,
 * and logs slow requests.
 */
export const responseTimeMiddleware = (req: Request, res: Response, next: NextFunction): void => {
    const start = process.hrtime.bigint();

    // Hook into response finish event
    res.on('finish', () => {
        const durationNs = Number(process.hrtime.bigint() - start);
        const durationMs = Math.round(durationNs / 1e6);

        // Set header (if not already sent)
        if (!res.headersSent) {
            res.setHeader('X-Response-Time', `${durationMs}ms`);
        }

        // Build route key (method + path pattern)
        const routeKey = `${req.method} ${req.route?.path || req.path}`;

        // Update metrics
        const metric = routeMetrics.get(routeKey) || { count: 0, totalMs: 0, maxMs: 0, errors: 0 };
        metric.count++;
        metric.totalMs += durationMs;
        if (durationMs > metric.maxMs) metric.maxMs = durationMs;
        if (res.statusCode >= 400) metric.errors++;
        routeMetrics.set(routeKey, metric);

        // Log slow requests
        if (durationMs > SLOW_THRESHOLD_MS) {
            logger.warn({
                method: req.method,
                url: req.originalUrl,
                status: res.statusCode,
                durationMs,
            }, `Slow request: ${durationMs}ms`);
        }
    });

    next();
};

/**
 * Get collected route metrics for the /metrics endpoint.
 */
export const getRouteMetrics = () => {
    const result: Record<string, { count: number; avgMs: number; maxMs: number; errors: number }> = {};

    routeMetrics.forEach((metric, route) => {
        result[route] = {
            count: metric.count,
            avgMs: metric.count > 0 ? Math.round(metric.totalMs / metric.count) : 0,
            maxMs: metric.maxMs,
            errors: metric.errors,
        };
    });

    return result;
};
