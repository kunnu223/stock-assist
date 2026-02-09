'use client';

import { useState, useEffect } from 'react';
import { Star, X, TrendingUp, TrendingDown, Trash2, ArrowRight } from 'lucide-react';
import Link from 'next/link';

interface WatchlistItem {
    symbol: string;
    addedAt: string;
}

export function WatchlistPanel({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
    const [watchlist, setWatchlist] = useState<WatchlistItem[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchWatchlist = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/watchlist');
            const data = await res.json();
            if (data.success) setWatchlist(data.data);
        } catch (err) {
            console.error('Failed to fetch watchlist:', err);
        }
        setLoading(false);
    };

    useEffect(() => {
        if (isOpen) fetchWatchlist();
    }, [isOpen]);

    const removeFromWatchlist = async (symbol: string) => {
        try {
            const res = await fetch(`/api/watchlist/${symbol}`, { method: 'DELETE' });
            if (res.ok) {
                setWatchlist(prev => prev.filter(item => item.symbol !== symbol));
            }
        } catch (err) {
            console.error('Failed to remove from watchlist:', err);
        }
    };

    if (!isOpen) return null;

    return (
        <>
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[150]" onClick={onClose} />
            <div className="fixed top-0 right-0 bottom-0 w-full max-w-md bg-zinc-950 border-l border-border z-[160] shadow-2xl animate-in slide-in-from-right duration-500">
                <div className="h-full flex flex-col">
                    <div className="p-6 border-b border-border flex items-center justify-between bg-zinc-900/50">
                        <div className="flex items-center gap-3">
                            <Star className="text-amber-500" size={20} fill="currentColor" />
                            <h2 className="text-xl font-bold tracking-tight text-foreground uppercase italic">Tracked <span className="text-primary-500">Assets</span></h2>
                        </div>
                        <button onClick={onClose} className="p-2 text-zinc-500 hover:text-white transition-colors">
                            <X size={20} />
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-6 space-y-4 no-scrollbar">
                        {loading ? (
                            [1, 2, 3].map(i => (
                                <div key={i} className="h-24 bg-zinc-900 rounded-xl animate-pulse border border-border" />
                            ))
                        ) : watchlist.length > 0 ? (
                            watchlist.map((item) => (
                                <div key={item.symbol} className="premium-card p-4 rounded-xl flex items-center justify-between group">
                                    <div className="flex items-center gap-4">
                                        <div>
                                            <h4 className="text-lg font-bold text-foreground tracking-tight">{item.symbol}</h4>
                                            <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Added {new Date(item.addedAt).toLocaleDateString()}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Link
                                            href={`/analyze?symbol=${item.symbol}`}
                                            onClick={onClose}
                                            className="p-2 text-zinc-500 hover:text-primary-500 transition-colors"
                                        >
                                            <ArrowRight size={18} />
                                        </Link>
                                        <button
                                            onClick={() => removeFromWatchlist(item.symbol)}
                                            className="p-2 text-zinc-700 hover:text-rose-500 transition-colors"
                                        >
                                            <Trash2 size={18} />
                                        </button>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center text-center space-y-4 py-20">
                                <div className="w-16 h-16 bg-zinc-900 rounded-full flex items-center justify-center border border-border">
                                    <Star size={24} className="text-zinc-700" />
                                </div>
                                <div>
                                    <p className="text-sm font-bold text-foreground uppercase tracking-widest">Empty Watchlist</p>
                                    <p className="text-xs text-zinc-500 font-medium">Follow stocks to see them here for rapid access.</p>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="p-6 border-t border-border bg-zinc-900/30">
                        <Link
                            href="/analyze"
                            onClick={onClose}
                            className="w-full py-4 bg-primary-600 hover:bg-primary-500 text-white rounded-lg font-black uppercase tracking-widest text-xs flex items-center justify-center gap-2 shadow-lg shadow-primary-500/20"
                        >
                            Explore New Scanner
                        </Link>
                    </div>
                </div>
            </div>
        </>
    );
}
