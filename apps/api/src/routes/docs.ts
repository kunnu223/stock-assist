/**
 * API Documentation Route — Swagger UI
 * Serves OpenAPI spec and interactive Swagger UI at /api/docs
 * @module @stock-assist/api/routes/docs
 */

import { Router } from 'express';
import swaggerUi from 'swagger-ui-express';

const docsRouter = Router();

// ═══════════════════════════════════════════════════════════════
// OpenAPI Specification
// ═══════════════════════════════════════════════════════════════

const openApiSpec = {
    openapi: '3.0.3',
    info: {
        title: 'Stock Assist API',
        version: '2.0.0',
        description: 'AI-powered stock and commodity analysis for Indian markets. Provides multi-timeframe technical analysis, AI ensemble analysis, confidence scoring, and market screening.',
        contact: { name: 'Stock Assist Team' },
    },
    servers: [
        { url: '/api', description: 'Current server' },
    ],
    tags: [
        { name: 'Analysis', description: 'Stock analysis endpoints' },
        { name: 'Commodity', description: 'Commodity analysis endpoints' },
        { name: 'Stocks', description: 'Stock screening and top picks' },
        { name: 'System', description: 'Health, stats, and monitoring' },
    ],
    paths: {
        '/analyze/single': {
            post: {
                tags: ['Analysis'],
                summary: 'Analyze a single stock',
                description: 'Run the full analysis pipeline: data fetch, technical analysis, AI ensemble, confidence scoring, regime classification, and trade selectivity.',
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                required: ['symbol'],
                                properties: {
                                    symbol: { type: 'string', example: 'RELIANCE', description: 'NSE stock symbol' },
                                    language: { type: 'string', enum: ['en', 'hi'], default: 'en', description: 'Response language' },
                                },
                            },
                        },
                    },
                },
                responses: {
                    '200': {
                        description: 'Analysis result',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        success: { type: 'boolean' },
                                        processingTime: { type: 'string', example: '4.2s' },
                                        analysis: {
                                            type: 'object',
                                            properties: {
                                                stock: { type: 'string' },
                                                currentPrice: { type: 'string' },
                                                recommendation: { type: 'string', enum: ['BUY', 'SELL', 'HOLD', 'WAIT'] },
                                                confidenceScore: { type: 'number', minimum: 0, maximum: 100 },
                                                bias: { type: 'string', enum: ['BULLISH', 'BEARISH', 'NEUTRAL'] },
                                                confidence: { type: 'string', enum: ['HIGH', 'MEDIUM', 'LOW'] },
                                                category: { type: 'string', enum: ['STRONG_SETUP', 'NEUTRAL', 'AVOID'] },
                                            },
                                        },
                                    },
                                },
                            },
                        },
                    },
                    '400': { description: 'Validation error' },
                    '429': { description: 'Rate limit exceeded' },
                },
            },
        },
        '/analyze/stocks': {
            get: {
                tags: ['Analysis'],
                summary: 'Morning screening',
                description: 'Run batch analysis on the default watchlist. Processes stocks sequentially with circuit breaker for AI failures.',
                responses: {
                    '200': {
                        description: 'Screening results',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        success: { type: 'boolean' },
                                        date: { type: 'string', format: 'date' },
                                        processingTime: { type: 'string' },
                                        totalStocks: { type: 'integer' },
                                        circuitBreakerTriggered: { type: 'boolean' },
                                        strongSetups: { type: 'array', items: { type: 'object' } },
                                        neutral: { type: 'array', items: { type: 'object' } },
                                        avoid: { type: 'array', items: { type: 'object' } },
                                    },
                                },
                            },
                        },
                    },
                    '429': { description: 'Rate limit exceeded' },
                },
            },
        },
        '/analyze/history': {
            get: {
                tags: ['Analysis'],
                summary: 'Query analysis history',
                description: 'Fetch stored daily analysis records with optional filters.',
                parameters: [
                    { name: 'symbol', in: 'query', schema: { type: 'string' }, description: 'Filter by stock symbol (case-insensitive)' },
                    { name: 'startDate', in: 'query', schema: { type: 'string', format: 'date' }, description: 'Start date filter' },
                    { name: 'endDate', in: 'query', schema: { type: 'string', format: 'date' }, description: 'End date filter' },
                    { name: 'minConfidence', in: 'query', schema: { type: 'number' }, description: 'Minimum confidence score' },
                ],
                responses: {
                    '200': {
                        description: 'History records',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        success: { type: 'boolean' },
                                        count: { type: 'integer' },
                                        data: { type: 'array', items: { type: 'object' } },
                                    },
                                },
                            },
                        },
                    },
                },
            },
        },
        '/analyze/signal-stats': {
            get: {
                tags: ['System'],
                summary: 'Signal tracking statistics',
                description: 'Returns win-rate matrix, regime learning status, confidence calibration, data-derived modifiers, and market breadth.',
                responses: {
                    '200': {
                        description: 'Statistics data',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        success: { type: 'boolean' },
                                        ready: { type: 'boolean' },
                                        resolved: { type: 'integer' },
                                        regimeLearning: { type: 'object' },
                                        confidenceCalibration: { type: 'object' },
                                        derivedModifiers: { type: 'object' },
                                        marketBreadth: { type: 'object' },
                                    },
                                },
                            },
                        },
                    },
                },
            },
        },
        '/stocks/top-10': {
            get: {
                tags: ['Stocks'],
                summary: 'Get top 10 stock picks',
                description: 'Returns cached top 10 high-clarity stock picks from the latest screening run.',
                responses: {
                    '200': {
                        description: 'Top stocks data',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        success: { type: 'boolean' },
                                        stocks: { type: 'array', items: { type: 'object' } },
                                        totalScanned: { type: 'integer' },
                                        updatedAt: { type: 'string', format: 'date-time' },
                                    },
                                },
                            },
                        },
                    },
                },
            },
        },
        '/stocks/top-10/refresh': {
            post: {
                tags: ['Stocks'],
                summary: 'Refresh top 10 stock picks',
                description: 'Run a fresh screening of all stocks and update the top 10 picks.',
                responses: {
                    '200': { description: 'Fresh screening results' },
                    '429': { description: 'Rate limit exceeded' },
                },
            },
        },
        '/commodity/analyze': {
            post: {
                tags: ['Commodity'],
                summary: 'Analyze a commodity',
                description: 'Run full analysis on Gold, Silver, Crude Oil, Natural Gas, or Copper with multi-exchange price conversion (MCX, COMEX, Spot).',
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                required: ['commodity'],
                                properties: {
                                    commodity: { type: 'string', enum: ['GOLD', 'SILVER', 'CRUDEOIL', 'NATURALGAS', 'COPPER'], example: 'GOLD' },
                                    exchange: { type: 'string', enum: ['MCX', 'COMEX', 'SPOT'], default: 'MCX' },
                                    language: { type: 'string', enum: ['en', 'hi'], default: 'en' },
                                },
                            },
                        },
                    },
                },
                responses: {
                    '200': { description: 'Commodity analysis result' },
                    '400': { description: 'Validation error' },
                    '429': { description: 'Rate limit exceeded' },
                },
            },
        },
        '/health': {
            get: {
                tags: ['System'],
                summary: 'Health check',
                description: 'Returns API health status and uptime.',
                responses: {
                    '200': {
                        description: 'Health status',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        status: { type: 'string', example: 'ok' },
                                        uptime: { type: 'number' },
                                        timestamp: { type: 'string', format: 'date-time' },
                                    },
                                },
                            },
                        },
                    },
                },
            },
        },
    },
};

// Serve Swagger UI
docsRouter.use('/', swaggerUi.serve);
docsRouter.get('/', swaggerUi.setup(openApiSpec, {
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: 'Stock Assist API Docs',
}));

// Serve raw OpenAPI spec as JSON
docsRouter.get('/spec.json', (_req, res) => {
    res.json(openApiSpec);
});

export { docsRouter };
