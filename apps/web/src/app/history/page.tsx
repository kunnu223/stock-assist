'use client';

import { useState, useEffect, useCallback } from 'react';
import { Search, Filter, Download, RefreshCw, TrendingUp, History, Calendar as CalendarIcon } from 'lucide-react';
import { StockCard } from '@/components/dashboard/StockCard';
import { Modal } from '@/components/ui/Modal';
import { AnalysisDetail } from '@/components/analysis/AnalysisDetail';

interface HistoryItem {
    _id: string;
    symbol: string;
    date: string;
    confidenceScore: number;
    bullishProb: number;
    bearishProb: number;
    analysis: any;
}

export default function HistoryPage() {
    const [loading, setLoading] = useState(true);
    const [history, setHistory] = useState<HistoryItem[]>([]);
    const [filters, setFilters] = useState({
        symbol: '',
        startDate: '',
        endDate: '',
        minConfidence: 0,
        minBullish: 0,
        minBearish: 0
    });
    const [showFilters, setShowFilters] = useState(false);
    const [selectedItem, setSelectedItem] = useState<HistoryItem | null>(null);

    const fetchHistory = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (filters.symbol) params.append('symbol', filters.symbol);
            if (filters.startDate) params.append('startDate', filters.startDate);
            if (filters.endDate) params.append('endDate', filters.endDate);
            if (filters.minConfidence > 0) params.append('minConfidence', filters.minConfidence.toString());
            if (filters.minBullish > 0) params.append('minBullish', filters.minBullish.toString());
            if (filters.minBearish > 0) params.append('minBearish', filters.minBearish.toString());

            const res = await fetch(`/api/analyze/history?${params.toString()}`);
            const data = await res.json();
            if (data.success) {
                setHistory(data.data);
            }
        } catch (error) {
            console.error('Failed to fetch history:', error);
        } finally {
            setLoading(false);
        }
    }, [filters]);

    useEffect(() => {
        const timer = setTimeout(() => {
            fetchHistory();
        }, 500); // Debounce
        return () => clearTimeout(timer);
    }, [fetchHistory]);

    const handleDownload = () => {
        const dataStr = JSON.stringify(history, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(dataBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `analysis_history_${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className="space-y-12 max-w-7xl mx-auto px-4 pb-24 pt-10">
            {/* Header section */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-border pb-10">
                <div className="space-y-4">
                    <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-primary-500/10 border border-primary-500/20 text-primary-500 text-[10px] font-black uppercase tracking-widest">
                        <History size={12} />
                        <span>Audit Log</span>
                    </div>
                    <h1 className="text-5xl font-bold text-foreground tracking-tight">Intelligence <span className="text-primary-500">History</span></h1>
                    <p className="text-muted-foreground max-w-xl font-medium">Access your comprehensive audit log of historical AI stock analysis from the last 60 days.</p>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        onClick={() => setShowFilters(!showFilters)}
                        className={`flex items-center gap-2 px-6 py-4 rounded-lg transition-all font-black uppercase tracking-widest text-[10px] border ${showFilters ? 'bg-primary-600 border-primary-600 text-white' : 'bg-zinc-900 border-border text-muted-foreground hover:text-foreground'}`}
                    >
                        <Filter size={16} />
                        Advanced Filters
                    </button>
                    <button
                        onClick={handleDownload}
                        disabled={history.length === 0}
                        className="flex items-center gap-2 px-6 py-4 bg-foreground text-background hover:bg-zinc-200 rounded-lg transition-all font-black uppercase tracking-widest text-[10px] disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <Download size={16} />
                        Export Dataset
                    </button>
                </div>
            </div>

            {/* Advanced Filters Section */}
            {showFilters && (
                <div className="premium-card p-10 rounded-xl bg-zinc-950/50 animate-in fade-in slide-in-from-top-6 duration-700">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-12">
                        {/* Search & Dates */}
                        <div className="space-y-8">
                            <div className="space-y-3">
                                <label className="text-[10px] uppercase font-black text-muted-foreground tracking-widest ml-1">Instrument Search</label>
                                <div className="relative">
                                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600" size={18} />
                                    <input
                                        type="text"
                                        placeholder="Symbol (e.g., RELIANCE)"
                                        value={filters.symbol}
                                        onChange={(e) => setFilters({ ...filters, symbol: e.target.value.toUpperCase() })}
                                        className="w-full bg-zinc-900 border border-border rounded-lg py-4 pl-12 pr-5 text-foreground font-bold focus:outline-none focus:ring-1 focus:ring-primary-500 transition-all placeholder-zinc-700"
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-3">
                                    <label className="text-[10px] uppercase font-black text-muted-foreground tracking-widest ml-1">Start Point</label>
                                    <input
                                        type="date"
                                        value={filters.startDate}
                                        onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
                                        className="w-full bg-zinc-900 border border-border rounded-lg py-4 px-4 text-foreground font-bold focus:outline-none focus:ring-1 focus:ring-primary-500"
                                    />
                                </div>
                                <div className="space-y-3">
                                    <label className="text-[10px] uppercase font-black text-muted-foreground tracking-widest ml-1">End Point</label>
                                    <input
                                        type="date"
                                        value={filters.endDate}
                                        onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
                                        className="w-full bg-zinc-900 border border-border rounded-lg py-4 px-4 text-foreground font-bold focus:outline-none focus:ring-1 focus:ring-primary-500"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Sliders */}
                        <div className="space-y-10">
                            <FilterSlider label="Minimum Confidence" value={filters.minConfidence} onChange={(v) => setFilters({ ...filters, minConfidence: v })} />
                            <FilterSlider label="Bullish Saturation" value={filters.minBullish} color="green" onChange={(v) => setFilters({ ...filters, minBullish: v })} />
                        </div>

                        <div className="space-y-10">
                            <FilterSlider label="Bearish Saturation" value={filters.minBearish} color="red" onChange={(v) => setFilters({ ...filters, minBearish: v })} />

                            <button
                                onClick={() => setFilters({ symbol: '', startDate: '', endDate: '', minConfidence: 0, minBullish: 0, minBearish: 0 })}
                                className="w-full py-4 rounded-lg border border-border text-zinc-500 hover:text-foreground hover:bg-zinc-900 transition-all text-[10px] font-black uppercase tracking-widest"
                            >
                                Clear Configuration
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Metrics Dashboard */}
            <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-[0.2em] text-muted-foreground px-2">
                <div className="flex items-center gap-4">
                    <span>Dataset Size: <span className="text-foreground">{history.length} Entries</span></span>
                    <div className="h-3 w-px bg-border" />
                    <span>Retention: <span className="text-foreground">60 Days</span></span>
                </div>
                {loading && <RefreshCw className="animate-spin text-primary-500" size={14} />}
            </div>

            {/* Results Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
                {loading && history.length === 0 ? (
                    [1, 2, 3, 4, 5, 6].map(i => (
                        <div key={i} className="premium-card h-[420px] rounded-xl animate-pulse bg-zinc-900/50 border-border" />
                    ))
                ) : history.length > 0 ? (
                    history.map((item) => (
                        <StockCard
                            key={item._id}
                            analysis={item.analysis}
                            date={item.date}
                            onClick={() => setSelectedItem(item)}
                        />
                    ))
                ) : (
                    <div className="col-span-full py-48 text-center border border-dashed border-border rounded-xl bg-zinc-950/20">
                        <div className="max-w-xs mx-auto space-y-4">
                            <div className="w-16 h-16 bg-zinc-900 rounded-full flex items-center justify-center mx-auto border border-border">
                                <Search size={24} className="text-zinc-700" />
                            </div>
                            <h3 className="text-xl font-bold text-foreground tracking-tight italic">ZERO MATCHES</h3>
                            <p className="text-muted-foreground font-medium text-sm px-4">No historical records match your current filter parameters.</p>
                            <button
                                onClick={() => setFilters({ symbol: '', startDate: '', endDate: '', minConfidence: 0, minBullish: 0, minBearish: 0 })}
                                className="text-primary-500 text-[10px] font-black uppercase tracking-widest hover:text-primary-400 transition-colors"
                            >
                                Reset To Defaults
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Detail Modal */}
            <Modal
                isOpen={!!selectedItem}
                onClose={() => setSelectedItem(null)}
                title={`${selectedItem?.symbol} | Historical Intelligence Report`}
            >
                {selectedItem && <AnalysisDetail data={selectedItem.analysis} />}
            </Modal>
        </div>
    );
}

function FilterSlider({ label, value, color, onChange }: { label: string, value: number, color?: string, onChange: (v: number) => void }) {
    const accentColor = color === 'green' ? 'bg-emerald-500' : color === 'red' ? 'bg-rose-500' : 'bg-primary-500';
    const textColor = color === 'green' ? 'text-emerald-500' : color === 'red' ? 'text-rose-500' : 'text-primary-500';

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center px-1">
                <label className="text-[10px] uppercase font-black text-muted-foreground tracking-widest">{label}</label>
                <span className={`text-[11px] font-bold ${textColor}`}>{value}%</span>
            </div>
            <input
                type="range"
                min="0" max="100"
                value={value}
                onChange={(e) => onChange(parseInt(e.target.value))}
                className={`w-full h-1 bg-zinc-900 rounded-full appearance-none cursor-pointer accent-current ${textColor}`}
            />
        </div>
    );
}
