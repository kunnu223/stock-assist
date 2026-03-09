import { describe, it, expect, beforeEach } from 'vitest';
import { cache } from '../cache';

describe('CacheService', () => {
    beforeEach(() => {
        cache.flush();
    });

    describe('get/set', () => {
        it('returns undefined for missing key', () => {
            expect(cache.get('nonexistent')).toBeUndefined();
        });

        it('stores and retrieves a value', () => {
            cache.set('test-key', { value: 42 });
            expect(cache.get('test-key')).toEqual({ value: 42 });
        });

        it('stores strings, numbers, arrays', () => {
            cache.set('str', 'hello');
            cache.set('num', 123);
            cache.set('arr', [1, 2, 3]);

            expect(cache.get('str')).toBe('hello');
            expect(cache.get('num')).toBe(123);
            expect(cache.get('arr')).toEqual([1, 2, 3]);
        });
    });

    describe('del / delByPrefix', () => {
        it('deletes a single key', () => {
            cache.set('key1', 'value1');
            cache.set('key2', 'value2');
            cache.del('key1');

            expect(cache.get('key1')).toBeUndefined();
            expect(cache.get('key2')).toBe('value2');
        });

        it('deletes keys by prefix', () => {
            cache.set('analysis:AAPL', 'a');
            cache.set('analysis:GOOG', 'b');
            cache.set('news:AAPL', 'c');

            const deleted = cache.delByPrefix('analysis:');
            expect(deleted).toBe(2);
            expect(cache.get('analysis:AAPL')).toBeUndefined();
            expect(cache.get('news:AAPL')).toBe('c');
        });
    });

    describe('getOrFetch', () => {
        it('returns cached value without calling fetchFn', async () => {
            cache.set('cached-key', 'cached-value');
            let fetchCalled = false;

            const result = await cache.getOrFetch('cached-key', async () => {
                fetchCalled = true;
                return 'fresh-value';
            });

            expect(result).toBe('cached-value');
            expect(fetchCalled).toBe(false);
        });

        it('calls fetchFn and caches result on miss', async () => {
            let fetchCount = 0;

            const result1 = await cache.getOrFetch('new-key', async () => {
                fetchCount++;
                return 'fetched-value';
            });

            const result2 = await cache.getOrFetch('new-key', async () => {
                fetchCount++;
                return 'should-not-return';
            });

            expect(result1).toBe('fetched-value');
            expect(result2).toBe('fetched-value');
            expect(fetchCount).toBe(1); // Only called once
        });
    });

    describe('getStats', () => {
        it('tracks hits and misses', () => {
            cache.set('hit', 'value');

            // Miss
            cache.get('miss');
            // Hit
            cache.get('hit');
            cache.get('hit');

            const stats = cache.getStats();
            expect(stats.hits).toBe(2);
            expect(stats.misses).toBe(1);
            expect(stats.hitRate).toBe(67); // 2/3 ≈ 67%
            expect(stats.keys).toBe(1);
        });
    });

    describe('flush', () => {
        it('clears all data and resets counters', () => {
            cache.set('a', 1);
            cache.set('b', 2);
            cache.get('a');

            cache.flush();

            const stats = cache.getStats();
            expect(stats.keys).toBe(0);
            expect(stats.hits).toBe(0);
            expect(stats.misses).toBe(0);
        });
    });
});
