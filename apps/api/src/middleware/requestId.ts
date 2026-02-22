/**
 * Request ID Middleware
 * @module @stock-assist/api/middleware/requestId
 */

import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';

/** Attach a unique request ID to every request for tracing */
export function requestIdMiddleware(req: Request, res: Response, next: NextFunction): void {
    const requestId = (req.headers['x-request-id'] as string) || uuidv4();
    (req as any).requestId = requestId;
    res.setHeader('x-request-id', requestId);
    next();
}
