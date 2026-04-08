'use client';

/**
 * Dashboard — Top screened stocks with signal clarity breakdown.
 * @module @stock-assist/web/app/page
 */

import { RefreshCw, BarChart3, Zap, ArrowUpRight, ArrowDownRight, Activity, TrendingUp, Search, ChevronRight } from 'lucide-react';
import { useTopStocks } from '@/hooks/useTopStocks';
import type { TopStock, IndicatorSignal } from '@/types';

export default function Dashboard() {
    const {
        stocks,
        totalScanned,
        updatedAt,
        isLoading,
        error,
        isRefreshing,
        refresh,
        retry,
    } = useTopStocks();

    const getTimeAgo = () => {
        if (!updatedAt) return '';
        const minutes = Math.floor((Date.now() - updatedAt.getTime()) / 60000);
        if (minutes < 1) return 'Just now';
        if (minutes < 60) return `${minutes}m ago`;
        const hours = Math.floor(minutes / 60);
        return `${hours}h ago`;
    };

    const bullCount = stocks.filter(s => s.direction === 'bullish').length;
    const bearCount = stocks.filter(s => s.direction === 'bearish').length;
    const avgClarity = stocks.length > 0 ? Math.round(stocks.reduce((a, s) => a + s.signalClarity, 0) / stocks.length) : 0;

    return (
        <div className="space-y-6 max-w-7xl mx-auto pb-24 pt-1 md:pt-6">
            {/* Compact Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-border">
                <div>
                    <div className="flex items-center gap-3 mb-1">
                        <h1 className="text-2xl md:text-3xl font-black text-foreground tracking-tight">
                            Top <span className="text-primary-500">Signals</span>
                        </h1>
                        {stocks.length > 0 && (
                            <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-primary-500/10 border border-primary-500/20 text-primary-500">
                                {stocks.length} / {totalScanned}
                            </span>
                        )}
                    </div>
                    <p className="text-xs text-muted-foreground font-medium">
                        Multi-indicator confluence screening of NSE stocks
                        {updatedAt && <span className="text-zinc-500"> · {getTimeAgo()}</span>}
                    </p>
                </div>
                <button
                    onClick={refresh}
                    disabled={isRefreshing}
                    className="flex items-center gap-2 px-4 py-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-400 hover:text-white rounded-lg transition-all font-bold uppercase tracking-wider text-[10px] disabled:opacity-50"
                >
                    <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
                    {isRefreshing ? 'Scanning...' : 'Re-Screen'}
                </button>
            </div>

            {/* Summary Strip */}
            {stocks.length > 0 && (
                <div className="grid grid-cols-4 gap-3">
                    <SummaryPill label="Bullish" value={String(bullCount)} color="emerald" />
                    <SummaryPill label="Bearish" value={String(bearCount)} color="rose" />
                    <SummaryPill label="Avg Clarity" value={`${avgClarity}%`} color={avgClarity >= 70 ? 'emerald' : 'amber'} />
                    <SummaryPill label="Scanned" value={String(totalScanned)} color="zinc" />
                </div>
            )}

            {/* Error */}
            {error && !isLoading && (
                <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-6 text-center">
                    <p className="text-rose-400 font-bold text-xs mb-3">{error}</p>
                    <button onClick={retry} className="text-primary-500 font-bold text-[10px] uppercase tracking-widest border border-primary-500/20 px-4 py-2 rounded hover:bg-primary-500/5 transition-all">
                        Retry
                    </button>
                </div>
            )}

            {/* Stock Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {isLoading ? (
                    [1, 2, 3, 4, 5, 6].map(i => (
                        <div key={i} className="h-48 rounded-xl animate-pulse bg-zinc-900/50 border border-zinc-800" />
                    ))
                ) : (
                    stocks.map((stock, index) => (
                        <DashboardCard key={stock.symbol} stock={stock} rank={index + 1} />
                    ))
                )}
            </div>

            {/* Empty State */}
            {!isLoading && !error && stocks.length === 0 && (
                <div className="py-32 text-center border border-dashed border-zinc-800 rounded-xl">
                    <div className="max-w-xs mx-auto space-y-4">
                        <div className="w-14 h-14 bg-zinc-900 rounded-full flex items-center justify-center mx-auto border border-zinc-800">
                            <TrendingUp size={20} className="text-zinc-600" />
                        </div>
                        <p className="text-sm font-bold text-foreground">No signals yet</p>
                        <p className="text-xs text-muted-foreground">Screen 100 NSE stocks to find high-clarity setups</p>
                        <button onClick={refresh} className="text-primary-500 text-[10px] font-black uppercase tracking-widest hover:text-primary-400 transition-colors">
                            Start Screening
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════
// COMPONENTS
// ═══════════════════════════════════════════════════════════════

function SummaryPill({ label, value, color }: { label: string; value: string; color: string }) {
    const colorMap: Record<string, string> = {
        emerald: 'text-emerald-400 bg-emerald-500/5 border-emerald-500/20',
        rose: 'text-rose-400 bg-rose-500/5 border-rose-500/20',
        amber: 'text-amber-400 bg-amber-500/5 border-amber-500/20',
        zinc: 'text-zinc-400 bg-zinc-900/50 border-zinc-800',
    };
    return (
        <div className={`rounded-lg border px-3 py-2 text-center ${colorMap[color] || colorMap.zinc}`}>
            <p className="text-[8px] uppercase font-bold tracking-widest text-muted-foreground">{label}</p>
            <p className="text-lg font-black">{value}</p>
        </div>
    );
}

function DashboardCard({ stock, rank }: { stock: TopStock; rank: number }) {
    const isBull = stock.direction === 'bullish';
    const clarityColor = stock.signalClarity >= 75 ? 'emerald' : stock.signalClarity >= 60 ? 'amber' : 'rose';

    // Count signal directions
    const bullSignals = stock.signals?.filter(s => s.direction === 'bullish').length ?? 0;
    const bearSignals = stock.signals?.filter(s => s.direction === 'bearish').length ?? 0;
    const totalSignals = bullSignals + bearSignals;

    return (
        <div
            onClick={() => window.location.href = `/analyze?symbol=${stock.symbol}&auto=true`}
            className={`relative rounded-xl border overflow-hidden cursor-pointer transition-all hover:shadow-lg group ${
                isBull ? 'border-emerald-500/15 hover:border-emerald-500/30 hover:shadow-emerald-500/5' : 'border-rose-500/15 hover:border-rose-500/30 hover:shadow-rose-500/5'
            } bg-zinc-950`}
        >
            {/* Top row: Symbol + Price + Direction */}
            <div className="px-4 pt-4 pb-3 flex items-start justify-between">
                <div>
                    <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-[10px] font-black text-muted-foreground">#{rank}</span>
                        <h3 className="text-lg font-black text-foreground tracking-tight uppercase group-hover:text-primary-500 transition-colors">{stock.symbol}</h3>
                        <span className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-black uppercase ${
                            isBull ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'
                        }`}>
                            {isBull ? <ArrowUpRight size={10} /> : <ArrowDownRight size={10} />}
                            {stock.direction}
                        </span>
                    </div>
                    <p className="text-[10px] text-muted-foreground font-medium truncate max-w-[200px]">{stock.name}</p>
                </div>
                <div className="text-right">
                    <p className="text-lg font-bold text-foreground">₹{stock.price.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</p>
                    <p className={`text-[10px] font-bold ${stock.changePercent >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {stock.changePercent >= 0 ? '+' : ''}{stock.changePercent.toFixed(2)}%
                    </p>
                </div>
            </div>

            {/* Signal Clarity + Confidence bar */}
            <div className="px-4 pb-3">
                <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[9px] text-muted-foreground uppercase font-bold tracking-widest">Signal Clarity</span>
                    <span className={`text-sm font-black text-${clarityColor}-400`}>{stock.signalClarity}%</span>
                </div>
                <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full bg-${clarityColor}-500 transition-all duration-500`} style={{ width: `${stock.signalClarity}%` }} />
                </div>
            </div>

            {/* Reason strip */}
            <div className="px-4 pb-3">
                <p className="text-[10px] text-zinc-400 italic line-clamp-1">{stock.reason}</p>
            </div>

            {/* Indicator signals mini-bar */}
            {totalSignals > 0 && (
                <div className="px-4 pb-3">
                    <div className="flex items-center gap-2">
                        <div className="flex-1 h-1 bg-zinc-800 rounded-full overflow-hidden flex">
                            {bullSignals > 0 && (
                                <div className="h-full bg-emerald-500" style={{ width: `${(bullSignals / totalSignals) * 100}%` }} />
                            )}
                            {bearSignals > 0 && (
                                <div className="h-full bg-rose-500" style={{ width: `${(bearSignals / totalSignals) * 100}%` }} />
                            )}
                        </div>
                        <span className="text-[8px] text-muted-foreground font-bold whitespace-nowrap">
                            {bullSignals}B / {bearSignals}S
                        </span>
                    </div>
                </div>
            )}

            {/* Bottom: Quick signals */}
            {stock.signals && stock.signals.length > 0 && (
                <div className="px-4 pb-3 flex flex-wrap gap-1">
                    {stock.signals.slice(0, 4).map((sig, i) => (
                        <span key={i} className={`px-1.5 py-0.5 text-[8px] font-bold rounded border ${
                            sig.direction === 'bullish' ? 'bg-emerald-500/5 text-emerald-400/80 border-emerald-500/10'
                                : sig.direction === 'bearish' ? 'bg-rose-500/5 text-rose-400/80 border-rose-500/10'
                                : 'bg-zinc-900 text-zinc-500 border-zinc-800'
                        }`}>
                            {sig.name}
                        </span>
                    ))}
                    {stock.signals.length > 4 && (
                        <span className="text-[8px] text-zinc-600 font-bold self-center">+{stock.signals.length - 4}</span>
                    )}
                </div>
            )}

            {/* Scan CTA */}
            <div className="px-4 py-2 border-t border-zinc-800/50 flex items-center justify-between bg-zinc-900/30 group-hover:bg-primary-500/5 transition-colors">
                <span className="text-[9px] text-muted-foreground font-bold uppercase tracking-widest">
                    Confidence: <span className={stock.confidence >= 70 ? 'text-emerald-400' : stock.confidence >= 50 ? 'text-amber-400' : 'text-rose-400'}>{stock.confidence}%</span>
                </span>
                <div className="flex items-center gap-1 text-[9px] text-primary-500 font-bold uppercase tracking-wider opacity-0 group-hover:opacity-100 transition-opacity">
                    Deep Scan <ChevronRight size={12} />
                </div>
            </div>
        </div>
    );
}
