'use client';

import { useState } from 'react';
import { StockCard } from '@/components/dashboard/StockCard';
import { AnalysisButton } from '@/components/dashboard/AnalysisButton';
import { StatsBar } from '@/components/dashboard/StatsBar';
import type { StockAnalysis } from '@stock-assist/shared';

export default function Dashboard() {
    const [loading, setLoading] = useState(false);
    const [results, setResults] = useState<{
        strongSetups: StockAnalysis[];
        neutral: StockAnalysis[];
        avoid: StockAnalysis[];
    } | null>(null);

    const runAnalysis = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/analyze/stocks');
            const data = await res.json();
            if (data.success) {
                setResults({
                    strongSetups: data.strongSetups,
                    neutral: data.neutral,
                    avoid: data.avoid,
                });
            }
        } catch (err) {
            console.error('Analysis failed:', err);
        }
        setLoading(false);
    };

    return (
        <div className="space-y-6">
            <header className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold">🚀 Morning Screening</h1>
                    <p className="text-gray-400">AI-Powered Dual Strategy Analysis</p>
                </div>
                <AnalysisButton onClick={runAnalysis} loading={loading} />
            </header>

            {results && <StatsBar results={results} />}

            {results && (
                <div className="space-y-8">
                    {results.strongSetups.length > 0 && (
                        <section>
                            <h2 className="text-xl font-semibold text-bullish mb-4">
                                ✅ Strong Setups ({results.strongSetups.length})
                            </h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {results.strongSetups.map((s) => (
                                    <StockCard key={s.stock} analysis={s} />
                                ))}
                            </div>
                        </section>
                    )}

                    {results.neutral.length > 0 && (
                        <section>
                            <h2 className="text-xl font-semibold text-neutral mb-4">
                                ⏳ Neutral ({results.neutral.length})
                            </h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {results.neutral.map((s) => (
                                    <StockCard key={s.stock} analysis={s} />
                                ))}
                            </div>
                        </section>
                    )}

                    {results.avoid.length > 0 && (
                        <section>
                            <h2 className="text-xl font-semibold text-bearish mb-4">
                                ❌ Avoid ({results.avoid.length})
                            </h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {results.avoid.map((s) => (
                                    <StockCard key={s.stock} analysis={s} />
                                ))}
                            </div>
                        </section>
                    )}
                </div>
            )}

            {!results && !loading && (
                <div className="text-center py-20 text-gray-400">
                    <p className="text-lg">Click "Run Analysis" to start morning screening</p>
                    <p className="text-sm">Analyzes your watchlist with AI dual-strategy</p>
                </div>
            )}
        </div>
    );
}
