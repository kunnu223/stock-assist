/**
 * Structured Logger (Pino)
 * @module @stock-assist/api/config/logger
 */

import pino from 'pino';

const isDev = process.env.NODE_ENV !== 'production';

export const logger = pino({
    level: process.env.LOG_LEVEL || (isDev ? 'debug' : 'info'),
    ...(isDev
        ? {
            transport: {
                target: 'pino-pretty',
                options: {
                    colorize: true,
                    translateTime: 'HH:MM:ss',
                    ignore: 'pid,hostname',
                },
            },
        }
        : {}),
    formatters: {
        level(label) {
            return { level: label };
        },
    },
    serializers: {
        err: pino.stdSerializers.err,
        req: (req) => ({
            method: req.method,
            url: req.url,
            requestId: req.requestId,
        }),
    },
});

/** Create a child logger pre-bound with context fields */
export function createChildLogger(context: Record<string, any>) {
    return logger.child(context);
}
