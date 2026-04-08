'use client';

/**
 * AnalysisDetail — Trading-first analysis display.
 * Layout: Hero Strip → Chart (dominant) → Quick Indicators → Scenarios → Deep Detail
 * @module @stock-assist/web/components/analysis/AnalysisDetail
 */

import { useState, useMemo } from 'react';
import {
    TrendingUp, TrendingDown, Star, Copy, Check,
    AlertTriangle, Target, Crosshair, Shield, ChevronDown,
    BarChart2, Globe, Zap, Activity, Bell, BookOpen,
} from 'lucide-react';
import { toast } from 'sonner';
import { useWatchlist } from '@/context/WatchlistContext';
import { useChartData } from '@/hooks/useChartData';
import { StockChart } from '@/components/chart/StockChart';
import { CONFIDENCE, CHART_COLORS } from '@/constants';
import type { AnalysisData, ChartMarker, PriceProjection } from '@/types';

export type { AnalysisData } from '@/types';

// ═══════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════

function getConfidenceColor(score: number): string {
    if (score >= CONFIDENCE.HIGH) return 'text-emerald-400';
    if (score >= CONFIDENCE.MEDIUM) return 'text-amber-400';
    return 'text-rose-400';
}

function getConfidenceBg(score: number): string {
    if (score >= CONFIDENCE.HIGH) return 'bg-emerald-500';
    if (score >= CONFIDENCE.MEDIUM) return 'bg-amber-500';
    return 'bg-rose-500';
}

function getSignalBadge(signal: string): { bg: string; text: string; glow: string } {
    switch (signal) {
        case 'BUY': return { bg: 'bg-emerald-500', text: 'text-white', glow: 'shadow-emerald-500/30' };
        case 'SELL': return { bg: 'bg-rose-500', text: 'text-white', glow: 'shadow-rose-500/30' };
        case 'HOLD': return { bg: 'bg-amber-500', text: 'text-white', glow: 'shadow-amber-500/30' };
        default: return { bg: 'bg-zinc-700', text: 'text-zinc-300', glow: '' };
    }
}

function getRRColor(rr: number): string {
    if (rr >= 2.0) return 'text-emerald-400';
    if (rr >= 1.0) return 'text-amber-400';
    return 'text-rose-400';
}

function buildChartMarkers(data: AnalysisData): ChartMarker[] {
    const markers: ChartMarker[] = [];
    if (data.signalCard?.entryZone) {
        const ez = data.signalCard.entryZone;
        markers.push(
            { price: ez.entryZoneLow, label: 'Entry', color: CHART_COLORS.ENTRY_ZONE, lineStyle: 'dashed' },
            { price: ez.entryZoneHigh, label: '', color: CHART_COLORS.ENTRY_ZONE, lineStyle: 'dashed' },
            { price: ez.stopLoss, label: 'SL', color: CHART_COLORS.STOP_LOSS, lineStyle: 'solid' },
            { price: ez.target1, label: 'T1', color: CHART_COLORS.TARGET_1, lineStyle: 'dashed' },
            { price: ez.target2, label: 'T2', color: CHART_COLORS.TARGET_2, lineStyle: 'dashed' },
        );
    } else if (data.priceTargets) {
        const pt = data.priceTargets;
        if (pt.stopLoss) markers.push({ price: pt.stopLoss, label: 'SL', color: CHART_COLORS.STOP_LOSS, lineStyle: 'solid' });
        if (pt.target1) markers.push({ price: pt.target1, label: 'T1', color: CHART_COLORS.TARGET_1, lineStyle: 'dashed' });
        if (pt.target2) markers.push({ price: pt.target2, label: 'T2', color: CHART_COLORS.TARGET_2, lineStyle: 'dashed' });
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
    const [detailOpen, setDetailOpen] = useState(false);

    const { data: chartData, range, setRange, isLoading: chartLoading } = useChartData({
        symbol: data.stock,
        enabled: !!data.stock,
    });

    const chartMarkers = useMemo(() => buildChartMarkers(data), [data]);

    const chartProjections = useMemo((): PriceProjection[] => {
        const projections: PriceProjection[] = [];
        if (!data.currentPrice) return projections;
        const parseDays = (horizon: string): number => {
            const lower = (horizon || '').toLowerCase();
            const nums = lower.match(/\d+/g);
            if (!nums) return 10;
            const avg = nums.reduce((a, b) => a + Number(b), 0) / nums.length;
            if (lower.includes('week')) return Math.round(avg * 5);
            if (lower.includes('month')) return Math.round(avg * 22);
            return Math.round(avg);
        };
        if (data.bullish?.tradePlan?.targets?.length > 0) {
            const t1 = Number(data.bullish.tradePlan.targets[0]?.price || 0);
            if (t1 > 0) projections.push({ label: 'Bull Target', targetPrice: t1, probability: data.bullish.probability || 50, type: 'bullish', daysAhead: parseDays(data.bullish.timeHorizon) });
        }
        if (data.bearish?.tradePlan?.targets?.length > 0) {
            const t1 = Number(data.bearish.tradePlan.targets[0]?.price || 0);
            if (t1 > 0) projections.push({ label: 'Bear Target', targetPrice: t1, probability: data.bearish.probability || 50, type: 'bearish', daysAhead: parseDays(data.bearish.timeHorizon) });
        }
        return projections;
    }, [data]);

    const signalCard = data.signalCard;
    const isNoSetup = signalCard?.status === 'NO_SETUP';
    const isActive = signalCard?.status === 'SETUP_ACTIVE';
    const isBullish = signalCard?.direction === 'bullish';
    const conviction = signalCard?.convictionScore ?? 0;
    const entryZone = signalCard?.entryZone;
    const rr = entryZone?.riskReward ?? 0;
    const badge = getSignalBadge(data.recommendation);

    // Determine border glow for the entire result
    const outerGlow = isActive
        ? (isBullish ? 'border-emerald-500/40 shadow-lg shadow-emerald-500/10' : 'border-rose-500/40 shadow-lg shadow-rose-500/10')
        : isNoSetup
            ? 'border-rose-500/20'
            : 'border-border';

    return (
        <div className={`space-y-0 rounded-2xl border-2 overflow-hidden ${outerGlow} bg-zinc-950`}>

            {/* ═══════════ SECTION 1: HERO STRIP ═══════════ */}
            <div className="px-4 py-3 md:px-6 md:py-4 bg-zinc-900/80 border-b border-zinc-800">
                <div className="flex items-center justify-between gap-3">
                    {/* Left: Symbol + Price + Signal */}
                    <div className="flex items-center gap-3 md:gap-4 min-w-0">
                        <div>
                            <div className="flex items-center gap-2">
                                <h2 className="text-xl md:text-2xl font-black tracking-tight text-foreground">{data.stock}</h2>
                                <span className={`px-2.5 py-0.5 rounded text-[10px] md:text-xs font-black uppercase tracking-wider shadow-lg ${badge.bg} ${badge.text} ${badge.glow}`}>
                                    {data.recommendation}
                                </span>
                            </div>
                            <p className="text-lg md:text-xl font-bold text-foreground mt-0.5">
                                ₹{data.currentPrice?.toLocaleString()}
                            </p>
                        </div>
                    </div>

                    {/* Center: Confidence meter */}
                    <div className="hidden md:flex items-center gap-4">
                        <div className="text-center">
                            <p className="text-[9px] text-muted-foreground uppercase font-bold tracking-widest mb-1">Confidence</p>
                            <p className={`text-2xl font-black ${getConfidenceColor(data.confidenceScore)}`}>
                                {data.confidenceScore}<span className="text-sm text-muted-foreground">/100</span>
                            </p>
                        </div>
                        <div className="h-10 w-px bg-zinc-800" />
                        <div className="text-center">
                            <p className="text-[9px] text-muted-foreground uppercase font-bold tracking-widest mb-1">Conviction</p>
                            <p className={`text-2xl font-black ${conviction >= 70 ? 'text-emerald-400' : conviction >= 55 ? 'text-amber-400' : 'text-zinc-500'}`}>
                                {conviction}<span className="text-sm text-muted-foreground">/100</span>
                            </p>
                        </div>
                    </div>

                    {/* Right: Action buttons */}
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => toggleFollow(data.stock)}
                            className={`p-2 rounded-lg border transition-all ${followed ? 'bg-amber-500/10 border-amber-500/30 text-amber-400' : 'bg-zinc-900 border-zinc-700 text-zinc-500 hover:text-foreground'}`}
                            title="Watchlist"
                        >
                            <Star size={16} fill={followed ? 'currentColor' : 'none'} />
                        </button>
                        <button
                            onClick={() => toast.info('Paper trading coming soon')}
                            className="p-2 rounded-lg border bg-zinc-900 border-zinc-700 text-zinc-500 hover:text-foreground transition-all"
                            title="Paper Trade"
                        >
                            <BookOpen size={16} />
                        </button>
                        <button
                            onClick={() => toast.info('Alerts coming soon')}
                            className="p-2 rounded-lg border bg-zinc-900 border-zinc-700 text-zinc-500 hover:text-foreground transition-all"
                            title="Set Alert"
                        >
                            <Bell size={16} />
                        </button>
                    </div>
                </div>

                {/* Mobile: Confidence + Conviction inline */}
                <div className="flex md:hidden items-center gap-4 mt-3 pt-3 border-t border-zinc-800/50">
                    <div className="flex-1">
                        <p className="text-[9px] text-muted-foreground uppercase font-bold tracking-widest">Confidence</p>
                        <div className="flex items-center gap-2 mt-1">
                            <div className="flex-1 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                                <div className={`h-full rounded-full ${getConfidenceBg(data.confidenceScore)}`} style={{ width: `${data.confidenceScore}%` }} />
                            </div>
                            <span className={`text-sm font-black ${getConfidenceColor(data.confidenceScore)}`}>{data.confidenceScore}</span>
                        </div>
                    </div>
                    <div className="w-px h-8 bg-zinc-800" />
                    <div className="flex-1">
                        <p className="text-[9px] text-muted-foreground uppercase font-bold tracking-widest">Conviction</p>
                        <div className="flex items-center gap-2 mt-1">
                            <div className="flex-1 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                                <div className={`h-full rounded-full ${conviction >= 70 ? 'bg-emerald-500' : conviction >= 55 ? 'bg-amber-500' : 'bg-zinc-600'}`} style={{ width: `${conviction}%` }} />
                            </div>
                            <span className={`text-sm font-black ${conviction >= 70 ? 'text-emerald-400' : conviction >= 55 ? 'text-amber-400' : 'text-zinc-500'}`}>{conviction}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* ═══════════ SECTION 2: SETUP STATUS BAR ═══════════ */}
            {signalCard && (
                <SetupStatusBar
                    status={signalCard.status}
                    direction={signalCard.direction}
                    conviction={conviction}
                    rr={rr}
                    explanation={signalCard.explanation}
                    smcSummary={signalCard.smcSummary}
                />
            )}

            {/* ═══════════ SECTION 3: TRADE LEVELS (if active setup) ═══════════ */}
            {entryZone && !isNoSetup && (
                <div className="px-4 md:px-6 py-3 bg-zinc-950 border-b border-zinc-800/50">
                    <div className="grid grid-cols-3 md:grid-cols-6 gap-2 md:gap-3">
                        <LevelPill label="Entry" value={`₹${entryZone.entryZoneLow.toLocaleString()} - ${entryZone.entryZoneHigh.toLocaleString()}`} color="primary" />
                        <LevelPill label="Stop Loss" value={`₹${entryZone.stopLoss.toLocaleString()}`} color="rose" />
                        <LevelPill label="Target 1" value={`₹${entryZone.target1.toLocaleString()}`} color="emerald" />
                        <LevelPill label="Target 2" value={`₹${entryZone.target2.toLocaleString()}`} color="emerald" />
                        <LevelPill label="R:R" value={`1:${rr}`} color={rr >= 2 ? 'emerald' : rr >= 1 ? 'amber' : 'rose'} />
                        <LevelPill label="MTF Score" value={`${signalCard!.mtfAlignment.alignmentScore}%`} color={signalCard!.mtfAlignment.alignmentValid ? 'primary' : 'zinc'} />
                    </div>
                </div>
            )}

            {/* ═══════════ SECTION 4: CHART (DOMINANT) ═══════════ */}
            <div className="border-b border-zinc-800/50">
                {chartData.length > 0 ? (
                    <StockChart
                        data={chartData}
                        symbol={data.stock}
                        range={range}
                        onRangeChange={setRange}
                        loading={chartLoading}
                        markers={chartMarkers}
                        projections={chartProjections}
                    />
                ) : chartLoading ? (
                    <div className="flex items-center justify-center bg-zinc-950" style={{ height: 480 }}>
                        <div className="flex items-center gap-3">
                            <div className="w-5 h-5 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
                            <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Loading chart...</span>
                        </div>
                    </div>
                ) : null}
            </div>

            {/* ═══════════ SECTION 5: QUICK INDICATOR STRIP ═══════════ */}
            <div className="px-4 md:px-6 py-3 bg-zinc-900/40 border-b border-zinc-800/50">
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                    <QuickIndicator
                        label="RSI (14)"
                        value={data.indicators.RSI.toFixed(1)}
                        status={data.indicators.RSIInterpretation}
                        color={data.indicators.RSI > 70 ? 'rose' : data.indicators.RSI < 30 ? 'emerald' : 'zinc'}
                    />
                    <QuickIndicator
                        label="MACD"
                        value={data.indicators.MACD}
                        color={data.indicators.MACD === 'bullish' ? 'emerald' : data.indicators.MACD === 'bearish' ? 'rose' : 'zinc'}
                    />
                    <QuickIndicator
                        label="Volume"
                        value={data.indicators.volumeTrend}
                        color={data.indicators.volumeTrend === 'above_average' ? 'emerald' : 'zinc'}
                    />
                    <QuickIndicator
                        label="Bollinger"
                        value={data.indicators.bollingerPosition.replace('_', ' ')}
                        color="zinc"
                    />
                    <QuickIndicator
                        label="Alignment"
                        value={data.technicalPatterns.alignment}
                        color={data.technicalPatterns.alignment === 'bullish' ? 'emerald' : data.technicalPatterns.alignment === 'bearish' ? 'rose' : 'zinc'}
                    />
                </div>
            </div>

            {/* ═══════════ SECTION 6: PROBABILITY + RISK STRIP ═══════════ */}
            <div className="px-4 md:px-6 py-4 border-b border-zinc-800/50">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Bullish Card */}
                    <ProbabilityCard
                        type="bullish"
                        probability={data.bullish?.probability ?? 0}
                        targets={data.bullish?.tradePlan?.targets ?? []}
                        rr={data.bullish?.tradePlan?.riskReward}
                        horizon={data.bullish?.timeHorizon ?? ''}
                        entry={data.bullish?.tradePlan?.entry}
                        stopLoss={data.bullish?.tradePlan?.stopLoss}
                        active={data.recommendation === 'BUY'}
                    />
                    {/* Bearish Card */}
                    <ProbabilityCard
                        type="bearish"
                        probability={data.bearish?.probability ?? 0}
                        targets={data.bearish?.tradePlan?.targets ?? []}
                        rr={data.bearish?.tradePlan?.riskReward}
                        horizon={data.bearish?.timeHorizon ?? ''}
                        entry={data.bearish?.tradePlan?.entry}
                        stopLoss={data.bearish?.tradePlan?.stopLoss}
                        active={data.recommendation === 'SELL'}
                    />
                </div>
            </div>

            {/* ═══════════ SECTION 7: RISK FACTORS ═══════════ */}
            {data.risks.length > 0 && (
                <div className="px-4 md:px-6 py-4 border-b border-zinc-800/50 bg-rose-500/[0.02]">
                    <div className="flex items-center gap-2 mb-3">
                        <AlertTriangle size={14} className="text-rose-400" />
                        <h3 className="text-[10px] font-black text-rose-400 uppercase tracking-widest">Risk Factors</h3>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {data.risks.map((risk, i) => (
                            <div key={i} className="flex gap-2 text-xs text-zinc-400 bg-zinc-900/50 px-3 py-2 rounded border border-rose-500/10">
                                <div className="w-1 h-1 rounded-full bg-rose-500 mt-1.5 shrink-0" />
                                {risk}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* ═══════════ SECTION 8: COLLAPSIBLE DEEP DETAIL ═══════════ */}
            <div className="px-4 md:px-6">
                <button
                    onClick={() => setDetailOpen(!detailOpen)}
                    className="w-full py-3 flex items-center justify-between text-muted-foreground hover:text-foreground transition-colors"
                >
                    <span className="text-[10px] font-black uppercase tracking-widest">
                        {detailOpen ? 'Hide' : 'Show'} Deep Analysis
                    </span>
                    <ChevronDown size={16} className={`transition-transform duration-300 ${detailOpen ? 'rotate-180' : ''}`} />
                </button>
            </div>

            {detailOpen && (
                <div className="px-4 md:px-6 pb-6 space-y-6 animate-in fade-in slide-in-from-top-2 duration-300">
                    {/* Signal Integrity */}
                    <div>
                        <h4 className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-3 flex items-center gap-2">
                            <Shield size={12} /> Signal Integrity
                        </h4>
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                            <IntegrityPill label="Chart Alignment" value={data.confidenceBreakdown.technicalAlignment} />
                            <IntegrityPill label="Pattern Strength" value={data.confidenceBreakdown.patternStrength} />
                            <IntegrityPill label="Volume Confirm" value={data.confidenceBreakdown.volumeConfirmation} />
                            <IntegrityPill label="News Sentiment" value={data.confidenceBreakdown.newsSentiment} />
                            <IntegrityPill label="Fundamentals" value={data.confidenceBreakdown.fundamentalStrength} />
                        </div>
                    </div>

                    {/* Technical Indicators Full */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {/* Indicators */}
                        <DetailSection title="Technical Indicators" icon={<BarChart2 size={14} />}>
                            <div className="space-y-2">
                                <DetailRow label="RSI (14)" value={data.indicators.RSI.toFixed(1)} meta={data.indicators.RSIInterpretation} />
                                <DetailRow label="MACD" value={data.indicators.MACD} />
                                <DetailRow label="Volume" value={data.indicators.volumeTrend.replace('_', ' ')} />
                                <DetailRow label="Bollinger" value={data.indicators.bollingerPosition.replace('_', ' ')} />
                            </div>
                            {/* Candlestick patterns */}
                            {data.candlestickAnalysis && data.candlestickAnalysis.patterns.length > 0 && (
                                <div className="mt-3 pt-3 border-t border-zinc-800/50">
                                    <p className="text-[9px] text-muted-foreground uppercase font-bold tracking-widest mb-2">Candlestick</p>
                                    <div className="flex flex-wrap gap-1.5">
                                        {data.candlestickAnalysis.patterns.map((p, i) => (
                                            <span key={i} title={p.description} className={`px-2 py-0.5 text-[9px] font-bold rounded border cursor-help ${
                                                p.type === 'bullish' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                                    : p.type === 'bearish' ? 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                                                    : 'bg-zinc-800 text-zinc-400 border-zinc-700'
                                            }`}>
                                                {p.name}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </DetailSection>

                        {/* Temporal Alignment */}
                        <DetailSection title="Temporal Alignment" icon={<Zap size={14} />}>
                            <div className="space-y-3">
                                <TimeframeRow label="Daily (1D)" patterns={data.technicalPatterns['1D']} />
                                <TimeframeRow label="Weekly (1W)" patterns={data.technicalPatterns['1W']} />
                                <TimeframeRow label="Monthly (1M)" patterns={data.technicalPatterns['1M']} />
                                <div className="mt-2 p-2.5 border border-primary-500/20 bg-primary-500/5 rounded-lg">
                                    <p className="text-[9px] text-primary-400 uppercase font-black tracking-widest mb-0.5">Structural Bias</p>
                                    <p className="text-sm font-bold text-foreground capitalize">{data.technicalPatterns.alignment}</p>
                                </div>
                            </div>
                        </DetailSection>

                        {/* Market Intelligence */}
                        <DetailSection title="Market Intelligence" icon={<Globe size={14} />}>
                            <div className="space-y-3">
                                <div className="flex justify-between items-center">
                                    <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">Sentiment</p>
                                    <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${
                                        data.news.sentiment === 'positive' ? 'bg-emerald-500/10 text-emerald-400' : data.news.sentiment === 'negative' ? 'bg-rose-500/10 text-rose-400' : 'bg-zinc-800 text-zinc-400'
                                    }`}>
                                        {data.news.sentiment} ({data.news.sentimentScore}%)
                                    </span>
                                </div>
                                {data.news.latestHeadlines.slice(0, 2).map((h, i) => (
                                    <p key={i} className="text-[10px] text-muted-foreground italic line-clamp-2 border-l-2 border-zinc-700 pl-3 leading-relaxed">
                                        &quot;{h}&quot;
                                    </p>
                                ))}
                                <div className="grid grid-cols-2 gap-2 pt-1">
                                    <div className="p-2.5 bg-zinc-900/60 border border-zinc-800 rounded">
                                        <p className="text-[8px] text-muted-foreground uppercase font-bold tracking-widest mb-0.5">Growth</p>
                                        <p className="text-xs font-bold text-foreground capitalize">{data.fundamentals.growth}</p>
                                    </div>
                                    <div className="p-2.5 bg-zinc-900/60 border border-zinc-800 rounded">
                                        <p className="text-[8px] text-muted-foreground uppercase font-bold tracking-widest mb-0.5">Valuation</p>
                                        <p className="text-xs font-bold text-foreground capitalize">{data.fundamentals.valuation}</p>
                                    </div>
                                </div>
                            </div>
                        </DetailSection>
                    </div>

                    {/* SMC Summary (if signal card exists) */}
                    {signalCard && (
                        <div>
                            <h4 className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-3 flex items-center gap-2">
                                <Activity size={12} /> Smart Money Concepts
                            </h4>
                            <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                                <SMCBadge label="Order Blocks" count={signalCard.smcSummary.unmitigatedOBCount} active={signalCard.smcSummary.unmitigatedOBCount > 0} />
                                <SMCBadge label="FVGs" count={signalCard.smcSummary.unfilledFVGCount} active={signalCard.smcSummary.unfilledFVGCount > 0} />
                                <SMCBadge label="CHoCH" count={signalCard.smcSummary.chochDetected ? 1 : 0} active={signalCard.smcSummary.chochDetected} />
                                <SMCBadge label="Liq. Sweep" count={signalCard.smcSummary.sweepDetected ? 1 : 0} active={signalCard.smcSummary.sweepDetected} />
                                <SMCBadge label="Trend" count={0} active={false} text={signalCard.smcSummary.trendState} />
                            </div>
                        </div>
                    )}

                    {/* Copy AI Prompt */}
                    {data.rawPrompt && (
                        <div className="flex items-center justify-between p-4 bg-zinc-900/40 border border-zinc-800 rounded-xl">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-violet-500/10 border border-violet-500/20">
                                    <Copy size={14} className="text-violet-400" />
                                </div>
                                <div>
                                    <p className="text-xs font-bold text-foreground">AI Prompt Data</p>
                                    <p className="text-[10px] text-muted-foreground">Copy for ChatGPT, Claude, or any AI</p>
                                </div>
                            </div>
                            <button
                                onClick={() => {
                                    navigator.clipboard.writeText(data.rawPrompt || '');
                                    setCopied(true);
                                    toast.success('Prompt copied to clipboard');
                                    setTimeout(() => setCopied(false), 2000);
                                }}
                                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-xs tracking-wide transition-all active:scale-95 ${
                                    copied
                                        ? 'bg-emerald-500/20 border border-emerald-500/30 text-emerald-400'
                                        : 'bg-violet-600 hover:bg-violet-500 text-white shadow-lg shadow-violet-600/20'
                                }`}
                            >
                                {copied ? <><Check size={14} /><span>COPIED</span></> : <><Copy size={14} /><span>COPY</span></>}
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════
// SUB-COMPONENTS
// ═══════════════════════════════════════════════════════════════

function SetupStatusBar({ status, direction, conviction, rr, explanation, smcSummary }: {
    status: 'SETUP_ACTIVE' | 'WAITING_FOR_ENTRY' | 'NO_SETUP';
    direction: 'bullish' | 'bearish' | 'none';
    conviction: number;
    rr: number;
    explanation: string[];
    smcSummary: { trendState: string };
}) {
    const config = {
        SETUP_ACTIVE: { label: 'SETUP ACTIVE', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', text: 'text-emerald-400', dot: 'bg-emerald-500' },
        WAITING_FOR_ENTRY: { label: 'WAITING', bg: 'bg-amber-500/10', border: 'border-amber-500/30', text: 'text-amber-400', dot: 'bg-amber-500' },
        NO_SETUP: { label: 'NO SETUP', bg: 'bg-rose-500/5', border: 'border-rose-500/20', text: 'text-rose-400', dot: 'bg-rose-500' },
    }[status];

    return (
        <div className={`px-4 md:px-6 py-2.5 border-b flex flex-wrap items-center gap-3 md:gap-4 ${config.bg} ${config.border}`}>
            {/* Status badge */}
            <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[10px] font-black uppercase tracking-wider ${config.border} ${config.text}`}>
                <div className={`w-1.5 h-1.5 rounded-full ${config.dot} ${status === 'SETUP_ACTIVE' ? 'animate-pulse' : ''}`} />
                {config.label}
            </div>

            {/* Direction */}
            {direction !== 'none' && (
                <span className={`text-[10px] font-black uppercase tracking-wider ${direction === 'bullish' ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {direction === 'bullish' ? <TrendingUp size={12} className="inline mr-1" /> : <TrendingDown size={12} className="inline mr-1" />}
                    {direction}
                </span>
            )}

            {/* SMC Trend */}
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
                SMC: {smcSummary.trendState}
            </span>

            {/* R:R warning */}
            {rr > 0 && rr < 1.0 && (
                <span className="text-[10px] font-black uppercase tracking-wider text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/20">
                    R:R {rr} &lt; 1.0
                </span>
            )}

            {/* Top explanation line */}
            {explanation.length > 0 && (
                <span className="text-[10px] text-muted-foreground truncate max-w-xs hidden md:inline">
                    {explanation[0]}
                </span>
            )}
        </div>
    );
}

function LevelPill({ label, value, color }: { label: string; value: string; color: string }) {
    const colorMap: Record<string, string> = {
        primary: 'border-primary-500/20 bg-primary-500/5 text-foreground',
        emerald: 'border-emerald-500/20 bg-emerald-500/5 text-emerald-400',
        rose: 'border-rose-500/20 bg-rose-500/5 text-rose-400',
        amber: 'border-amber-500/20 bg-amber-500/5 text-amber-400',
        zinc: 'border-zinc-700 bg-zinc-900/50 text-zinc-400',
    };
    return (
        <div className={`px-3 py-2 rounded-lg border text-center ${colorMap[color] || colorMap.zinc}`}>
            <p className="text-[8px] uppercase font-bold tracking-widest text-muted-foreground mb-0.5">{label}</p>
            <p className="text-xs font-bold truncate">{value}</p>
        </div>
    );
}

function QuickIndicator({ label, value, status, color }: { label: string; value: string; status?: string; color: string }) {
    const colorMap: Record<string, string> = {
        emerald: 'text-emerald-400',
        rose: 'text-rose-400',
        amber: 'text-amber-400',
        zinc: 'text-foreground',
    };
    return (
        <div className="flex items-center justify-between py-1.5 px-3 bg-zinc-900/60 rounded-lg border border-zinc-800/50">
            <span className="text-[9px] text-muted-foreground uppercase font-bold tracking-wider">{label}</span>
            <div className="text-right">
                <span className={`text-xs font-bold capitalize ${colorMap[color] || colorMap.zinc}`}>{value}</span>
                {status && <span className="text-[8px] text-muted-foreground uppercase block">{status}</span>}
            </div>
        </div>
    );
}

function ProbabilityCard({ type, probability, targets, rr, horizon, entry, stopLoss, active }: {
    type: 'bullish' | 'bearish'; probability: number; targets: any[]; rr?: number | string; horizon: string;
    entry?: (string | number)[]; stopLoss?: string | number; active: boolean;
}) {
    const isBull = type === 'bullish';
    const accent = isBull ? 'emerald' : 'rose';

    return (
        <div className={`rounded-xl border-2 p-4 transition-all ${
            active ? `border-${accent}-500/30 bg-${accent}-500/[0.03]` : 'border-zinc-800/50 bg-zinc-950/30'
        }`}>
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${active ? `bg-${accent}-500 text-white` : 'bg-zinc-800 text-zinc-500'}`}>
                        {isBull ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                    </div>
                    <div>
                        <p className="text-xs font-black uppercase tracking-widest text-foreground">{isBull ? 'Bullish' : 'Bearish'}</p>
                        <p className={`text-[10px] font-bold ${active ? `text-${accent}-400` : 'text-muted-foreground'}`}>{probability}% probable</p>
                    </div>
                </div>
                {active && <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded border border-${accent}-500/30 text-${accent}-400`}>Active</span>}
            </div>

            {/* Compact targets */}
            <div className="space-y-1.5">
                {entry && (
                    <div className="flex justify-between text-[10px]">
                        <span className="text-muted-foreground font-bold uppercase tracking-wider">Entry</span>
                        <span className="font-bold text-foreground">₹{entry[0]} - ₹{entry[1]}</span>
                    </div>
                )}
                {targets.map((t: any, i: number) => (
                    <div key={i} className="flex justify-between text-[10px]">
                        <span className="text-muted-foreground font-bold uppercase tracking-wider">Target {i + 1}</span>
                        <div className="flex items-center gap-2">
                            <span className="font-bold text-foreground">₹{t.price}</span>
                            <span className={`text-[8px] px-1.5 py-0.5 rounded font-bold bg-${accent}-500/10 text-${accent}-400`}>{t.probability}%</span>
                        </div>
                    </div>
                ))}
                {stopLoss && (
                    <div className="flex justify-between text-[10px]">
                        <span className="text-muted-foreground font-bold uppercase tracking-wider">Stop Loss</span>
                        <span className="font-bold text-rose-400">₹{stopLoss}</span>
                    </div>
                )}
            </div>

            <div className="flex items-center justify-between mt-3 pt-2 border-t border-zinc-800/50 text-[9px] text-muted-foreground font-bold uppercase tracking-wider">
                <span>R:R 1:{rr}</span>
                <span>{horizon}</span>
            </div>
        </div>
    );
}

function IntegrityPill({ label, value }: { label: string; value: number }) {
    const color = value >= 70 ? 'emerald' : value >= 50 ? 'amber' : 'rose';
    return (
        <div className="p-2.5 bg-zinc-900/60 border border-zinc-800 rounded-lg">
            <div className="flex justify-between items-center mb-1.5">
                <span className="text-[8px] text-muted-foreground uppercase font-bold tracking-widest">{label}</span>
                <span className={`text-xs font-black text-${color}-400`}>{value}%</span>
            </div>
            <div className="h-1 bg-zinc-800 rounded-full overflow-hidden">
                <div className={`h-full rounded-full bg-${color}-500`} style={{ width: `${value}%` }} />
            </div>
        </div>
    );
}

function DetailSection({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
    return (
        <div className="border border-zinc-800 bg-zinc-900/20 rounded-xl overflow-hidden">
            <div className="px-4 py-2.5 border-b border-zinc-800/50 flex items-center gap-2 bg-zinc-900/40">
                {icon}
                <h4 className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">{title}</h4>
            </div>
            <div className="p-4">{children}</div>
        </div>
    );
}

function DetailRow({ label, value, meta }: { label: string; value: string; meta?: string }) {
    return (
        <div className="flex justify-between items-center py-1.5 border-b border-zinc-800/30 last:border-0">
            <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">{label}</span>
            <div className="text-right">
                <span className="text-xs font-bold text-foreground capitalize">{value}</span>
                {meta && <span className="text-[8px] text-muted-foreground font-bold uppercase block">{meta}</span>}
            </div>
        </div>
    );
}

function TimeframeRow({ label, patterns }: { label: string; patterns: string[] }) {
    return (
        <div className="py-1.5 border-b border-zinc-800/30 last:border-0">
            <p className="text-[9px] text-muted-foreground font-bold uppercase tracking-widest mb-0.5">{label}</p>
            <p className="text-xs font-bold text-foreground">
                {patterns && patterns.length > 0 ? patterns.join(', ') : <span className="text-zinc-600 italic font-normal">Stable</span>}
            </p>
        </div>
    );
}

function SMCBadge({ label, count, active, text }: { label: string; count: number; active: boolean; text?: string }) {
    return (
        <div className={`px-3 py-2 rounded-lg border text-center ${active ? 'border-primary-500/20 bg-primary-500/5' : 'border-zinc-800 bg-zinc-900/40'}`}>
            <p className="text-[8px] uppercase font-bold tracking-widest text-muted-foreground mb-0.5">{label}</p>
            {text ? (
                <p className="text-xs font-bold text-foreground capitalize">{text}</p>
            ) : (
                <p className={`text-sm font-black ${active ? 'text-primary-400' : 'text-zinc-600'}`}>{count}</p>
            )}
        </div>
    );
}
