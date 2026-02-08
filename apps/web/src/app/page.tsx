'use client';

import { useState, useEffect } from 'react';
import { StockCard } from '@/components/dashboard/StockCard';
import { RefreshCw } from 'lucide-react';

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

    // Fetch top stocks on mount
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
        if (minutes < 60) return `${minutes} min ago`;
        const hours = Math.floor(minutes / 60);
        return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    };

    return (
        <div className="space-y-6">
            <header className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold">📈 Today's Top 10 Stocks</h1>
                    <p className="text-gray-400">
                        AI-filtered from Nifty 50 • Highest confidence setups
                    </p>
                    {updatedAt && (
                        <p className="text-sm text-gray-500 mt-1">
                            Last updated: {getTimeAgo()}
                        </p>
                    )}
                </div>
                <button
                    onClick={() => fetchTopStocks(true)}
                    disabled={refreshing}
                    className="flex items-center gap-2 px-4 py-2 bg-primary/10 hover:bg-primary/20 
                             text-primary rounded-lg transition-colors disabled:opacity-50"
                >
                    <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
                    {refreshing ? 'Analyzing...' : 'Refresh'}
                </button>
            </header>

            {loading && (
                <div className="flex items-center justify-center py-20">
                    <div className="text-center">
                        <RefreshCw className="w-8 h-8 animate-spin text-primary mx-auto mb-4" />
                        <p className="text-gray-400">Loading top stocks...</p>
                    </div>
                </div>
            )}

            {error && !loading && (
                <div className="bg-bearish/10 border border-bearish/20 rounded-lg p-4 text-center">
                    <p className="text-bearish">{error}</p>
                    <button
                        onClick={() => fetchTopStocks()}
                        className="mt-2 text-sm text-primary hover:underline"
                    >
                        Try again
                    </button>
                </div>
            )}

            {!loading && !error && topStocks.length > 0 && (
                <div className="space-y-4">
                    <div className="flex items-center justify-between text-sm text-gray-400">
                        <span>{topStocks.length} stocks analyzed</span>
                        <span>Sorted by AI confidence</span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {topStocks.map((stock, index) => (
                            <div key={stock.symbol} className="relative">
                                <div className="absolute -left-2 -top-2 w-8 h-8 rounded-full bg-primary/20 
                                              flex items-center justify-center text-primary text-sm font-bold z-10">
                                    #{index + 1}
                                </div>
                                <div className="bg-secondary/50 rounded-lg p-4 border border-gray-700/50 
                                              hover:border-primary/30 transition-colors">
                                    <div className="flex justify-between items-start mb-2">
                                        <div>
                                            <h3 className="font-bold text-lg">{stock.symbol}</h3>
                                            <p className="text-xs text-gray-400 line-clamp-1">{stock.name}</p>
                                        </div>
                                        <span className={`text-sm font-semibold ${stock.changePercent >= 0 ? 'text-bullish' : 'text-bearish'
                                            }`}>
                                            {stock.changePercent >= 0 ? '+' : ''}{stock.changePercent.toFixed(2)}%
                                        </span>
                                    </div>
                                    <div className="text-xl font-bold mb-2">₹{stock.price.toFixed(2)}</div>
                                    <div className="flex items-center gap-2 mb-2">
                                        <div className="flex-1 bg-gray-700 rounded-full h-2">
                                            <div
                                                className="bg-primary h-2 rounded-full transition-all"
                                                style={{ width: `${stock.confidence}%` }}
                                            ></div>
                                        </div>
                                        <span className="text-sm font-semibold text-primary">
                                            {stock.confidence}%
                                        </span>
                                    </div>
                                    <p className="text-xs text-gray-400 line-clamp-2">{stock.reason}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {!loading && !error && topStocks.length === 0 && (
                <div className="text-center py-20 text-gray-400">
                    <p className="text-lg">No stocks available</p>
                    <p className="text-sm">Click refresh to analyze current market</p>
                </div>
            )}
        </div>
    );
}
