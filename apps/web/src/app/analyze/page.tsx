'use client';

import { useState, useEffect, useRef } from 'react';
import { Search, Activity, Terminal, Shield } from 'lucide-react';
import { AnalysisDetail } from '@/components/analysis/AnalysisDetail';

import { useLanguage } from '@/context/LanguageContext';

export default function AnalyzePage() {
    const [symbol, setSymbol] = useState('');
    const [isScanning, setIsScanning] = useState(false);
    const [analysis, setAnalysis] = useState<any | null>(null);
    const [error, setError] = useState<string | null>(null); // Added error state
    const { t, language } = useLanguage();
    const resultsRef = useRef<HTMLDivElement>(null); // Added ref for scrolling

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

    const executeScan = async (searchSymbol: string) => { // Changed parameter name
        if (!searchSymbol) return;
        setIsScanning(true); // Renamed from setLoading
        setAnalysis(null); // Renamed from setData
        setError(null); // Reset error

        try {
            const res = await fetch('/api/analyze/single', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ symbol: searchSymbol, language }), // Used searchSymbol
            });
            const response = await res.json();
            if (response.success) {
                setAnalysis(response.analysis); // Renamed from setData
                // Scroll to results after a short delay to allow render
                setTimeout(() => {
                    resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }, 100);
            } else {
                setError(response.error || 'Analysis failed'); // Set error on failure
            }
        } catch (err) {
            console.error('Analysis failed:', err);
            setError('Failed to connect to server'); // Set error on network issues
        } finally {
            setIsScanning(false); // Renamed from setLoading, moved to finally
        }
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
            <div className="max-w-full">
                <div className="flex flex-col md:flex-row gap-4 relative z-10 w-full mb-8">
                    <div className="relative group flex-1">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary-500 transition-colors" size={20} />
                        <input
                            type="text"
                            placeholder={t('analyze.inputPlaceholder')}
                            className="w-full bg-zinc-900/50 backdrop-blur-sm border border-zinc-800 rounded-xl py-4 pl-12 pr-4 outline-none focus:border-primary-500 transition-all font-medium text-lg placeholder:text-zinc-600 disabled:opacity-50"
                            value={symbol}
                            onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                            onKeyDown={(e) => e.key === 'Enter' && handleAnalyze()}
                            disabled={isScanning}
                        />
                    </div>
                    <button
                        onClick={handleAnalyze}
                        disabled={isScanning || !symbol}
                        className="bg-primary-600 hover:bg-primary-500 text-white px-8 py-4 rounded-xl font-bold tracking-wide transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-primary-600/20 active:scale-95 flex items-center justify-center gap-2 min-w-[140px]"
                    >
                        {isScanning ? (
                            <>
                                <Activity className="animate-spin" size={20} />
                                <span>SCANNING...</span>
                            </>
                        ) : (
                            <>
                                <Search size={20} />
                                <span>{t('analyze.scanButton')}</span>
                            </>
                        )}
                    </button>
                </div>

                {/* Results Section */}
                {analysis && (
                    <div ref={resultsRef} className="scroll-mt-24 animate-in fade-in slide-in-from-bottom-6 duration-1000">
                        <AnalysisDetail data={analysis} />
                    </div>
                )}

                {error && (
                    <div className="py-10 text-center text-red-500 font-medium bg-red-500/10 rounded-xl border border-red-500/20">
                        {error}
                    </div>
                )}

                {!analysis && !isScanning && !error && (
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
        </div>
    );
}
