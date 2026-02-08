'use client';

import { useEffect, useState } from 'react';
import { Plus, X, TrendingUp, TrendingDown } from 'lucide-react';
import type { Trade } from '@stock-assist/shared';

export default function JournalPage() {
    const [trades, setTrades] = useState<Trade[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchTrades();
    }, []);

    const fetchTrades = async () => {
        try {
            const res = await fetch('/api/trade');
            const data = await res.json();
            if (data.success) setTrades(data.trades);
        } catch (err) {
            console.error(err);
        }
        setLoading(false);
    };

    const openTrades = trades.filter((t) => t.status === 'OPEN');
    const closedTrades = trades.filter((t) => t.status === 'CLOSED');

    return (
        <div className="space-y-6">
            <header className="flex items-center justify-between">
                <h1 className="text-3xl font-bold">📒 Trade Journal</h1>
                <button className="bg-primary-600 hover:bg-primary-500 px-4 py-2 rounded-lg flex items-center gap-2">
                    <Plus size={18} />
                    New Trade
                </button>
            </header>

            <div className="grid md:grid-cols-2 gap-6">
                <section className="glass rounded-xl p-4">
                    <h2 className="text-xl font-semibold mb-4">Open Trades ({openTrades.length})</h2>
                    <div className="space-y-3">
                        {openTrades.length === 0 && <p className="text-gray-400">No open trades</p>}
                        {openTrades.map((t) => <TradeRow key={t.id} trade={t} />)}
                    </div>
                </section>

                <section className="glass rounded-xl p-4">
                    <h2 className="text-xl font-semibold mb-4">Closed Trades ({closedTrades.length})</h2>
                    <div className="space-y-3 max-h-96 overflow-auto">
                        {closedTrades.length === 0 && <p className="text-gray-400">No closed trades</p>}
                        {closedTrades.map((t) => <TradeRow key={t.id} trade={t} />)}
                    </div>
                </section>
            </div>
        </div>
    );
}

function TradeRow({ trade }: { trade: Trade }) {
    const isWin = (trade.profitLoss || 0) > 0;
    const Icon = trade.direction === 'LONG' ? TrendingUp : TrendingDown;

    return (
        <div className="bg-white/5 rounded-lg p-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
                <Icon className={trade.direction === 'LONG' ? 'text-bullish' : 'text-bearish'} size={20} />
                <div>
                    <p className="font-semibold">{trade.stock}</p>
                    <p className="text-sm text-gray-400">
                        {trade.quantity} @ ₹{trade.entryPrice}
                    </p>
                </div>
            </div>
            {trade.status === 'CLOSED' && (
                <div className={`text-right ${isWin ? 'text-bullish' : 'text-bearish'}`}>
                    <p className="font-semibold">
                        {isWin ? '+' : ''}₹{trade.profitLoss?.toFixed(0)}
                    </p>
                    <p className="text-xs">{trade.profitLossPercent?.toFixed(2)}%</p>
                </div>
            )}
        </div>
    );
}
