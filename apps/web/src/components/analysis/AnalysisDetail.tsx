'use client';

/**
 * AnalysisDetail — Main analysis display component.
 * Shows executive summary, chart, signal card, scenarios, indicators, and risks.
 * @module @stock-assist/web/components/analysis/AnalysisDetail
 */

import { useState, useMemo } from 'react';
import {
    Activity, BarChart2, Globe, Zap, TrendingUp, TrendingDown,
    AlertCircle, CheckCircle2, MoreHorizontal, Star, Copy, Check,
    Shield, Target, Crosshair,
} from 'lucide-react';
import { useWatchlist } from '@/context/WatchlistContext';
import { useChartData } from '@/hooks/useChartData';
import { StockChart } from '@/components/chart/StockChart';
import { CONFIDENCE, RECOMMENDATION_STYLES, CHART_COLORS } from '@/constants';
import type { AnalysisData, ChartMarker, PriceProjection } from '@/types';

// Re-export for backward compatibility
export type { AnalysisData } from '@/types';

// ═══════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════

function getConfidenceColor(score: number): string {
    if (score >= CONFIDENCE.HIGH) return 'text-emerald-500';
    if (score >= CONFIDENCE.MEDIUM) return 'text-amber-500';
    return 'text-rose-500';
}

function getSignalStyle(signal: string): string {
    return RECOMMENDATION_STYLES[signal as keyof typeof RECOMMENDATION_STYLES] || 'bg-zinc-700 text-zinc-300';
}

/** Build chart price level markers from analysis data */
function buildChartMarkers(data: AnalysisData): ChartMarker[] {
    const markers: ChartMarker[] = [];

    // Entry zone from signal card
    if (data.signalCard?.entryZone) {
        const ez = data.signalCard.entryZone;
        markers.push(
            { price: ez.entryZoneLow, label: 'Entry', color: CHART_COLORS.ENTRY_ZONE, lineStyle: 'dashed' },
            { price: ez.entryZoneHigh, label: '', color: CHART_COLORS.ENTRY_ZONE, lineStyle: 'dashed' },
            { price: ez.stopLoss, label: 'SL', color: CHART_COLORS.STOP_LOSS, lineStyle: 'solid' },
            { price: ez.target1, label: 'T1', color: CHART_COLORS.TARGET_1, lineStyle: 'dashed' },
            { price: ez.target2, label: 'T2', color: CHART_COLORS.TARGET_2, lineStyle: 'dashed' },
        );
    }

    // Price targets from analysis
    if (data.priceTargets) {
        const pt = data.priceTargets;
        if (pt.stopLoss && !data.signalCard?.entryZone) {
            markers.push({ price: pt.stopLoss, label: 'SL', color: CHART_COLORS.STOP_LOSS, lineStyle: 'solid' });
        }
        if (pt.target1 && !data.signalCard?.entryZone) {
            markers.push({ price: pt.target1, label: 'T1', color: CHART_COLORS.TARGET_1, lineStyle: 'dashed' });
        }
        if (pt.target2 && !data.signalCard?.entryZone) {
            markers.push({ price: pt.target2, label: 'T2', color: CHART_COLORS.TARGET_2, lineStyle: 'dashed' });
        }
    }

    return markers;
}

// ═══════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════

interface AnalysisDetailProps {
    data: AnalysisData;
}

export function AnalysisDetail({ data }: AnalysisDetailProps) {
    const { isFollowing, toggleFollow } = useWatchlist();
    const followed = isFollowing(data.stock);
    const [copied, setCopied] = useState(false);

    // Chart data hook
    const { data: chartData, range, setRange, isLoading: chartLoading } = useChartData({
        symbol: data.stock,
        enabled: !!data.stock,
    });

    // Memoize chart markers to avoid recalculating on every render
    const chartMarkers = useMemo(() => buildChartMarkers(data), [data]);

    // Build future price projections from bullish/bearish scenarios
    const chartProjections = useMemo((): PriceProjection[] => {
        const projections: PriceProjection[] = [];
        if (!data.currentPrice) return projections;

        // Parse time horizon to days (e.g., "1-2 weeks" → 10, "3-5 days" → 4)
        const parseDays = (horizon: string): number => {
            const lower = (horizon || '').toLowerCase();
            const nums = lower.match(/\d+/g);
            if (!nums) return 10;
            const avg = nums.reduce((a, b) => a + Number(b), 0) / nums.length;
            if (lower.includes('week')) return Math.round(avg * 5);
            if (lower.includes('month')) return Math.round(avg * 22);
            return Math.round(avg); // days
        };

        // Bullish scenario
        if (data.bullish?.tradePlan?.targets?.length > 0) {
            const t1 = Number(data.bullish.tradePlan.targets[0]?.price || 0);
            if (t1 > 0) {
                projections.push({
                    label: 'Bull Target',
                    targetPrice: t1,
                    probability: data.bullish.probability || 50,
                    type: 'bullish',
                    daysAhead: parseDays(data.bullish.timeHorizon),
                });
            }
        }

        // Bearish scenario
        if (data.bearish?.tradePlan?.targets?.length > 0) {
            const t1 = Number(data.bearish.tradePlan.targets[0]?.price || 0);
            if (t1 > 0) {
                projections.push({
                    label: 'Bear Target',
                    targetPrice: t1,
                    probability: data.bearish.probability || 50,
                    type: 'bearish',
                    daysAhead: parseDays(data.bearish.timeHorizon),
                });
            }
        }

        return projections;
    }, [data]);

    return (
        <div className="space-y-6 max-w-6xl mx-auto">
            {/* Phase 1: Pre-Move Signal Card */}
            {data.signalCard && <SignalCardDisplay card={data.signalCard} />}

            {/* Executive Summary */}
            <div className="border border-border bg-zinc-950/50 p-5 md:p-8 rounded-xl relative overflow-hidden">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 md:gap-8 relative z-10">
                    <div className="w-full md:w-auto">
                        <div className="flex items-center justify-between md:justify-start gap-4 mb-2">
                            <div className="flex items-center gap-3">
                                <h2 className="text-2xl md:text-4xl font-bold tracking-tight text-foreground">{data.stock}</h2>
                                <button
                                    onClick={() => toggleFollow(data.stock)}
                                    className={`p-2 rounded-lg border transition-all ${followed ? 'bg-amber-500/10 border-amber-500/20 text-amber-500' : 'bg-zinc-900 border-border text-zinc-500 hover:text-foreground'}`}
                                >
                                    <Star size={18} className="md:w-5 md:h-5" fill={followed ? 'currentColor' : 'none'} />
                                </button>
                            </div>
                            <div className={`px-3 py-1 rounded text-[10px] md:text-xs font-bold uppercase tracking-[0.1em] ${getSignalStyle(data.recommendation)}`}>
                                {data.recommendation}
                            </div>
                        </div>
                        <div className="flex items-center gap-6 mt-4">
                            <div className="space-y-0.5">
                                <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest">Price</p>
                                <p className="text-xl md:text-2xl font-bold text-foreground">₹{data.currentPrice}</p>
                            </div>
                            <div className="h-8 md:h-10 w-px bg-border" />
                            <div className="space-y-0.5">
                                <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest">Confidence</p>
                                <p className={`text-xl md:text-2xl font-bold ${getConfidenceColor(data.confidenceScore)}`}>
                                    {data.confidenceScore}<span className="text-xs md:text-sm text-muted-foreground">/100</span>
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="bg-zinc-900 border border-border p-4 md:p-6 rounded-lg w-full md:min-w-[240px] md:w-auto">
                        <p className="text-[10px] text-muted-foreground uppercase font-black tracking-widest mb-3 md:mb-4">Signal Integrity</p>
                        <div className="space-y-3">
                            <IntegrityRow label="Chart Alignment" value={data.confidenceBreakdown.technicalAlignment} />
                            <IntegrityRow label="News Sentiment" value={data.confidenceBreakdown.newsSentiment} />
                            <IntegrityRow label="Volume Confirmation" value={data.confidenceBreakdown.volumeConfirmation} />
                        </div>
                    </div>
                </div>
            </div>

            {/* Price Chart */}
            {chartData.length > 0 && (
                <StockChart
                    data={chartData}
                    symbol={data.stock}
                    range={range}
                    onRangeChange={setRange}
                    loading={chartLoading}
                    markers={chartMarkers}
                    projections={chartProjections}
                />
            )}
            {chartLoading && chartData.length === 0 && (
                <div className="border border-border rounded-xl bg-zinc-950 flex items-center justify-center" style={{ height: 420 }}>
                    <div className="flex items-center gap-3">
                        <div className="w-5 h-5 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
                        <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Loading chart...</span>
                    </div>
                </div>
            )}

            {/* Strategic Scenarios */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <ScenarioPanel title="BULLISH THESIS" scenario={data.bullish} type="bullish" active={data.recommendation === 'BUY'} />
                <ScenarioPanel title="BEARISH THESIS" scenario={data.bearish} type="bearish" active={data.recommendation === 'SELL'} />
            </div>

            {/* Data Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Technical Analysis */}
                <Section title="TECHNICAL INDICATORS" icon={<BarChart2 size={16} />}>
                    <div className="space-y-4">
                        <DataRow label="RSI (14)" value={data.indicators.RSI.toFixed(1)} meta={data.indicators.RSIInterpretation} />
                        <DataRow label="MACD" value={data.indicators.MACD} statusIndicator />
                        <DataRow label="Bollinger" value={data.indicators.bollingerPosition.replace('_', ' ')} />
                        <div className="pt-2">
                            <p className="text-[9px] text-muted-foreground uppercase font-bold tracking-widest mb-2">Candlestick Patterns</p>
                            {data.candlestickAnalysis && data.candlestickAnalysis.patterns.length > 0 ? (
                                <>
                                    <div className="flex flex-wrap gap-2 mb-3">
                                        {data.candlestickAnalysis.patterns.map((p, i) => (
                                            <span
                                                key={i}
                                                title={p.description}
                                                className={`px-2 py-1 text-[10px] font-bold rounded border uppercase cursor-help transition-colors ${
                                                    p.type === 'bullish'
                                                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                                        : p.type === 'bearish'
                                                            ? 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                                                            : 'bg-zinc-800 text-zinc-300 border-zinc-700'
                                                }`}
                                            >
                                                {p.name} · {p.strength}
                                            </span>
                                        ))}
                                    </div>
                                    {(data.candlestickAnalysis.bullishCount > 0 || data.candlestickAnalysis.bearishCount > 0) && (
                                        <div className="mb-2">
                                            <div className="flex h-1.5 rounded-full overflow-hidden bg-zinc-800">
                                                {data.candlestickAnalysis.bullishCount > 0 && (
                                                    <div
                                                        className="bg-emerald-500 transition-all"
                                                        style={{ width: `${(data.candlestickAnalysis.bullishCount / (data.candlestickAnalysis.bullishCount + data.candlestickAnalysis.bearishCount)) * 100}%` }}
                                                    />
                                                )}
                                                {data.candlestickAnalysis.bearishCount > 0 && (
                                                    <div
                                                        className="bg-rose-500 transition-all"
                                                        style={{ width: `${(data.candlestickAnalysis.bearishCount / (data.candlestickAnalysis.bullishCount + data.candlestickAnalysis.bearishCount)) * 100}%` }}
                                                    />
                                                )}
                                            </div>
                                        </div>
                                    )}
                                    <p className="text-[9px] text-muted-foreground">{data.candlestickAnalysis.summary}</p>
                                </>
                            ) : data.candlestickPatterns.length > 0 ? (
                                <div className="flex flex-wrap gap-2">
                                    {data.candlestickPatterns.map((p, i) => (
                                        <span key={i} className="px-2 py-0.5 bg-zinc-800 text-zinc-100 text-[10px] font-bold rounded border border-zinc-700 uppercase">{p}</span>
                                    ))}
                                </div>
                            ) : (
                                <span className="text-[10px] text-muted-foreground">No significant candlestick patterns detected</span>
                            )}
                        </div>
                    </div>
                </Section>

                {/* Temporal Alignment */}
                <Section title="TEMPORAL ALIGNMENT" icon={<Zap size={16} />}>
                    <div className="space-y-4">
                        <TemporalRow label="Intraday (1D)" patterns={data.technicalPatterns['1D']} />
                        <TemporalRow label="Medium Term (1W)" patterns={data.technicalPatterns['1W']} />
                        <TemporalRow label="Long Term (1M)" patterns={data.technicalPatterns['1M']} />
                        <div className="mt-4 p-4 border border-primary-500/20 bg-primary-500/5 rounded-lg">
                            <p className="text-[9px] text-primary-500 uppercase font-black tracking-widest leading-none mb-1">Structural Bias</p>
                            <p className="text-lg font-bold text-foreground capitalize">{data.technicalPatterns.alignment}</p>
                        </div>
                    </div>
                </Section>

                {/* Market Intelligence */}
                <Section title="MARKET INTELLIGENCE" icon={<Globe size={16} />}>
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <div className="flex justify-between items-center">
                                <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">Sentiment</p>
                                <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${
                                    data.news.sentiment === 'positive' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'
                                }`}>
                                    {data.news.sentiment} ({data.news.sentimentScore}%)
                                </span>
                            </div>
                            <div className="space-y-2">
                                {data.news.latestHeadlines.slice(0, 2).map((h, i) => (
                                    <p key={i} className="text-[10px] text-muted-foreground italic line-clamp-2 border-l border-zinc-800 pl-3 leading-relaxed">
                                        &quot;{h}&quot;
                                    </p>
                                ))}
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3 pt-2">
                            <div className="p-3 bg-zinc-900 border border-border rounded">
                                <p className="text-[8px] text-muted-foreground uppercase font-bold tracking-widest mb-1">Growth</p>
                                <p className="text-xs font-bold text-foreground capitalize">{data.fundamentals.growth}</p>
                            </div>
                            <div className="p-3 bg-zinc-900 border border-border rounded">
                                <p className="text-[8px] text-muted-foreground uppercase font-bold tracking-widest mb-1">Valuation</p>
                                <p className="text-xs font-bold text-foreground capitalize">{data.fundamentals.valuation}</p>
                            </div>
                        </div>
                    </div>
                </Section>
            </div>

            {/* Risk Management */}
            <div className="border border-zinc-800 bg-zinc-950/20 p-6 rounded-lg">
                <div className="flex items-center gap-2 mb-4">
                    <AlertCircle className="text-rose-500" size={16} />
                    <h3 className="text-xs font-bold text-foreground uppercase tracking-widest">Critical Risk Factors</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {data.risks.map((risk, i) => (
                        <div key={i} className="flex gap-3 text-xs text-muted-foreground bg-zinc-900/50 p-3 rounded border border-border">
                            <div className="w-1 h-1 rounded-full bg-rose-500 mt-1.5 shrink-0" />
                            {risk}
                        </div>
                    ))}
                </div>
            </div>

            {/* Copy AI Prompt Section */}
            {data.rawPrompt && (
                <div className="border border-zinc-800 bg-zinc-950/30 rounded-xl overflow-hidden">
                    <div className="px-5 py-4 flex items-center justify-between bg-zinc-900/30">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-violet-500/10 border border-violet-500/20">
                                <Copy size={16} className="text-violet-400" />
                            </div>
                            <div>
                                <h3 className="text-xs font-bold text-foreground uppercase tracking-widest">AI Prompt Data</h3>
                                <p className="text-[10px] text-muted-foreground mt-0.5">Copy & paste into ChatGPT, Claude, or any AI</p>
                            </div>
                        </div>
                        <button
                            onClick={() => {
                                navigator.clipboard.writeText(data.rawPrompt || '');
                                setCopied(true);
                                setTimeout(() => setCopied(false), 2000);
                            }}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-xs tracking-wide transition-all active:scale-95 ${
                                copied
                                    ? 'bg-emerald-500/20 border border-emerald-500/30 text-emerald-400'
                                    : 'bg-violet-600 hover:bg-violet-500 text-white shadow-lg shadow-violet-600/20'
                            }`}
                        >
                            {copied ? (
                                <><Check size={14} /><span>COPIED!</span></>
                            ) : (
                                <><Copy size={14} /><span>COPY PROMPT</span></>
                            )}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════
// SIGNAL CARD COMPONENT
// ═══════════════════════════════════════════════════════════════

function SignalCardDisplay({ card }: { card: NonNullable<AnalysisData['signalCard']> }) {
    const isActive = card.status === 'SETUP_ACTIVE';
    const isWaiting = card.status === 'WAITING_FOR_ENTRY';
    const isNoSetup = card.status === 'NO_SETUP';
    const isBullish = card.direction === 'bullish';

    const statusConfig = {
        SETUP_ACTIVE: {
            label: 'SETUP ACTIVE',
            className: 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400',
            pulse: true,
        },
        WAITING_FOR_ENTRY: {
            label: 'WAITING FOR ENTRY',
            className: 'bg-amber-500/15 border-amber-500/30 text-amber-400',
            pulse: false,
        },
        NO_SETUP: {
            label: 'NO SETUP',
            className: 'bg-zinc-800/50 border-zinc-700/30 text-zinc-500',
            pulse: false,
        },
    };

    const status = statusConfig[card.status];

    const convictionColor = card.convictionScore >= 70
        ? 'bg-emerald-500'
        : card.convictionScore >= 55
            ? 'bg-amber-500'
            : 'bg-zinc-600';

    const cardBorderClass = isActive
        ? (isBullish
            ? 'border-emerald-500/30 bg-gradient-to-br from-emerald-500/[0.03] to-zinc-950'
            : 'border-rose-500/30 bg-gradient-to-br from-rose-500/[0.03] to-zinc-950')
        : isWaiting
            ? 'border-amber-500/20 bg-zinc-950/60'
            : 'border-zinc-800/60 bg-zinc-950/30';

    const headerBorderClass = isNoSetup
        ? 'border-zinc-800/50 bg-zinc-900/20'
        : isBullish
            ? 'border-emerald-500/10 bg-emerald-500/[0.02]'
            : 'border-rose-500/10 bg-rose-500/[0.02]';

    return (
        <div id="signal-card" className={`border-2 rounded-xl overflow-hidden transition-all ${cardBorderClass}`}>
            {/* Header */}
            <div className={`px-5 py-4 flex items-center justify-between border-b ${headerBorderClass}`}>
                <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                        isNoSetup ? 'bg-zinc-800/60 text-zinc-500'
                            : isBullish ? 'bg-emerald-500/15 text-emerald-400'
                                : 'bg-rose-500/15 text-rose-400'
                    }`}>
                        {isNoSetup ? <Shield size={18} /> : isBullish ? <TrendingUp size={18} /> : <TrendingDown size={18} />}
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h3 className="text-xs font-black text-foreground uppercase tracking-widest">Pre-Move Signal</h3>
                            <span className={`text-[9px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full border ${status.className} ${status.pulse ? 'animate-pulse' : ''}`}>
                                {status.label}
                            </span>
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                            Smart Money Concepts · {card.smcSummary.trendState.charAt(0).toUpperCase() + card.smcSummary.trendState.slice(1)}
                        </p>
                    </div>
                </div>

                {card.direction !== 'none' && (
                    <span className={`text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-lg border ${
                        isBullish
                            ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                            : 'bg-rose-500/10 border-rose-500/20 text-rose-400'
                    }`}>
                        {card.direction}
                    </span>
                )}
            </div>

            {/* Body */}
            <div className="p-5">
                {/* Conviction Score Bar */}
                <div className="mb-5">
                    <div className="flex justify-between items-center mb-2">
                        <span className="text-[9px] text-muted-foreground uppercase font-black tracking-widest">Conviction Score</span>
                        <span className={`text-lg font-black ${
                            card.convictionScore >= 70 ? 'text-emerald-400'
                                : card.convictionScore >= 55 ? 'text-amber-400'
                                    : 'text-zinc-500'
                        }`}>
                            {card.convictionScore}<span className="text-xs text-muted-foreground font-normal">/100</span>
                        </span>
                    </div>
                    <div className="h-2 bg-zinc-800/60 rounded-full overflow-hidden">
                        <div
                            className={`h-full rounded-full transition-all duration-700 ease-out ${convictionColor}`}
                            style={{ width: `${card.convictionScore}%` }}
                        />
                    </div>
                </div>

                {/* Trade Levels Grid */}
                {card.entryZone && !isNoSetup && (
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-5">
                        <div className="p-3 bg-zinc-900/60 border border-zinc-800/50 rounded-lg">
                            <div className="flex items-center gap-1.5 mb-1">
                                <Crosshair size={11} className="text-primary-500" />
                                <p className="text-[8px] text-muted-foreground uppercase font-black tracking-widest">Entry Zone</p>
                            </div>
                            <p className="text-sm font-bold text-foreground">
                                ₹{card.entryZone.entryZoneLow.toLocaleString()} – ₹{card.entryZone.entryZoneHigh.toLocaleString()}
                            </p>
                            <p className="text-[9px] text-muted-foreground mt-0.5">via {card.entryZone.entryTrigger}</p>
                        </div>

                        <div className="p-3 bg-rose-500/[0.04] border border-rose-500/10 rounded-lg">
                            <div className="flex items-center gap-1.5 mb-1">
                                <AlertCircle size={11} className="text-rose-500" />
                                <p className="text-[8px] text-rose-400/80 uppercase font-black tracking-widest">Stop Loss</p>
                            </div>
                            <p className="text-sm font-bold text-rose-400">₹{card.entryZone.stopLoss.toLocaleString()}</p>
                        </div>

                        <div className="p-3 bg-emerald-500/[0.04] border border-emerald-500/10 rounded-lg">
                            <div className="flex items-center gap-1.5 mb-1">
                                <Target size={11} className="text-emerald-500" />
                                <p className="text-[8px] text-emerald-400/80 uppercase font-black tracking-widest">Target 1</p>
                            </div>
                            <p className="text-sm font-bold text-emerald-400">₹{card.entryZone.target1.toLocaleString()}</p>
                        </div>

                        <div className="p-3 bg-emerald-500/[0.03] border border-emerald-500/10 rounded-lg">
                            <div className="flex items-center gap-1.5 mb-1">
                                <Target size={11} className="text-emerald-400" />
                                <p className="text-[8px] text-emerald-400/60 uppercase font-black tracking-widest">Target 2</p>
                            </div>
                            <p className="text-sm font-bold text-emerald-300">₹{card.entryZone.target2.toLocaleString()}</p>
                        </div>

                        <div className="p-3 bg-zinc-900/60 border border-zinc-800/50 rounded-lg">
                            <p className="text-[8px] text-muted-foreground uppercase font-black tracking-widest mb-1">Risk : Reward</p>
                            <p className={`text-sm font-bold ${card.entryZone.riskReward >= 2 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                1 : {card.entryZone.riskReward}
                            </p>
                        </div>

                        <div className="p-3 bg-zinc-900/60 border border-zinc-800/50 rounded-lg">
                            <p className="text-[8px] text-muted-foreground uppercase font-black tracking-widest mb-1">MTF Score</p>
                            <p className={`text-sm font-bold ${card.mtfAlignment.alignmentValid ? 'text-foreground' : 'text-zinc-500'}`}>
                                {card.mtfAlignment.alignmentScore}%
                            </p>
                        </div>
                    </div>
                )}

                {/* Why This Setup */}
                {card.explanation.length > 0 && (
                    <div className={`p-4 rounded-lg border ${isNoSetup ? 'bg-zinc-900/20 border-zinc-800/30' : 'bg-zinc-900/40 border-zinc-800/40'}`}>
                        <p className="text-[9px] text-muted-foreground uppercase font-black tracking-widest mb-3">
                            {isNoSetup ? 'Why No Setup' : 'Why This Setup'}
                        </p>
                        <div className="space-y-1.5">
                            {card.explanation.map((line, i) => (
                                <p key={i} className={`text-[11px] leading-relaxed ${isNoSetup ? 'text-zinc-500' : 'text-zinc-300'}`}>
                                    {line}
                                </p>
                            ))}
                        </div>
                    </div>
                )}

                {isNoSetup && (
                    <div className="mt-3 text-center">
                        <p className="text-[10px] text-zinc-600 italic">
                            Market conditions don&apos;t meet the 1:2 R:R or 55 conviction threshold — patience is discipline
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════
// INTERNAL UI COMPONENTS
// ═══════════════════════════════════════════════════════════════

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
    return (
        <div className="border border-border bg-zinc-950/50 rounded-xl overflow-hidden flex flex-col h-full">
            <div className="px-5 py-4 border-b border-border flex items-center justify-between bg-zinc-900/30">
                <div className="flex items-center gap-2">
                    {icon}
                    <h3 className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">{title}</h3>
                </div>
                <MoreHorizontal size={14} className="text-zinc-600" />
            </div>
            <div className="p-5 flex-grow">
                {children}
            </div>
        </div>
    );
}

function IntegrityRow({ label, value }: { label: string; value: number }) {
    return (
        <div className="space-y-1">
            <div className="flex justify-between text-[10px] font-bold">
                <span className="text-zinc-500">{label}</span>
                <span className="text-foreground">{value}%</span>
            </div>
            <div className="h-1 bg-zinc-800 rounded-full overflow-hidden">
                <div className="h-full bg-primary-600 rounded-full" style={{ width: `${value}%` }} />
            </div>
        </div>
    );
}

function DataRow({ label, value, meta, statusIndicator }: { label: string; value: string; meta?: string; statusIndicator?: boolean }) {
    return (
        <div className="flex justify-between items-center py-2 border-b border-zinc-800/50 last:border-0 border-dashed">
            <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">{label}</span>
            <div className="text-right">
                <span className={`text-sm font-bold block ${statusIndicator ? (value === 'bullish' ? 'text-emerald-500' : 'text-rose-500') : 'text-foreground'} capitalize`}>
                    {value}
                </span>
                {meta && <span className="text-[9px] text-muted-foreground font-semibold uppercase">{meta}</span>}
            </div>
        </div>
    );
}

function TemporalRow({ label, patterns }: { label: string; patterns: string[] }) {
    return (
        <div className="py-2.5 border-b border-zinc-800/50 last:border-0">
            <p className="text-[9px] text-muted-foreground font-bold uppercase tracking-widest mb-1">{label}</p>
            <p className="text-xs font-bold text-foreground">
                {patterns && patterns.length > 0 ? patterns.join(', ') : <span className="text-zinc-600 italic font-normal">Stable Action</span>}
            </p>
        </div>
    );
}

function ScenarioPanel({ title, scenario, type, active }: { title: string; scenario: any; type: 'bullish' | 'bearish'; active: boolean }) {
    if (!scenario) return null;
    const isBullish = type === 'bullish';
    const accent = isBullish ? 'emerald' : 'rose';

    return (
        <div className={`border-2 rounded-xl p-4 md:p-6 transition-all h-full flex flex-col ${
            active
                ? `border-${accent}-500/30 bg-${accent}-500/[0.03]`
                : 'border-zinc-800 bg-zinc-950/20'
        }`}>
            <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${active ? `bg-${accent}-500 text-white` : 'bg-zinc-800 text-zinc-400'}`}>
                        {isBullish ? <TrendingUp size={18} /> : <TrendingDown size={18} />}
                    </div>
                    <div>
                        <h4 className="text-sm font-black uppercase tracking-widest text-foreground">{title}</h4>
                        <p className={`text-xs font-bold ${active ? `text-${accent}-500` : 'text-muted-foreground'}`}>{scenario.probability}% Probable Strategy</p>
                    </div>
                </div>
                {active && (
                    <div className="px-2 py-0.5 border border-emerald-500 text-emerald-500 text-[8px] font-black uppercase rounded">Target Execution</div>
                )}
            </div>

            <div className="grid grid-cols-2 gap-4 mb-6">
                <MetricBox label="Entry Zone" value={`₹${scenario.tradePlan?.entry?.[0]} - ₹${scenario.tradePlan?.entry?.[1]}`} highlight />
                <MetricBox label="Stop Loss" value={`₹${scenario.tradePlan?.stopLoss}`} color="rose" />
            </div>

            <div className="space-y-2 mb-6">
                <p className="text-[9px] text-muted-foreground uppercase font-black tracking-widest px-1">Profit Objectives</p>
                <div className="grid grid-cols-1 gap-2">
                    {scenario.tradePlan?.targets?.map((t: any, i: number) => (
                        <div key={i} className="flex justify-between items-center p-3 bg-zinc-900 border border-border rounded">
                            <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Objective {i + 1}</span>
                            <div className="flex items-center gap-4">
                                <span className="text-lg font-bold text-foreground">₹{t.price}</span>
                                <span className="text-[9px] bg-emerald-500/10 text-emerald-500 px-1.5 py-0.5 rounded font-bold">{t.probability}%</span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <div className="mt-auto flex items-center justify-between text-[10px] font-bold text-muted-foreground uppercase tracking-tighter px-1">
                <div className="flex items-center gap-1.5"><CheckCircle2 size={12} className="text-zinc-600" /> Reward Ratio: 1:{scenario.tradePlan?.riskReward}</div>
                <div className="flex items-center gap-1.5"><CheckCircle2 size={12} className="text-zinc-600" /> Horizon: {scenario.timeHorizon}</div>
            </div>
        </div>
    );
}

function MetricBox({ label, value, highlight, color }: { label: string; value: string; highlight?: boolean; color?: string }) {
    return (
        <div className={`p-4 rounded border ${highlight ? 'bg-primary-500/5 border-primary-500/20' : 'bg-zinc-900 border-border'}`}>
            <p className="text-[9px] text-muted-foreground uppercase font-black tracking-widest mb-1.5">{label}</p>
            <p className={`text-md font-bold ${color === 'rose' ? 'text-rose-500' : 'text-foreground'}`}>{value}</p>
        </div>
    );
}
