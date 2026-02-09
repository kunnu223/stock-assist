'use client';

import { useState, useEffect, useCallback } from 'react';
import { Search, Filter, Download, RefreshCw, TrendingUp } from 'lucide-react';
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
        <div className="space-y-8 pb-20">
            {/* Header section */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div className="space-y-2">
                    <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-primary-500/10 border border-primary-500/20 text-primary-400 text-[10px] font-black uppercase tracking-widest">
                        <TrendingUp size={12} />
                        <span>Analysis Insights</span>
                    </div>
                    <h1 className="text-4xl font-black text-white tracking-tighter uppercase">Trade <span className="text-primary-500">History</span></h1>
                    <p className="text-gray-500 max-w-xl font-medium">Review and download your historical AI stock analysis from the last 60 days. Filter by performance metrics to find the best setups.</p>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        onClick={() => setShowFilters(!showFilters)}
                        className={`flex items-center gap-2 px-6 py-3 rounded-2xl transition-all font-black uppercase tracking-widest text-[10px] ${showFilters ? 'bg-primary-500 text-white shadow-xl shadow-primary-500/20' : 'glass text-gray-400 hover:text-white border border-white/5'}`}
                    >
                        <Filter size={16} />
                        Filters
                    </button>
                    <button
                        onClick={handleDownload}
                        disabled={history.length === 0}
                        className="flex items-center gap-2 px-6 py-3 bg-white text-black hover:bg-primary-400 hover:text-white rounded-2xl transition-all font-black uppercase tracking-widest text-[10px] shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <Download size={16} />
                        Export JSON
                    </button>
                </div>
            </div>

            {/* Advanced Filters Section */}
            {showFilters && (
                <div className="glass rounded-[32px] p-8 border border-white/5 animate-in fade-in slide-in-from-top-4 duration-500">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
                        {/* Search & Dates */}
                        <div className="space-y-6">
                            <div className="space-y-2">
                                <label className="text-[10px] uppercase font-black text-gray-500 tracking-widest ml-1">Search Symbol</label>
                                <input
                                    type="text"
                                    placeholder="E.g. SBIN, RELIANCE..."
                                    value={filters.symbol}
                                    onChange={(e) => setFilters({ ...filters, symbol: e.target.value.toUpperCase() })}
                                    className="w-full bg-white/[0.03] border border-white/10 rounded-2xl py-4 px-5 text-white font-bold focus:outline-none focus:ring-2 focus:ring-primary-500/30 transition-all placeholder-gray-700"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-[10px] uppercase font-black text-gray-500 tracking-widest ml-1">Start Date</label>
                                    <input
                                        type="date"
                                        value={filters.startDate}
                                        onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
                                        className="w-full bg-white/[0.03] border border-white/10 rounded-2xl py-4 px-4 text-white font-bold focus:outline-none focus:ring-2 focus:ring-primary-500/30"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] uppercase font-black text-gray-500 tracking-widest ml-1">End Date</label>
                                    <input
                                        type="date"
                                        value={filters.endDate}
                                        onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
                                        className="w-full bg-white/[0.03] border border-white/10 rounded-2xl py-4 px-4 text-white font-bold focus:outline-none focus:ring-2 focus:ring-primary-500/30"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Sliders */}
                        <div className="space-y-8">
                            <div className="space-y-4">
                                <div className="flex justify-between items-center px-1">
                                    <label className="text-[10px] uppercase font-black text-gray-500 tracking-widest">Min Confidence</label>
                                    <span className="text-primary-400 font-black text-xs bg-primary-500/10 px-2 py-1 rounded-lg border border-primary-500/20">{filters.minConfidence}%</span>
                                </div>
                                <input
                                    type="range"
                                    min="0" max="100"
                                    value={filters.minConfidence}
                                    onChange={(e) => setFilters({ ...filters, minConfidence: parseInt(e.target.value) })}
                                    className="w-full h-1.5 bg-white/5 rounded-full appearance-none cursor-pointer accent-primary-500"
                                />
                            </div>
                            <div className="space-y-4">
                                <div className="flex justify-between items-center px-1">
                                    <label className="text-[10px] uppercase font-black text-gray-500 tracking-widest">Min Bullish</label>
                                    <span className="text-green-400 font-black text-xs bg-green-500/10 px-2 py-1 rounded-lg border border-green-500/20">{filters.minBullish}%</span>
                                </div>
                                <input
                                    type="range"
                                    min="0" max="100"
                                    value={filters.minBullish}
                                    onChange={(e) => setFilters({ ...filters, minBullish: parseInt(e.target.value) })}
                                    className="w-full h-1.5 bg-white/5 rounded-full appearance-none cursor-pointer accent-primary-500"
                                />
                            </div>
                        </div>

                        <div className="space-y-8">
                            <div className="space-y-4">
                                <div className="flex justify-between items-center px-1">
                                    <label className="text-[10px] uppercase font-black text-gray-500 tracking-widest">Min Bearish</label>
                                    <span className="text-red-400 font-black text-xs bg-red-500/10 px-2 py-1 rounded-lg border border-red-500/20">{filters.minBearish}%</span>
                                </div>
                                <input
                                    type="range"
                                    min="0" max="100"
                                    value={filters.minBearish}
                                    onChange={(e) => setFilters({ ...filters, minBearish: parseInt(e.target.value) })}
                                    className="w-full h-1.5 bg-white/5 rounded-full appearance-none cursor-pointer accent-primary-500"
                                />
                            </div>

                            <button
                                onClick={() => setFilters({ symbol: '', startDate: '', endDate: '', minConfidence: 0, minBullish: 0, minBearish: 0 })}
                                className="w-full py-4 rounded-2xl border border-white/5 text-gray-500 hover:text-white hover:bg-white/5 transition-all text-[10px] font-black uppercase tracking-widest"
                            >
                                Reset Filters
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Results Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {loading && history.length === 0 ? (
                    [1, 2, 3, 4, 5, 6].map(i => (
                        <div key={i} className="glass h-[400px] rounded-[32px] animate-pulse bg-white/5 border border-white/5" />
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
                    <div className="col-span-full py-32 text-center text-gray-500">
                        No results found matching your criteria.
                    </div>
                )}
            </div>

            {/* Detail Modal */}
            <Modal
                isOpen={!!selectedItem}
                onClose={() => setSelectedItem(null)}
                title={`${selectedItem?.symbol} Historical Analysis Detail`}
            >
                {selectedItem && <AnalysisDetail data={selectedItem.analysis} />}
            </Modal>
        </div>
    );
}
