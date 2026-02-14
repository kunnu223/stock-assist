'use client';

import { useState, useEffect } from 'react';
import { Search, Activity, Terminal, Shield } from 'lucide-react';
import { AnalysisDetail } from '@/components/analysis/AnalysisDetail';

import { useLanguage } from '@/context/LanguageContext';

export default function AnalyzePage() {
    const [symbol, setSymbol] = useState('');
    const [loading, setLoading] = useState(false);
    const [data, setData] = useState<any | null>(null);
    const { t, language } = useLanguage();

    // Auto-scan on mount if query params present
    useEffect(() => {
        const searchParams = new URLSearchParams(window.location.search);
        const querySymbol = searchParams.get('symbol');
        const auto = searchParams.get('auto');

        if (querySymbol) {
            setSymbol(querySymbol);
            if (auto === 'true') {
                executeScan(querySymbol);
            }
        }
    }, [language]); // Re-run if language changes? Maybe not needed for auto-scan but good for safety

    const executeScan = async (sym: string) => {
        if (!sym) return;
        setLoading(true);
        setData(null);

        try {
            const res = await fetch('/api/analyze/single', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ symbol: sym, language }),
            });
            const response = await res.json();
            if (response.success) {
                setData(response.analysis);
            }
        } catch (err) {
            console.error('Analysis failed:', err);
        }
        setLoading(false);
    };

    const handleAnalyze = () => executeScan(symbol);

    return (
        <div className="space-y-6 md:space-y-12 max-w-7xl mx-auto pb-24 pt-1 md:pt-10">
            {/* Header section */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-border pb-6 md:pb-10">
                <div className="space-y-3 md:space-y-4">
                    <div className="hidden md:inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-primary-500/10 border border-primary-500/20 text-primary-500 text-[10px] font-black uppercase tracking-widest">
                        <Terminal size={12} />
                        <span>{t('analyze.liveScan')}</span>
                    </div>
                    <h1 className="text-3xl md:text-5xl font-bold text-foreground tracking-tight">{t('analyze.title')} <span className="text-primary-500">{t('analyze.subtitle')}</span></h1>
                    <p className="text-muted-foreground max-w-xl font-medium text-sm md:text-base">{t('analyze.description')}</p>
                </div>
                <div className="hidden md:flex items-center gap-4 text-xs font-bold text-muted-foreground uppercase tracking-widest">
                    <div className="flex items-center gap-2">
                        <Shield size={14} className="text-primary-500" />
                        <span>{t('analyze.patternVerified')}</span>
                    </div>
                    <div className="h-4 w-px bg-border" />
                    <span>{t('analyze.precision')}</span>
                </div>
            </div>

            {/* Scanning Logic */}
            <div className="max-w-3xl">
                <div className="flex flex-col md:flex-row gap-3 md:gap-2 md:premium-card md:p-2 md:rounded-xl md:shadow-premium md:bg-zinc-950/50">
                    <div className="relative flex-1 group bg-zinc-950/50 md:bg-transparent p-1 md:p-0 rounded-xl md:rounded-none border border-border md:border-none shadow-sm md:shadow-none">
                        <div className="absolute left-4 md:left-6 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary-500 transition-colors">
                            <Search size={20} className="md:w-[22px] md:h-[22px]" />
                        </div>
                        <input
                            type="text"
                            value={symbol}
                            onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                            onKeyDown={(e) => e.key === 'Enter' && handleAnalyze()}
                            placeholder={t('analyze.placeholder')}
                            className="w-full bg-transparent pl-12 md:pl-16 pr-4 md:pr-6 py-4 md:py-5 text-base md:text-lg font-bold text-foreground focus:outline-none placeholder-zinc-700 tracking-tight uppercase"
                        />
                    </div>
                    <button
                        onClick={handleAnalyze}
                        disabled={loading || !symbol}
                        className="relative w-full md:w-auto bg-primary-600 hover:bg-primary-500 disabled:bg-zinc-800 disabled:text-zinc-600 px-6 md:px-10 h-[52px] rounded-xl md:rounded-lg font-black transition-all flex items-center justify-center active:scale-95 text-white uppercase tracking-widest text-xs shadow-lg md:shadow-none"
                    >
                        <span className={loading ? 'invisible' : 'visible'}>{t('analyze.execute')}</span>
                        {loading && (
                            <div className="absolute inset-0 flex items-center justify-center">
                                <Activity className="animate-spin" size={16} />
                            </div>
                        )}
                    </button>
                </div>
                <p className="mt-4 px-2 text-[10px] text-muted-foreground font-bold uppercase tracking-widest hidden md:block">
                    {t('analyze.support')}
                </p>
            </div>

            {data && (
                <div className="animate-in fade-in slide-in-from-bottom-6 duration-1000">
                    <AnalysisDetail data={data} />
                </div>
            )}

            {!data && !loading && (
                <div className="py-20 md:py-40 flex flex-col items-center justify-center text-center space-y-6 md:space-y-8 animate-in fade-in zoom-in-95 duration-700">
                    <div className="w-16 h-16 md:w-24 md:h-24 bg-zinc-900 border border-border rounded-2xl flex items-center justify-center rotate-3 hover:rotate-0 transition-transform duration-500 shadow-premium">
                        <Activity className="text-zinc-600" size={32} />
                    </div>
                    <div className="space-y-2 px-4">
                        <h3 className="text-xl md:text-2xl font-bold text-foreground tracking-tight uppercase">{t('analyze.ready')}</h3>
                        <p className="text-muted-foreground font-medium max-w-sm mx-auto text-sm md:text-base">{t('analyze.readyDesc')}</p>
                    </div>
                </div>
            )}
        </div>
    );
}
