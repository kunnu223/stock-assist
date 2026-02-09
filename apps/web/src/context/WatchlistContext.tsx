'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

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

    const fetchWatchlist = useCallback(async () => {
        try {
            const res = await fetch('/api/watchlist');
            const data = await res.json();
            if (data.success) {
                setWatchlist(data.data.map((item: any) => item.symbol));
            }
        } catch (err) {
            console.error('Failed to fetch watchlist:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchWatchlist();
    }, [fetchWatchlist]);

    const isFollowing = (symbol: string) => watchlist.includes(symbol.toUpperCase());

    const toggleFollow = async (symbol: string) => {
        const s = symbol.toUpperCase();
        const following = isFollowing(s);
        const method = following ? 'DELETE' : 'POST';
        const url = following ? `/api/watchlist/${s}` : '/api/watchlist';

        try {
            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: method === 'POST' ? JSON.stringify({ symbol: s }) : undefined
            });

            if (res.ok) {
                setWatchlist(prev =>
                    following ? prev.filter(item => item !== s) : [...prev, s]
                );
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
