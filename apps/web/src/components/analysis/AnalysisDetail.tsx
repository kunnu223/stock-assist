'use client';

import { Activity, BarChart2, Globe, Zap, TrendingUp, TrendingDown } from 'lucide-react';

// Shared types (simplified for component usage)
export interface AnalysisData {
    stock: string;
    currentPrice: number;
    recommendation: 'BUY' | 'SELL' | 'HOLD' | 'WAIT';
    confidenceScore: number;
    timeframe: string;
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

interface AnalysisDetailProps {
    data: AnalysisData;
}

export function AnalysisDetail({ data }: AnalysisDetailProps) {
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
        <div className="space-y-8">
            {/* Header Card */}
            <div className="bg-white/[0.02] rounded-3xl p-8 border border-white/5 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-primary-500/10 blur-[100px] rounded-full pointer-events-none" />

                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 relative z-10">
                    <div>
                        <div className="flex items-baseline gap-4">
                            <h2 className="text-5xl font-black tracking-tight text-white">{data.stock}</h2>
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
                <div className="glass rounded-2xl p-6 border border-white/5 lg:col-span-1">
                    <h3 className="text-lg font-bold mb-6 flex items-center gap-2 text-white">
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

                <div className="lg:col-span-2 grid md:grid-cols-2 gap-6">
                    <ScenarioCard title="Bullish Setup" scenario={data.bullish} type="bullish" isPrimary={data.recommendation === 'BUY'} />
                    <ScenarioCard title="Bearish Setup" scenario={data.bearish} type="bearish" isPrimary={data.recommendation === 'SELL'} />
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {/* Technicals */}
                <div className="glass rounded-2xl p-6 border border-white/5">
                    <h3 className="text-lg font-bold mb-4 flex items-center gap-2 text-blue-300">
                        <BarChart2 size={20} /> Technical Indicators
                    </h3>
                    <div className="space-y-4">
                        <MetricRow label="RSI (14)" value={data.indicators.RSI.toFixed(1)} subValue={data.indicators.RSIInterpretation} />
                        <MetricRow label="MACD" value={data.indicators.MACD} isStatus valueColor={data.indicators.MACD === 'bullish' ? 'text-green-400' : 'text-red-400'} />
                        <MetricRow label="Bollinger Bands" value={data.indicators.bollingerPosition.replace('_', ' ')} isStatus valueColor="text-primary-300" />
                        <div className="p-3 bg-white/5 rounded-lg">
                            <span className="text-xs text-gray-500 block mb-2 uppercase font-bold tracking-widest">Candlestick Patterns</span>
                            <div className="flex flex-wrap gap-2">
                                {data.candlestickPatterns.length > 0 ? data.candlestickPatterns.map((p, i) => (
                                    <span key={i} className="px-2 py-1 bg-white/10 rounded text-xs font-medium text-white">{p}</span>
                                )) : <span className="text-gray-500 text-sm italic">No significant patterns</span>}
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
                            <span className="text-[10px] text-purple-300 uppercase font-black tracking-widest">Overall Alignment</span>
                            <div className="text-xl font-bold capitalize mt-1 text-white">{data.technicalPatterns.alignment}</div>
                        </div>
                    </div>
                </div>

                {/* Market Context */}
                <div className="glass rounded-2xl p-6 border border-white/5">
                    <h3 className="text-lg font-bold mb-4 flex items-center gap-2 text-yellow-300">
                        <Globe size={20} /> Market Context
                    </h3>
                    <div className="mb-6">
                        <div className="flex justify-between items-center mb-3">
                            <span className="text-[10px] text-gray-500 uppercase font-black tracking-widest">News Sentiment</span>
                            <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${data.news.sentiment === 'positive' ? 'bg-green-500/20 text-green-400' : data.news.sentiment === 'negative' ? 'bg-red-500/20 text-red-400' : 'bg-gray-500/20 text-gray-400'}`}>
                                {data.news.sentiment} ({data.news.sentimentScore}%)
                            </span>
                        </div>
                        <div className="space-y-2">
                            {data.news.latestHeadlines.slice(0, 2).map((h, i) => (
                                <p key={i} className="text-xs text-gray-300 line-clamp-2 pl-2 border-l-2 border-white/10 italic">"{h}"</p>
                            ))}
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div className="p-3 bg-white/5 rounded-lg border border-white/5">
                            <span className="text-[10px] text-gray-500 block uppercase font-black tracking-widest mb-1">Valuation</span>
                            <span className="font-bold capitalize text-primary-200">{data.fundamentals.valuation}</span>
                        </div>
                        <div className="p-3 bg-white/5 rounded-lg border border-white/5">
                            <span className="text-[10px] text-gray-500 block uppercase font-black tracking-widest mb-1">Growth</span>
                            <span className="font-bold capitalize text-green-200">{data.fundamentals.growth}</span>
                        </div>
                        <div className="p-3 bg-white/5 rounded-lg col-span-2 border border-white/5">
                            <span className="text-[10px] text-gray-500 block uppercase font-black tracking-widest mb-1">P/E Ratio</span>
                            <span className="font-bold text-white">{data.fundamentals.peRatio || 'N/A'}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Risks */}
            <div className="glass rounded-2xl p-6 border border-white/5">
                <h3 className="text-lg font-bold mb-4 flex items-center gap-2 text-red-400">
                    <Activity size={20} /> Risk Assessment
                </h3>
                <div className="flex flex-wrap gap-3">
                    {data.risks.map((risk, i) => (
                        <span key={i} className="px-4 py-2 bg-red-500/5 border border-red-500/10 rounded-xl text-sm text-red-200/70">
                            • {risk}
                        </span>
                    ))}
                </div>
            </div>
        </div>
    );
}

// Sub-components
function ScoreBar({ label, value }: { label: string, value: number }) {
    return (
        <div>
            <div className="flex justify-between mb-1.5 ">
                <span className="text-sm font-medium text-gray-400">{label}</span>
                <span className="text-sm font-bold text-white">{value}%</span>
            </div>
            <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                <div
                    className={`h-full rounded-full transition-all duration-1000 ${value >= 70 ? 'bg-green-500' : value >= 40 ? 'bg-yellow-500' : 'bg-red-500'}`}
                    style={{ width: `${value}%` }}
                />
            </div>
        </div>
    );
}

function MetricRow({ label, value, subValue, isStatus, valueColor }: any) {
    return (
        <div className="flex justify-between items-center p-3 bg-white/5 rounded-lg border border-white/5">
            <span className="text-xs text-gray-500 uppercase font-black tracking-widest">{label}</span>
            <div className="text-right">
                <span className={`font-bold text-lg ${isStatus ? 'capitalize' : ''} ${valueColor || 'text-white'}`}>{value}</span>
                {subValue && <span className="text-[10px] block text-gray-500 uppercase font-bold tracking-tight">{subValue}</span>}
            </div>
        </div>
    );
}

function TimeframeRow({ label, patterns }: { label: string, patterns: string[] }) {
    return (
        <div className="p-3 bg-white/5 rounded-lg border border-white/5">
            <div className="text-[10px] text-gray-500 mb-1 uppercase font-black tracking-widest">{label}</div>
            <div className="text-sm font-bold text-white">
                {patterns && patterns.length > 0 ? patterns.join(', ') : <span className="text-gray-600 italic font-normal">No significant patterns</span>}
            </div>
        </div>
    );
}

function ScenarioCard({ title, scenario, type, isPrimary }: any) {
    if (!scenario) return null;
    const isBullish = type === 'bullish';
    const Icon = isBullish ? TrendingUp : TrendingDown;
    const colorClass = isBullish ? 'green' : 'red';

    return (
        <div className={`rounded-3xl p-6 border transition-all hover:scale-[1.01] relative overflow-hidden ${isBullish
                ? 'border-green-500/20 bg-green-500/5'
                : 'border-red-500/20 bg-red-500/5'
            }`}>
            {isPrimary && (
                <div className={`absolute top-0 right-0 px-4 py-1 bg-${colorClass}-500 text-white text-[10px] font-black tracking-widest uppercase rounded-bl-2xl shadow-xl z-20`}>
                    Primary Signal
                </div>
            )}

            <div className="flex items-center gap-4 mb-6">
                <div className={`p-3 rounded-2xl bg-${colorClass}-500/10 border border-${colorClass}-500/20`}>
                    <Icon className={`text-${colorClass}-400`} size={24} />
                </div>
                <div>
                    <h3 className="text-2xl font-black text-white">{title}</h3>
                    <div className="flex items-center gap-2">
                        <span className={`text-${colorClass}-500 font-bold`}>{scenario.probability}% Probability</span>
                        <div className="w-1.5 h-1.5 rounded-full bg-white/20" />
                        <span className="text-gray-500 text-xs font-medium uppercase tracking-widest">{scenario.timeHorizon}</span>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="p-4 bg-black/40 rounded-2xl border border-white/5">
                    <span className="text-[10px] text-gray-500 block mb-1 uppercase font-black tracking-widest">Buy Zone</span>
                    <span className="font-bold text-white tracking-tight">₹{scenario.tradePlan?.entry?.[0]} - ₹{scenario.tradePlan?.entry?.[1]}</span>
                </div>
                <div className="p-4 bg-black/40 rounded-2xl border border-white/5">
                    <span className="text-[10px] text-gray-500 block mb-1 uppercase font-black tracking-widest">Safety Stop</span>
                    <div className="flex items-center justify-between">
                        <span className="font-bold text-red-400">₹{scenario.tradePlan?.stopLoss}</span>
                        <span className="text-[10px] bg-red-500/10 text-red-500 px-1.5 rounded">{scenario.tradePlan?.stopLossPercent}%</span>
                    </div>
                </div>
            </div>

            <div className="p-5 bg-black/60 rounded-2xl border border-white/5 space-y-4">
                <span className="text-[10px] text-gray-500 block uppercase font-black tracking-widest">Profit Targets</span>
                <div className="space-y-3">
                    {scenario.tradePlan?.targets?.map((t: any, i: number) => (
                        <div key={i} className="flex justify-between items-center group/target">
                            <span className="text-gray-400 font-bold text-xs uppercase">Target {i + 1}</span>
                            <div className="flex items-center gap-4">
                                <span className="text-xl font-bold text-white group-hover/target:text-primary-400 transition-colors">₹{t.price}</span>
                                <span className="text-[10px] bg-white/5 text-gray-500 px-2 py-0.5 rounded font-black">{t.probability}%</span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <div className="mt-4 flex items-center justify-between px-2 text-[10px] font-black uppercase text-gray-600 tracking-widest">
                <span>Risk Reward: 1:{scenario.tradePlan?.riskReward}</span>
                <span>Signal Quality: {scenario.score}/100</span>
            </div>
        </div>
    );
}
