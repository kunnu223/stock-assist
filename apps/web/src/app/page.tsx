'use client';

import { useState, useEffect } from 'react';
import { RefreshCw, TrendingUp, BarChart3, Zap, ShieldCheck } from 'lucide-react';

interface TopStock {
    symbol: string;
    name: string;
    price: number;
    changePercent: number;
    confidence: number;
    reason: string;
    technicalScore: number;
    updatedAt: string;
}

export default function Dashboard() {
    const [loading, setLoading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [topStocks, setTopStocks] = useState<TopStock[]>([]);
    const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        fetchTopStocks();
    }, []);

    const fetchTopStocks = async (refresh: boolean = false) => {
        if (refresh) setRefreshing(true);
        else setLoading(true);

        try {
            const url = refresh ? '/api/stocks/top-10/refresh' : '/api/stocks/top-10';
            const method = refresh ? 'POST' : 'GET';

            const res = await fetch(url, { method });
            const data = await res.json();

            if (data.success) {
                setTopStocks(data.stocks);
                setUpdatedAt(new Date(data.updatedAt));
                setError(null);
            } else {
                setError(data.message || 'Failed to fetch stocks');
            }
        } catch (err) {
            console.error('Failed to fetch top stocks:', err);
            setError('Unable to load stocks. Please try again.');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const getTimeAgo = () => {
        if (!updatedAt) return '';
        const minutes = Math.floor((Date.now() - new Date(updatedAt).getTime()) / 60000);
        if (minutes < 1) return 'Just now';
        if (minutes < 60) return `${minutes}m ago`;
        const hours = Math.floor(minutes / 60);
        return `${hours}h ago`;
    };

    return (
        <div className="space-y-12 max-w-7xl mx-auto px-4 pb-24 pt-10">
            {/* Hero Header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-border pb-10">
                <div className="space-y-4">
                    <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-primary-500/10 border border-primary-500/20 text-primary-500 text-[10px] font-black uppercase tracking-widest">
                        <BarChart3 size={12} />
                        <span>High-Conviction Setups</span>
                    </div>
                    <h1 className="text-5xl font-bold text-foreground tracking-tight italic uppercase">Top Tier <span className="text-primary-500">Analytics</span></h1>
                    <p className="text-muted-foreground max-w-xl font-medium">Real-time proprietary scoring of Nifty 50 assets using institutional-grade technical filters.</p>
                </div>
                <div className="flex flex-col items-end gap-3">
                    <button
                        onClick={() => fetchTopStocks(true)}
                        disabled={refreshing}
                        className="flex items-center gap-2 px-6 py-4 bg-foreground text-background hover:bg-zinc-200 rounded-lg transition-all font-black uppercase tracking-widest text-[10px] disabled:opacity-50"
                    >
                        <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
                        {refreshing ? 'Processing Architecture...' : 'Re-Sync Engine'}
                    </button>
                    {updatedAt && (
                        <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">
                            Dataset Latency: {getTimeAgo()}
                        </p>
                    )}
                </div>
            </div>

            {error && !loading && (
                <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-8 text-center animate-in fade-in zoom-in-95 duration-500">
                    <p className="text-rose-500 font-bold uppercase tracking-widest text-xs mb-4">{error}</p>
                    <button
                        onClick={() => fetchTopStocks()}
                        className="text-primary-500 font-black uppercase tracking-widest text-[10px] border border-primary-500/20 px-4 py-2 rounded hover:bg-primary-500/5 transition-all"
                    >
                        Re-Attempt Connection
                    </button>
                </div>
            )}

            {/* Main Grid */}
            <div className="space-y-8">
                <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground px-1">
                    <div className="flex items-center gap-4">
                        <span className="flex items-center gap-2"><Zap size={12} className="text-primary-500" /> Confidence Optimized</span>
                        <div className="h-3 w-px bg-border" />
                        <span>Population: {topStocks.length} Assets</span>
                    </div>
                    <span>Tier 1 Execution Only</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {loading ? (
                        [1, 2, 3, 4, 5, 6].map(i => (
                            <div key={i} className="premium-card h-64 rounded-xl animate-pulse bg-zinc-900/50 border-border" />
                        ))
                    ) : (
                        topStocks.map((stock, index) => (
                            <div key={stock.symbol} className="premium-card relative p-8 rounded-xl bg-zinc-950/50 flex flex-col h-full border-border hover:border-zinc-700 transition-all">
                                <div className="absolute top-0 right-0 p-4">
                                    <span className="text-[40px] font-black text-foreground/5 italic leading-none select-none">#{index + 1}</span>
                                </div>

                                <div className="flex justify-between items-start mb-6">
                                    <div>
                                        <div className="flex items-center gap-2 mb-1">
                                            <h3 className="text-xl font-bold text-foreground tracking-tight uppercase">{stock.symbol}</h3>
                                            <ShieldCheck size={14} className="text-primary-500" />
                                        </div>
                                        <p className="text-[10px] text-muted-foreground font-black uppercase tracking-widest line-clamp-1">{stock.name}</p>
                                    </div>
                                    <div className={`text-sm font-black px-2 py-0.5 rounded ${stock.changePercent >= 0 ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'}`}>
                                        {stock.changePercent >= 0 ? '+' : ''}{stock.changePercent.toFixed(2)}%
                                    </div>
                                </div>

                                <div className="text-3xl font-bold text-foreground mb-8">₹{stock.price.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>

                                <div className="space-y-4 mb-8">
                                    <div className="flex justify-between items-center px-1">
                                        <span className="text-[9px] text-muted-foreground font-black uppercase tracking-widest">Model Probability</span>
                                        <span className="text-[11px] font-black text-primary-500">{stock.confidence}%</span>
                                    </div>
                                    <div className="w-full bg-zinc-900 rounded-full h-1 overflow-hidden">
                                        <div
                                            className="bg-primary-500 h-full rounded-full transition-all duration-1000"
                                            style={{ width: `${stock.confidence}%` }}
                                        ></div>
                                    </div>
                                </div>

                                <div className="mt-auto pt-6 border-t border-border">
                                    <p className="text-[11px] text-muted-foreground font-medium leading-relaxed italic line-clamp-2">
                                        "{stock.reason}"
                                    </p>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {!loading && !error && topStocks.length === 0 && (
                <div className="py-48 text-center border border-dashed border-border rounded-xl bg-zinc-950/20">
                    <div className="max-w-xs mx-auto space-y-4">
                        <div className="w-16 h-16 bg-zinc-900 rounded-full flex items-center justify-center mx-auto border border-border">
                            <TrendingUp size={24} className="text-zinc-700" />
                        </div>
                        <h3 className="text-xl font-bold text-foreground tracking-tight italic">DATASET EMPTY</h3>
                        <p className="text-muted-foreground font-medium text-sm px-4">Initialization required to fetch high-conviction market setups.</p>
                        <button
                            onClick={() => fetchTopStocks(true)}
                            className="text-primary-500 text-[10px] font-black uppercase tracking-widest hover:text-primary-400 transition-colors"
                        >
                            Sync From Oracle
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
