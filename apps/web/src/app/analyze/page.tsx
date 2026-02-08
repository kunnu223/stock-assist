'use client';

import { useState } from 'react';
import { Search, TrendingUp, TrendingDown, Activity, BarChart2, Globe, FileText, Zap } from 'lucide-react';

// Define enhanced types locally (matching API response)
interface EnhancedAnalysis {
    stock: string;
    currentPrice: number;
    recommendation: 'BUY' | 'SELL' | 'HOLD' | 'WAIT';
    confidenceScore: number;
    timeframe: string;
    // Flattened structure matching API
    technicalPatterns: {
        '1D': string[];
        '1W': string[];
        '1M': string[];
        alignment: string;
    };
    indicators: {
        RSI: number;
        RSIInterpretation: string;
        MACD: string;
        volumeTrend: string;
        bollingerPosition: string;
    };
    news: {
        sentiment: string;
        sentimentScore: number;
        latestHeadlines: string[];
        impactLevel: string;
    };
    fundamentals: {
        valuation: string;
        growth: string;
        peRatio: number | null;
    };
    candlestickPatterns: string[];
    confidenceBreakdown: {
        patternStrength: number;
        newsSentiment: number;
        technicalAlignment: number;
        volumeConfirmation: number;
        fundamentalStrength: number;
    };
    bullish: any;
    bearish: any;
    risks: string[];
    category: string;
    bias: string;
    confidence: string;
}

export default function AnalyzePage() {
    const [symbol, setSymbol] = useState('');
    const [loading, setLoading] = useState(false);
    const [data, setData] = useState<EnhancedAnalysis | null>(null);

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
            if (response.success) setData(response.analysis);
        } catch (err) {
            console.error('Analysis failed:', err);
        }
        setLoading(false);
    };

    const getScoreColor = (score: number) => {
        if (score >= 70) return 'text-green-500';
        if (score >= 50) return 'text-yellow-500';
        return 'text-red-500';
    };

    const getSignalColor = (signal: string) => {
        switch (signal) {
            case 'BUY': return 'bg-green-500/20 text-green-400 border-green-500/50';
            case 'SELL': return 'bg-red-500/20 text-red-400 border-red-500/50';
            case 'HOLD': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50';
            default: return 'bg-gray-500/20 text-gray-400 border-gray-500/50';
        }
    };

    return (
        <div className="space-y-8 max-w-7xl mx-auto px-4 pb-20">
            <h1 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary-400 to-purple-400">
                🔍 Enhanced Stock Analysis
            </h1>

            {/* Search Bar */}
            <div className="glass rounded-2xl p-2 flex gap-2 max-w-2xl shadow-xl shadow-primary-500/5 border border-white/5">
                <input
                    type="text"
                    value={symbol}
                    onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                    onKeyDown={(e) => e.key === 'Enter' && handleAnalyze()}
                    placeholder="Enter stock symbol (e.g., RELIANCE)"
                    className="flex-1 bg-transparent px-6 py-4 text-xl font-medium focus:outline-none placeholder-gray-500"
                />
                <button
                    onClick={handleAnalyze}
                    disabled={loading || !symbol}
                    className="bg-primary-600 hover:bg-primary-500 disabled:bg-gray-700 px-8 py-3 rounded-xl font-bold transition-all flex items-center gap-2 shadow-lg hover:shadow-primary-500/20"
                >
                    {loading ? <Activity className="animate-spin" /> : <Search />}
                    {loading ? 'Scanning...' : 'Analyze'}
                </button>
            </div>

            {data && (
                <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">

                    {/* Header Card */}
                    <div className="glass rounded-3xl p-8 border border-white/10 relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-64 h-64 bg-primary-500/10 blur-[100px] rounded-full pointer-events-none" />

                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 relative z-10">
                            <div>
                                <div className="flex items-baseline gap-4">
                                    <h2 className="text-5xl font-black tracking-tight">{data.stock}</h2>
                                    <span className="text-3xl font-medium text-gray-400">₹{data.currentPrice}</span>
                                </div>
                                <div className="mt-4 flex flex-wrap gap-3">
                                    <span className={`px-4 py-1.5 rounded-full border text-sm font-bold tracking-wider ${getSignalColor(data.recommendation)}`}>
                                        {data.recommendation}
                                    </span>
                                    <span className="px-4 py-1.5 rounded-full bg-white/5 border border-white/10 text-sm font-medium text-gray-300">
                                        Timeframe: {data.timeframe}
                                    </span>
                                    <span className="px-4 py-1.5 rounded-full bg-white/5 border border-white/10 text-sm font-medium text-gray-300">
                                        Category: {data.category}
                                    </span>
                                </div>
                            </div>

                            <div className="flex items-center gap-6 bg-black/20 p-4 rounded-2xl border border-white/5 backdrop-blur-sm">
                                <div className="text-right">
                                    <p className="text-sm text-gray-400 font-medium uppercase tracking-wider">Confidence Score</p>
                                    <p className={`text-5xl font-black ${getScoreColor(data.confidenceScore)}`}>
                                        {data.confidenceScore}<span className="text-2xl text-gray-500">/100</span>
                                    </p>
                                </div>
                                <div className="w-20 h-20 relative">
                                    <svg className="w-full h-full transform -rotate-90">
                                        <circle cx="40" cy="40" r="36" stroke="currentColor" strokeWidth="8" fill="transparent" className="text-gray-800" />
                                        <circle cx="40" cy="40" r="36" stroke="currentColor" strokeWidth="8" fill="transparent"
                                            strokeDasharray={226}
                                            strokeDashoffset={226 - (226 * data.confidenceScore) / 100}
                                            className={`${getScoreColor(data.confidenceScore)} transition-all duration-1000 ease-out`}
                                        />
                                    </svg>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Main Grid */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                        {/* 1. Confidence Breakdown */}
                        <div className="glass rounded-2xl p-6 border border-white/5 lg:col-span-1">
                            <h3 className="text-lg font-bold mb-6 flex items-center gap-2 text-gray-200">
                                <Activity className="text-primary-400" size={20} />
                                Signal Strength
                            </h3>
                            <div className="space-y-5">
                                <ScoreBar label="Chart Patterns" value={data.confidenceBreakdown.patternStrength} />
                                <ScoreBar label="News Sentiment" value={data.confidenceBreakdown.newsSentiment} />
                                <ScoreBar label="Technical Alignment" value={data.confidenceBreakdown.technicalAlignment} />
                                <ScoreBar label="Volume Confirmation" value={data.confidenceBreakdown.volumeConfirmation} />
                                <ScoreBar label="Fundamentals" value={data.confidenceBreakdown.fundamentalStrength} />
                            </div>
                        </div>

                        {/* 2. Scenarios */}
                        <div className="lg:col-span-2 grid md:grid-cols-2 gap-6">
                            <ScenarioCard
                                title="Bullish Setup"
                                scenario={data.bullish}
                                type="bullish"
                                isPrimary={data.recommendation === 'BUY'}
                            />
                            <ScenarioCard
                                title="Bearish Setup"
                                scenario={data.bearish}
                                type="bearish"
                                isPrimary={data.recommendation === 'SELL'}
                            />
                        </div>
                    </div>

                    {/* Detailed Analysis Section */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

                        {/* Technicals */}
                        <div className="glass rounded-2xl p-6 border border-white/5">
                            <h3 className="text-lg font-bold mb-4 flex items-center gap-2 text-blue-300">
                                <BarChart2 size={20} /> Technical Indicators
                            </h3>
                            <div className="space-y-4">
                                <div className="flex justify-between items-center p-3 bg-white/5 rounded-lg">
                                    <span className="text-gray-400">RSI (14)</span>
                                    <div className="text-right">
                                        <span className="font-bold text-lg">{data.indicators.RSI.toFixed(1)}</span>
                                        <span className="text-xs block text-gray-500 uppercase">{data.indicators.RSIInterpretation}</span>
                                    </div>
                                </div>
                                <div className="flex justify-between items-center p-3 bg-white/5 rounded-lg">
                                    <span className="text-gray-400">MACD</span>
                                    <span className={`font-bold capitalize ${data.indicators.MACD === 'bullish' ? 'text-green-400' : 'text-red-400'}`}>
                                        {data.indicators.MACD}
                                    </span>
                                </div>
                                <div className="flex justify-between items-center p-3 bg-white/5 rounded-lg">
                                    <span className="text-gray-400">Bollinger Bands</span>
                                    <span className="font-bold capitalize text-primary-300">
                                        {data.indicators.bollingerPosition.replace('_', ' ')}
                                    </span>
                                </div>
                                <div className="p-3 bg-white/5 rounded-lg">
                                    <span className="text-gray-400 block mb-2">Candlestick Patterns</span>
                                    <div className="flex flex-wrap gap-2">
                                        {data.candlestickPatterns.length > 0 ? (
                                            data.candlestickPatterns.map((p, i) => (
                                                <span key={i} className="px-2 py-1 bg-white/10 rounded text-xs font-medium">
                                                    {p}
                                                </span>
                                            ))
                                        ) : (
                                            <span className="text-gray-500 text-sm">No clear patterns</span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Multi-Timeframe */}
                        <div className="glass rounded-2xl p-6 border border-white/5">
                            <h3 className="text-lg font-bold mb-4 flex items-center gap-2 text-purple-300">
                                <Zap size={20} /> Multi-Timeframe
                            </h3>
                            <div className="space-y-4">
                                <TimeframeRow label="Daily (1D)" patterns={data.technicalPatterns['1D']} />
                                <TimeframeRow label="Weekly (1W)" patterns={data.technicalPatterns['1W']} />
                                <TimeframeRow label="Monthly (1M)" patterns={data.technicalPatterns['1M']} />

                                <div className="mt-4 p-4 bg-purple-500/10 rounded-xl border border-purple-500/20">
                                    <span className="text-xs text-purple-300 uppercase font-bold tracking-wider">Overall Alignment</span>
                                    <div className="text-xl font-bold capitalize mt-1 text-white">
                                        {data.technicalPatterns.alignment}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* News & Fundamentals */}
                        <div className="glass rounded-2xl p-6 border border-white/5">
                            <h3 className="text-lg font-bold mb-4 flex items-center gap-2 text-yellow-300">
                                <Globe size={20} /> Market Context
                            </h3>

                            {/* News Section */}
                            <div className="mb-6">
                                <div className="flex justify-between items-center mb-3">
                                    <span className="text-gray-400 font-medium">News Sentiment</span>
                                    <span className={`px-2 py-0.5 rounded text-xs font-bold uppercase 
                                        ${data.news.sentiment === 'positive' ? 'bg-green-500/20 text-green-400' :
                                            data.news.sentiment === 'negative' ? 'bg-red-500/20 text-red-400' : 'bg-gray-500/20 text-gray-400'}`}>
                                        {data.news.sentiment} ({data.news.sentimentScore}%)
                                    </span>
                                </div>
                                <div className="space-y-2">
                                    {data.news.latestHeadlines.slice(0, 2).map((h, i) => (
                                        <p key={i} className="text-xs text-gray-300 line-clamp-2 pl-2 border-l-2 border-white/10">
                                            {h}
                                        </p>
                                    ))}
                                </div>
                            </div>

                            {/* Fundamentals */}
                            <div className="grid grid-cols-2 gap-3">
                                <div className="p-3 bg-white/5 rounded-lg">
                                    <span className="text-xs text-gray-500 block">Valuation</span>
                                    <span className="font-bold capitalize text-primary-200">{data.fundamentals.valuation}</span>
                                </div>
                                <div className="p-3 bg-white/5 rounded-lg">
                                    <span className="text-xs text-gray-500 block">Growth</span>
                                    <span className="font-bold capitalize text-green-200">{data.fundamentals.growth}</span>
                                </div>
                                <div className="p-3 bg-white/5 rounded-lg col-span-2">
                                    <span className="text-xs text-gray-500 block">P/E Ratio</span>
                                    <span className="font-bold">{data.fundamentals.peRatio || 'N/A'}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// --- Sub-components for cleaner code ---

const ScoreBar = ({ label, value }: { label: string, value: number }) => (
    <div>
        <div className="flex justify-between mb-1.5 ">
            <span className="text-sm font-medium text-gray-300">{label}</span>
            <span className="text-sm font-bold text-white">{value}%</span>
        </div>
        <div className="h-2 bg-gray-700/50 rounded-full overflow-hidden">
            <div
                className={`h-full rounded-full transition-all duration-1000 ${value >= 70 ? 'bg-green-500' : value >= 40 ? 'bg-yellow-500' : 'bg-red-500'
                    }`}
                style={{ width: `${value}%` }}
            />
        </div>
    </div>
);

const TimeframeRow = ({ label, patterns }: { label: string, patterns: string[] }) => (
    <div className="p-3 bg-white/5 rounded-lg">
        <div className="text-xs text-gray-400 mb-1">{label}</div>
        <div className="text-sm font-medium text-white">
            {patterns && patterns.length > 0 ? patterns.join(', ') : 'No significant patterns'}
        </div>
    </div>
);

const safeRender = (val: any) => {
    if (val === null || val === undefined) return '';
    if (typeof val === 'object') return JSON.stringify(val);
    return val;
};

function ScenarioCard({ title, scenario, type, isPrimary }: { title: string; scenario: any; type: 'bullish' | 'bearish'; isPrimary: boolean }) {
    if (!scenario) return null;

    const isBullish = type === 'bullish';
    // Static classes for Tailwind to detect
    const styles = isBullish ? {
        border: 'border-green-500/30',
        bg: 'bg-green-500',
        bgMix: 'bg-green-500/20',
        text: 'text-green-100',
        subText: 'text-green-300',
        icon: 'text-green-400',
        badge: 'bg-green-500'
    } : {
        border: 'border-red-500/30',
        bg: 'bg-red-500',
        bgMix: 'bg-red-500/20',
        text: 'text-red-100',
        subText: 'text-red-300',
        icon: 'text-red-400',
        badge: 'bg-red-500'
    };

    const bgOpacity = isPrimary ? 'bg-opacity-20' : 'bg-opacity-5';
    const Icon = isBullish ? TrendingUp : TrendingDown;

    return (
        <div className={`rounded-2xl p-6 border ${styles.border} ${styles.bg} ${bgOpacity} relative overflow-hidden transition-all hover:scale-[1.02]`}>
            {isPrimary && (
                <div className={`absolute top-0 right-0 px-3 py-1 ${styles.badge} text-white text-xs font-bold rounded-bl-xl shadow-lg`}>
                    PRIMARY SCENARIO
                </div>
            )}

            <div className="flex items-center gap-3 mb-6">
                <div className={`p-2 rounded-lg ${styles.bgMix}`}>
                    <Icon className={styles.icon} size={24} />
                </div>
                <div>
                    <h3 className={`text-xl font-bold ${styles.text}`}>{title}</h3>
                    <span className={`${styles.subText} text-sm font-medium`}>{safeRender(scenario.probability)}% Probability</span>
                </div>
            </div>

            <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                    <div className="p-3 bg-black/20 rounded-xl">
                        <span className="text-xs text-gray-400 block mb-1">Entry Zone</span>
                        <span className="font-bold text-white">₹{safeRender(scenario.tradePlan?.entry?.[0])} - ₹{safeRender(scenario.tradePlan?.entry?.[1])}</span>
                    </div>
                    <div className="p-3 bg-black/20 rounded-xl">
                        <span className="text-xs text-gray-400 block mb-1">Stop Loss</span>
                        <span className="font-bold text-red-300">₹{safeRender(scenario.tradePlan?.stopLoss)}</span>
                        <span className="text-xs text-gray-500 ml-1">({safeRender(scenario.tradePlan?.stopLossPercent)}%)</span>
                    </div>
                </div>

                <div className="p-4 bg-black/20 rounded-xl border border-white/5">
                    <span className="text-xs text-gray-400 block mb-3 uppercase tracking-wider font-bold">Targets</span>
                    <div className="space-y-3">
                        {scenario.tradePlan?.targets?.map((t: any, i: number) => (
                            <div key={i} className="flex justify-between items-center">
                                <span className="text-gray-300 font-medium">Target {i + 1}</span>
                                <div className="flex items-center gap-3">
                                    <span className="font-bold text-lg text-primary-200">₹{safeRender(t.price)}</span>
                                    <span className="text-xs text-gray-500 bg-white/5 px-2 py-0.5 rounded">{safeRender(t.probability)}% prob</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="flex gap-2">
                    <span className="px-3 py-1 bg-white/5 rounded-lg text-xs font-medium text-gray-400">
                        RR: 1:{safeRender(scenario.tradePlan?.riskReward)}
                    </span>
                    <span className="px-3 py-1 bg-white/5 rounded-lg text-xs font-medium text-gray-400">
                        Horizon: {safeRender(scenario.timeHorizon)}
                    </span>
                </div>
            </div>
        </div>
    );
}
