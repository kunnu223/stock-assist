'use client';

import { useState } from 'react';
import { Search, Activity } from 'lucide-react';
import { AnalysisDetail } from '@/components/analysis/AnalysisDetail';

export default function AnalyzePage() {
    const [symbol, setSymbol] = useState('');
    const [loading, setLoading] = useState(false);
    const [data, setData] = useState<any | null>(null);

    const handleAnalyze = async () => {
        if (!symbol) return;
        setLoading(true);
        try {
            const res = await fetch('/api/analyze/single', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ symbol }),
            });
            const response = await res.json();
            if (response.success) {
                // Ensure the response structure is correct for the component
                setData(response.analysis);
            }
        } catch (err) {
            console.error('Analysis failed:', err);
        }
        setLoading(false);
    };

    return (
        <div className="space-y-8 max-w-7xl mx-auto px-4 pb-20">
            <h1 className="text-4xl font-black bg-clip-text text-transparent bg-gradient-to-r from-primary-400 to-purple-400 tracking-tighter uppercase">
                🔍 AI Market Scanner
            </h1>

            {/* Search Bar */}
            <div className="glass rounded-[32px] p-2 flex gap-2 max-w-2xl shadow-2xl shadow-primary-500/5 border border-white/5">
                <input
                    type="text"
                    value={symbol}
                    onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                    onKeyDown={(e) => e.key === 'Enter' && handleAnalyze()}
                    placeholder="Enter stock symbol (e.g., RELIANCE)"
                    className="flex-1 bg-transparent px-6 py-4 text-xl font-bold focus:outline-none placeholder-gray-600 tracking-tight"
                />
                <button
                    onClick={handleAnalyze}
                    disabled={loading || !symbol}
                    className="bg-primary-600 hover:bg-primary-500 disabled:bg-gray-800 px-8 py-3 rounded-[24px] font-black transition-all flex items-center gap-3 shadow-xl hover:shadow-primary-500/20 active:scale-95"
                >
                    {loading ? <Activity className="animate-spin" size={20} /> : <Search size={20} />}
                    <span className="uppercase tracking-widest text-sm">{loading ? 'Scanning...' : 'Analyze'}</span>
                </button>
            </div>

            {data && (
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
                    <AnalysisDetail data={data} />
                </div>
            )}

            {!data && !loading && (
                <div className="py-32 text-center space-y-4">
                    <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mx-auto border border-white/5">
                        <Search className="text-gray-600" size={32} />
                    </div>
                    <p className="text-gray-500 font-medium max-w-xs mx-auto">Enter a symbol above to start zero-lag AI technical & fundamental analysis.</p>
                </div>
            )}
        </div>
    );
}
