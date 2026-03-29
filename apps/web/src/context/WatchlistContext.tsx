'use client';

/**
 * Watchlist Context — Global state for user's watched symbols.
 * Uses the centralized API service for all backend calls.
 * @module @stock-assist/web/context/WatchlistContext
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { fetchWatchlist, addToWatchlist, removeFromWatchlist } from '@/services/api';

interface WatchlistContextType {
    watchlist: string[];
    isFollowing: (symbol: string) => boolean;
    toggleFollow: (symbol: string) => Promise<void>;
    loading: boolean;
}

const WatchlistContext = createContext<WatchlistContextType | undefined>(undefined);

export function WatchlistProvider({ children }: { children: React.ReactNode }) {
    const [watchlist, setWatchlist] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);

    const loadWatchlist = useCallback(async () => {
        try {
            const data = await fetchWatchlist();
            if (data.success) {
                setWatchlist(data.data.map((item) => item.symbol));
            }
        } catch (err) {
            console.error('Failed to fetch watchlist:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadWatchlist();
    }, [loadWatchlist]);

    const isFollowing = (symbol: string) => watchlist.includes(symbol.toUpperCase());

    const toggleFollow = async (symbol: string) => {
        const s = symbol.toUpperCase();
        const following = isFollowing(s);

        try {
            if (following) {
                await removeFromWatchlist(s);
                setWatchlist((prev) => prev.filter((item) => item !== s));
            } else {
                await addToWatchlist(s);
                setWatchlist((prev) => [...prev, s]);
            }
        } catch (err) {
            console.error('Watchlist update failed:', err);
        }
    };

    return (
        <WatchlistContext.Provider value={{ watchlist, isFollowing, toggleFollow, loading }}>
            {children}
        </WatchlistContext.Provider>
    );
}

export function useWatchlist() {
    const context = useContext(WatchlistContext);
    if (context === undefined) {
        throw new Error('useWatchlist must be used within a WatchlistProvider');
    }
    return context;
}
