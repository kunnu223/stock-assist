/**
 * Metrics Route
 * @module @stock-assist/api/routes/metrics
 *
 * Exposes operational metrics. Protected — only accessible
 * from localhost or with X-Admin-Key header.
 */

import { Router, Request, Response } from 'express';
import { getRouteMetrics } from '../middleware/responseTime';
import { cache } from '../services/cache';

export const metricsRouter = Router();

/** GET /metrics - Operational metrics */
metricsRouter.get('/', (req: Request, res: Response) => {
    // Simple protection: localhost or admin key
    const isLocal = req.ip === '127.0.0.1' || req.ip === '::1' || req.ip === '::ffff:127.0.0.1';
    const hasKey = req.headers['x-admin-key'] === process.env.ADMIN_KEY;

    if (!isLocal && !hasKey && process.env.NODE_ENV === 'production') {
        return res.status(403).json({ error: 'Forbidden' });
    }

    const memUsage = process.memoryUsage();

    res.json({
        timestamp: new Date().toISOString(),
        uptime: Math.round(process.uptime()),
        memory: {
            rss: Math.round(memUsage.rss / 1024 / 1024),
            heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
            heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
            external: Math.round(memUsage.external / 1024 / 1024),
        },
        cache: cache.getStats(),
        routes: getRouteMetrics(),
        node: {
            version: process.version,
            env: process.env.NODE_ENV || 'development',
        },
    });
});
