/**
 * Unified Cache Service
 * @module @stock-assist/api/services/cache
 *
 * Replaces ad-hoc Map caches scattered across services with a single,
 * configurable caching layer. Uses node-cache (in-memory with TTL).
 * Drop-in upgradeable to Redis via ioredis later.
 */

import NodeCache from 'node-cache';
import { logger } from '../config/logger';

// Default TTLs (seconds)
const TTL = {
    ANALYSIS: 10 * 60,       // 10 minutes — single stock analysis results
    NEWS: 15 * 60,           // 15 minutes — news data
    FUNDAMENTALS: 24 * 3600, // 24 hours — fundamental metrics
    HISTORY: 6 * 3600,       // 6 hours — price history
    SCREENING: 30 * 60,      // 30 minutes — screening results
} as const;

class CacheService {
    private cache: NodeCache;
    private hits = 0;
    private misses = 0;

    constructor() {
        this.cache = new NodeCache({
            stdTTL: 600,          // Default 10 min
            checkperiod: 120,     // Cleanup every 2 min
            useClones: false,     // Performance: return references, not deep clones
            maxKeys: 500,         // Prevent unbounded memory growth
        });

        this.cache.on('expired', (key) => {
            logger.debug({ key }, 'Cache key expired');
        });
    }

    /** Get a value from cache */
    get<T>(key: string): T | undefined {
        const value = this.cache.get<T>(key);
        if (value !== undefined) {
            this.hits++;
            return value;
        }
        this.misses++;
        return undefined;
    }

    /** Set a value in cache with optional TTL override */
    set<T>(key: string, value: T, ttlSeconds?: number): void {
        if (ttlSeconds !== undefined) {
            this.cache.set(key, value, ttlSeconds);
        } else {
            this.cache.set(key, value);
        }
    }

    /** Delete a key or pattern */
    del(key: string): void {
        this.cache.del(key);
    }

    /** Delete all keys matching a prefix */
    delByPrefix(prefix: string): number {
        const keys = this.cache.keys().filter(k => k.startsWith(prefix));
        return this.cache.del(keys);
    }

    /**
     * Fetch-through pattern: return cached value or execute fetchFn and cache result.
     * This is the primary method services should use.
     */
    async getOrFetch<T>(key: string, fetchFn: () => Promise<T>, ttlSeconds?: number): Promise<T> {
        const cached = this.get<T>(key);
        if (cached !== undefined) {
            logger.debug({ key }, 'Cache hit');
            return cached;
        }

        logger.debug({ key }, 'Cache miss — fetching');
        const value = await fetchFn();
        this.set(key, value, ttlSeconds);
        return value;
    }

    /** Get cache statistics for monitoring */
    getStats() {
        const nodeStats = this.cache.getStats();
        return {
            keys: this.cache.keys().length,
            hits: this.hits,
            misses: this.misses,
            hitRate: this.hits + this.misses > 0
                ? Math.round((this.hits / (this.hits + this.misses)) * 100)
                : 0,
            ksize: nodeStats.ksize,
            vsize: nodeStats.vsize,
        };
    }

    /** Flush all cached data */
    flush(): void {
        this.cache.flushAll();
        this.hits = 0;
        this.misses = 0;
        logger.info('Cache flushed');
    }
}

// Singleton instance
export const cache = new CacheService();
export { TTL };
