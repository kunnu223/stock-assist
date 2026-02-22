import { describe, it, expect } from 'vitest';
import { analyzeSingleBody, commodityAnalyzeBody, tradeCreateBody, watchlistAddBody, journalCreateBody, analyzeHistoryQuery } from '../schemas';

describe('analyzeSingleBody', () => {
    it('accepts valid input', () => {
        expect(() => analyzeSingleBody.parse({ symbol: 'RELIANCE' })).not.toThrow();
        expect(() => analyzeSingleBody.parse({ symbol: 'BAJAJ-AUTO', language: 'hi' })).not.toThrow();
        expect(() => analyzeSingleBody.parse({ symbol: 'M&M' })).not.toThrow();
    });

    it('rejects missing symbol', () => {
        expect(() => analyzeSingleBody.parse({})).toThrow();
        expect(() => analyzeSingleBody.parse({ language: 'en' })).toThrow();
    });

    it('rejects invalid symbol format', () => {
        expect(() => analyzeSingleBody.parse({ symbol: 'DROP TABLE;' })).toThrow();
        expect(() => analyzeSingleBody.parse({ symbol: '<script>' })).toThrow();
    });

    it('rejects invalid language', () => {
        expect(() => analyzeSingleBody.parse({ symbol: 'RELIANCE', language: 'fr' })).toThrow();
    });

    it('defaults language to en', () => {
        const result = analyzeSingleBody.parse({ symbol: 'RELIANCE' });
        expect(result.language).toBe('en');
    });
});

describe('commodityAnalyzeBody', () => {
    it('accepts valid input', () => {
        expect(() => commodityAnalyzeBody.parse({ symbol: 'GOLD' })).not.toThrow();
        expect(() => commodityAnalyzeBody.parse({ symbol: 'SILVER', exchange: 'MCX' })).not.toThrow();
    });

    it('rejects missing symbol', () => {
        expect(() => commodityAnalyzeBody.parse({})).toThrow();
    });
});

describe('tradeCreateBody', () => {
    it('accepts valid trade', () => {
        expect(() => tradeCreateBody.parse({
            symbol: 'RELIANCE',
            direction: 'LONG',
            entryPrice: 1420,
            quantity: 10,
        })).not.toThrow();
    });

    it('rejects negative entry price', () => {
        expect(() => tradeCreateBody.parse({
            symbol: 'RELIANCE',
            direction: 'LONG',
            entryPrice: -100,
            quantity: 10,
        })).toThrow();
    });

    it('rejects invalid direction', () => {
        expect(() => tradeCreateBody.parse({
            symbol: 'RELIANCE',
            direction: 'UP',
            entryPrice: 100,
            quantity: 10,
        })).toThrow();
    });
});

describe('watchlistAddBody', () => {
    it('accepts valid input', () => {
        expect(() => watchlistAddBody.parse({ symbol: 'TCS' })).not.toThrow();
        expect(() => watchlistAddBody.parse({ symbol: 'TCS', notes: 'Watch for breakout' })).not.toThrow();
    });

    it('rejects missing symbol', () => {
        expect(() => watchlistAddBody.parse({ notes: 'test' })).toThrow();
    });
});

describe('journalCreateBody', () => {
    it('accepts valid input', () => {
        expect(() => journalCreateBody.parse({ content: 'Market looks strong today' })).not.toThrow();
    });

    it('rejects empty content', () => {
        expect(() => journalCreateBody.parse({ content: '' })).toThrow();
    });

    it('rejects missing content', () => {
        expect(() => journalCreateBody.parse({})).toThrow();
    });
});

describe('analyzeHistoryQuery', () => {
    it('accepts empty query (all optional)', () => {
        expect(() => analyzeHistoryQuery.parse({})).not.toThrow();
    });

    it('accepts valid filters', () => {
        expect(() => analyzeHistoryQuery.parse({
            symbol: 'RELIANCE',
            minConfidence: '70',
        })).not.toThrow();
    });

    it('rejects invalid date format', () => {
        expect(() => analyzeHistoryQuery.parse({ startDate: 'not-a-date' })).toThrow();
    });
});
