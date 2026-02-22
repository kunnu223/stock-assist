/**
 * Zod Validation Middleware Factory
 * @module @stock-assist/api/middleware/validate
 */

import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';

interface ValidationSchemas {
    body?: ZodSchema;
    query?: ZodSchema;
    params?: ZodSchema;
}

/**
 * Validate request body/query/params against Zod schemas.
 * Usage: router.post('/route', validate({ body: mySchema }), handler)
 */
export function validate(schemas: ValidationSchemas) {
    return (req: Request, _res: Response, next: NextFunction): void => {
        try {
            if (schemas.body) {
                req.body = schemas.body.parse(req.body);
            }
            if (schemas.query) {
                (req as any).query = schemas.query.parse(req.query);
            }
            if (schemas.params) {
                req.params = schemas.params.parse(req.params) as any;
            }
            next();
        } catch (error) {
            if (error instanceof ZodError) {
                next(error); // Will be caught by global errorHandler
            } else {
                next(error);
            }
        }
    };
}
