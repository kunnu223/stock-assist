'use client';

import type { StockAnalysis } from '@stock-assist/shared';
import { TrendingUp, AlertCircle, Activity } from 'lucide-react';

interface Props {
    results: {
        strongSetups: StockAnalysis[];
        neutral: StockAnalysis[];
        avoid: StockAnalysis[];
    };
}

export function StatsBar({ results }: Props) {
    const total = results.strongSetups.length + results.neutral.length + results.avoid.length;

    return (
        <div className="glass rounded-xl p-4 grid grid-cols-4 gap-4">
            <Stat
                icon={<Activity className="text-primary-500" />}
                label="Total Analyzed"
                value={total}
            />
            <Stat
                icon={<TrendingUp className="text-bullish" />}
                label="Strong Setups"
                value={results.strongSetups.length}
                color="text-bullish"
            />
            <Stat
                icon={<Activity className="text-neutral" />}
                label="Neutral"
                value={results.neutral.length}
                color="text-neutral"
            />
            <Stat
                icon={<AlertCircle className="text-bearish" />}
                label="Avoid"
                value={results.avoid.length}
                color="text-bearish"
            />
        </div>
    );
}

function Stat({ icon, label, value, color = 'text-white' }: { icon: React.ReactNode; label: string; value: number; color?: string }) {
    return (
        <div className="flex items-center space-x-3">
            <div className="p-2 bg-white/5 rounded-lg">{icon}</div>
            <div>
                <p className="text-xs text-gray-400">{label}</p>
                <p className={`text-2xl font-bold ${color}`}>{value}</p>
            </div>
        </div>
    );
}
