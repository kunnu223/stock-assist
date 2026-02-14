'use client';

import { useState, useEffect } from 'react';
import { RefreshCw, TrendingUp, TrendingDown, BarChart3, Zap, ShieldCheck, ArrowUpRight, ArrowDownRight, Activity } from 'lucide-react';

interface IndicatorSignal {
    name: string;
    direction: 'bullish' | 'bearish' | 'neutral';
    strength: number;
    detail: string;
}

interface TopStock {
    symbol: string;
    name: string;
    price: number;
    changePercent: number;
    confidence: number;
    reason: string;
    technicalScore: number;
    direction: 'bullish' | 'bearish';
    signalClarity: number;
    signals: IndicatorSignal[];
    updatedAt: string;
}

export default function Dashboard() {
    const [loading, setLoading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [topStocks, setTopStocks] = useState<TopStock[]>([]);
    const [totalScanned, setTotalScanned] = useState(0);
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
                setTotalScanned(data.totalScanned || 0);
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
        <div className="space-y-6 md:space-y-12 max-w-7xl mx-auto pb-24 pt-1 md:pt-10">
            {/* Hero Header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-border pb-6 md:pb-10">
                <div className="space-y-3 md:space-y-4">
                    <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-primary-500/10 border border-primary-500/20 text-primary-500 text-[10px] font-black uppercase tracking-widest">
                        <BarChart3 size={12} />
                        <span>Signal Clarity Screener</span>
                    </div>
                    <h1 className="text-3xl md:text-5xl font-bold text-foreground tracking-tight italic uppercase">
                        <span className="md:hidden">Stock <span className="text-primary-500">Picks</span></span>
                        <span className="hidden md:inline">Top Tier <span className="text-primary-500">Analytics</span></span>
                    </h1>
                    <p className="text-muted-foreground max-w-xl font-medium text-sm md:text-base">
                        <span className="md:hidden">Screening 100 NSE stocks for high-clarity setups.</span>
                        <span className="hidden md:inline">Code-level screening of {totalScanned || 100} NSE stocks using multi-indicator signal clarity.</span>
                        {totalScanned > 0 && topStocks.length > 0 && (
                            <span className="block mt-1 md:inline md:mt-0 text-primary-500 font-bold"> Filtered {totalScanned} → {topStocks.length} <span className="hidden md:inline">high-clarity setups</span><span className="md:hidden">picks</span>.</span>
                        )}
                    </p>
                </div>
                <div className="flex flex-col items-end gap-3">
                    <button
                        onClick={() => fetchTopStocks(true)}
                        disabled={refreshing}
                        className="flex items-center gap-2 px-4 py-2 md:px-6 md:py-3 bg-zinc-900/50 hover:bg-zinc-800 border border-zinc-800 text-zinc-400 hover:text-white rounded-lg transition-all font-bold uppercase tracking-wider text-[10px] disabled:opacity-50 backdrop-blur-sm"
                    >
                        <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
                        <span className="md:hidden">{refreshing ? 'Scanning...' : 'Refresh'}</span>
                        <span className="hidden md:inline">{refreshing ? 'Screening 100 Stocks...' : 'Re-Screen All Stocks'}</span>
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
                        <span className="flex items-center gap-2"><Zap size={12} className="text-primary-500" /> Signal Clarity Optimized</span>
                        <div className="h-3 w-px bg-border" />
                        <span>Selected: {topStocks.length} / {totalScanned || '—'} Stocks</span>
                    </div>
                    <span className="flex items-center gap-2"><Activity size={12} /> 6-Indicator Confluence</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {loading ? (
                        [1, 2, 3, 4, 5, 6].map(i => (
                            <div key={i} className="premium-card h-80 rounded-xl animate-pulse bg-zinc-900/50 border-border" />
                        ))
                    ) : (
                        topStocks.map((stock, index) => (
                            <div
                                key={stock.symbol}
                                onClick={() => window.location.href = `/analyze?symbol=${stock.symbol}&auto=true`}
                                className="premium-card relative p-8 rounded-xl bg-zinc-950/50 flex flex-col h-full border-border hover:border-zinc-700 transition-all group cursor-pointer hover:shadow-lg hover:shadow-primary-500/5"
                            >
                                <div className="absolute top-0 right-0 p-4">
                                    <span className="text-[40px] font-black text-foreground/5 italic leading-none select-none">#{index + 1}</span>
                                </div>

                                <div className="flex justify-between items-start mb-4">
                                    <div>
                                        <div className="flex items-center gap-2 mb-1">
                                            <h3 className="text-xl font-bold text-foreground tracking-tight uppercase group-hover:text-primary-500 transition-colors">{stock.symbol}</h3>
                                            {/* Direction Badge */}
                                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${stock.direction === 'bullish'
                                                ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20'
                                                : 'bg-rose-500/15 text-rose-400 border border-rose-500/20'
                                                }`}>
                                                {stock.direction === 'bullish' ? <ArrowUpRight size={10} /> : <ArrowDownRight size={10} />}
                                                {stock.direction}
                                            </span>
                                        </div>
                                        <p className="text-[10px] text-muted-foreground font-black uppercase tracking-widest line-clamp-1">{stock.name}</p>
                                    </div>
                                    <div className={`text-sm font-black px-2 py-0.5 rounded ${stock.changePercent >= 0 ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'}`}>
                                        {stock.changePercent >= 0 ? '+' : ''}{stock.changePercent.toFixed(2)}%
                                    </div>
                                </div>

                                <div className="text-3xl font-bold text-foreground">₹{stock.price.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
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
                        <p className="text-muted-foreground font-medium text-sm px-4">Screen 100 NSE stocks to discover high-clarity setups.</p>
                        <button
                            onClick={() => fetchTopStocks(true)}
                            className="text-primary-500 text-[10px] font-black uppercase tracking-widest hover:text-primary-400 transition-colors"
                        >
                            Start Screening
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
