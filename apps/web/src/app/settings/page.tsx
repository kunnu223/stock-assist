'use client';

import { useEffect, useState } from 'react';
import type { Performance } from '@stock-assist/shared';
import { TrendingUp, TrendingDown, Target, Award } from 'lucide-react';

export default function SettingsPage() {
    const [performance, setPerformance] = useState<Performance | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchPerformance();
    }, []);

    const fetchPerformance = async () => {
        try {
            const res = await fetch('/api/analytics');
            const data = await res.json();
            if (data.success) setPerformance(data.performance);
        } catch (err) {
            console.error(err);
        }
        setLoading(false);
    };

    if (loading) return <p>Loading...</p>;

    return (
        <div className="space-y-6">
            <h1 className="text-3xl font-bold">⚙️ Settings & Analytics</h1>

            {performance && (
                <div className="space-y-6">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <StatCard icon={<Target />} label="Total Trades" value={performance.totalTrades} />
                        <StatCard icon={<Award />} label="Win Rate" value={`${performance.winRate}%`} color={performance.winRate >= 70 ? 'bullish' : 'neutral'} />
                        <StatCard icon={<TrendingUp />} label="Total P&L" value={`₹${performance.totalPnL}`} color={performance.totalPnL >= 0 ? 'bullish' : 'bearish'} />
                        <StatCard icon={<Target />} label="Profit Factor" value={performance.profitFactor} />
                    </div>

                    <div className="glass rounded-xl p-4">
                        <h2 className="text-xl font-semibold mb-4">Pattern Performance</h2>
                        <div className="space-y-2">
                            {performance.patternStats.map((p) => (
                                <div key={p.pattern} className="bg-white/5 rounded-lg p-3 flex items-center justify-between">
                                    <span className="font-semibold capitalize">{p.pattern.replace(/_/g, ' ')}</span>
                                    <div className="flex items-center gap-4 text-sm">
                                        <span>{p.trades} trades</span>
                                        <span className={p.winRate >= 70 ? 'text-bullish' : 'text-neutral'}>{p.winRate}% WR</span>
                                        <span className={p.totalPnL >= 0 ? 'text-bullish' : 'text-bearish'}>₹{p.totalPnL}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function StatCard({ icon, label, value, color = '' }: { icon: React.ReactNode; label: string; value: string | number; color?: string }) {
    return (
        <div className="glass rounded-xl p-4">
            <div className="flex items-center gap-2 text-gray-400 mb-2">
                {icon}
                <span className="text-sm">{label}</span>
            </div>
            <p className={`text-2xl font-bold ${color ? `text-${color}` : ''}`}>{value}</p>
        </div>
    );
}
