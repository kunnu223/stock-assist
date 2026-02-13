'use client';

import { useState } from 'react';
import {
    TrendingUp, TrendingDown, Shield, AlertTriangle, CheckCircle2,
    DollarSign, Calendar, BarChart2, Target, Clock, ChevronRight,
    Zap, Activity, ArrowUpRight, ArrowDownRight, Minus,
    ShieldAlert, ShieldCheck, CircleDot, ArrowUp, ArrowDown
} from 'lucide-react';

interface CommodityResultProps {
    data: any;
    accentColor: string;
}

export function CommodityResult({ data, accentColor }: CommodityResultProps) {
    const [horizon, setHorizon] = useState<'today' | 'tomorrow' | 'nextWeek'>('today');

    const isPositive = data.changePercent >= 0;
    const isBullish = data.direction === 'BULLISH';
    const curr = data.exchangePricing?.currencySymbol || '$';
    const exchangeLabel = data.exchangePricing?.label || 'COMEX (US)';
    const exchangeUnit = data.exchangePricing?.unit || '';
    const usdInr = data.exchangePricing?.usdInr || 0;
    const isINR = data.exchangePricing?.currency === 'INR';

    const getConfColor = (score: number) => {
        if (score >= 75) return 'text-emerald-400';
        if (score >= 55) return 'text-amber-400';
        return 'text-rose-400';
    };

    const getRecColor = (rec: string) => {
        if (rec === 'BUY') return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20';
        if (rec === 'SELL') return 'bg-rose-500/15 text-rose-400 border-rose-500/20';
        if (rec === 'HOLD') return 'bg-amber-500/15 text-amber-400 border-amber-500/20';
        return 'bg-zinc-800/50 text-zinc-400 border-zinc-700/30';
    };

    const getRiskColor = (risk: string) => {
        if (risk === 'LOW') return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
        if (risk === 'MODERATE') return 'text-blue-400 bg-blue-500/10 border-blue-500/20';
        if (risk === 'ELEVATED') return 'text-amber-400 bg-amber-500/10 border-amber-500/20';
        if (risk === 'HIGH') return 'text-orange-400 bg-orange-500/10 border-orange-500/20';
        return 'text-rose-400 bg-rose-500/10 border-rose-500/20';
    };

    return (
        <div className="space-y-4 sm:space-y-6">
            {/* ── Summary Header ── */}
            <div className="premium-card rounded-xl p-4 sm:p-6 lg:p-8 bg-zinc-950/50 border-border">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                    {/* Left: Price + Direction */}
                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-6">
                        <div className="flex-1">
                            <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-2">
                                <h2 className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight">{data.name}</h2>
                                <span className={`inline-flex items-center gap-1 px-2.5 sm:px-3 py-1 rounded-full text-[9px] sm:text-[10px] font-black uppercase tracking-wider border ${getRecColor(data.recommendation)}`}>
                                    {data.recommendation === 'BUY' ? <ArrowUpRight size={10} /> : data.recommendation === 'SELL' ? <ArrowDownRight size={10} /> : <Minus size={10} />}
                                    {data.recommendation}
                                </span>
                            </div>
                            <div className="flex flex-wrap items-baseline gap-3 sm:gap-4">
                                <span className="text-3xl sm:text-4xl font-bold text-foreground">{curr}{isINR ? Math.round(data.currentPrice).toLocaleString('en-IN') : data.currentPrice.toFixed(2)}</span>
                                <span className={`text-base sm:text-lg font-bold ${isPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
                                    {isPositive ? '+' : ''}{data.changePercent.toFixed(2)}%
                                </span>
                            </div>
                            <div className="flex flex-wrap items-center gap-2 mt-2">
                                <span className={`inline-flex items-center gap-1 px-2 sm:px-2.5 py-0.5 rounded-full text-[8px] sm:text-[9px] font-black uppercase tracking-wider border ${isINR ? 'text-orange-400 bg-orange-500/10 border-orange-500/20' : 'text-blue-400 bg-blue-500/10 border-blue-500/20'}`}>
                                    {exchangeLabel}
                                </span>
                                {exchangeUnit && <span className="text-[8px] sm:text-[9px] text-muted-foreground font-bold uppercase tracking-widest">{exchangeUnit}</span>}
                                {usdInr > 0 && <span className="text-[8px] sm:text-[9px] text-muted-foreground font-bold">• USD/INR: ₹{usdInr.toFixed(2)}</span>}
                            </div>
                            <p className="text-[9px] sm:text-[10px] text-muted-foreground font-bold uppercase tracking-widest mt-1">
                                {data.category} futures • {data.metadata?.aiModel || 'Smart'} analysis
                            </p>
                        </div>
                    </div>

                    {/* Right: Confidence + Direction */}
                    <div className="flex items-center gap-4 sm:gap-6 lg:gap-8 justify-center lg:justify-end">
                        {/* Confidence Ring */}
                        <div className="relative w-20 h-20 sm:w-24 sm:h-24">
                            <svg className="w-20 h-20 sm:w-24 sm:h-24 -rotate-90" viewBox="0 0 100 100">
                                <circle cx="50" cy="50" r="42" stroke="currentColor" className="text-zinc-800" strokeWidth="6" fill="none" />
                                <circle
                                    cx="50" cy="50" r="42"
                                    stroke="currentColor"
                                    className={getConfColor(data.confidence)}
                                    strokeWidth="6"
                                    fill="none"
                                    strokeDasharray={`${(data.confidence / 100) * 264} 264`}
                                    strokeLinecap="round"
                                    style={{ transition: 'stroke-dasharray 1.5s ease-out' }}
                                />
                            </svg>
                            <div className="absolute inset-0 flex flex-col items-center justify-center">
                                <span className={`text-xl sm:text-2xl font-black ${getConfColor(data.confidence)}`}>{data.confidence}</span>
                                <span className="text-[7px] sm:text-[8px] text-muted-foreground font-bold uppercase tracking-widest">CONF</span>
                            </div>
                        </div>

                        {/* Direction Badge */}
                        <div className={`flex flex-col items-center gap-1 px-4 sm:px-6 py-2 sm:py-3 rounded-xl border ${isBullish ? 'bg-emerald-500/10 border-emerald-500/20' : data.direction === 'BEARISH' ? 'bg-rose-500/10 border-rose-500/20' : 'bg-zinc-800/50 border-zinc-700'}`}>
                            {isBullish ? <TrendingUp size={24} className="text-emerald-400 sm:w-7 sm:h-7" /> : data.direction === 'BEARISH' ? <TrendingDown size={24} className="text-rose-400 sm:w-7 sm:h-7" /> : <Minus size={24} className="text-zinc-400 sm:w-7 sm:h-7" />}
                            <span className={`text-[9px] sm:text-[10px] font-black uppercase tracking-widest ${isBullish ? 'text-emerald-400' : data.direction === 'BEARISH' ? 'text-rose-400' : 'text-zinc-400'}`}>
                                {data.direction}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Summary text */}
                {data.summary && (
                    <p className="mt-4 sm:mt-6 text-xs sm:text-sm text-muted-foreground font-medium leading-relaxed border-t border-border pt-4 sm:pt-6 italic">
                        &quot;{data.summary}&quot;
                    </p>
                )}
            </div>

            {/* ── Main Grid ── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* ── Multi-Horizon Plan ── */}
                <div className="premium-card rounded-xl bg-zinc-950/50 border-border lg:col-span-2">
                    <div className="p-6 border-b border-border">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center">
                                    <Target size={16} className="text-amber-400" />
                                </div>
                                <div>
                                    <h3 className="text-sm font-bold text-foreground uppercase tracking-wider">Multi-Horizon Plan</h3>
                                    <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">Intelligent Trading Actions</p>
                                </div>
                            </div>
                            <div className="flex gap-1 bg-zinc-900 rounded-lg p-1 overflow-x-auto no-scrollbar">
                                {(['today', 'tomorrow', 'nextWeek'] as const).map((h) => (
                                    <button
                                        key={h}
                                        onClick={() => setHorizon(h)}
                                        className={`flex-1 sm:flex-none whitespace-nowrap px-3 sm:px-4 py-1.5 sm:py-2 rounded-md text-[9px] sm:text-[10px] font-black uppercase tracking-wider sm:tracking-widest transition-all ${horizon === h
                                            ? 'bg-amber-500/20 text-amber-400 shadow-sm'
                                            : 'text-muted-foreground hover:text-foreground'
                                            }`}
                                    >
                                        {h === 'today' ? '📍 Today' : h === 'tomorrow' ? '📅 Tomorrow' : '📆 Next Week'}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="p-6">
                        {horizon === 'today' && data.multiHorizonPlan?.today && (
                            <HorizonToday plan={data.multiHorizonPlan.today} curr={curr} isINR={isINR} />
                        )}
                        {horizon === 'tomorrow' && data.multiHorizonPlan?.tomorrow && (
                            <HorizonTomorrow plan={data.multiHorizonPlan.tomorrow} curr={curr} isINR={isINR} />
                        )}
                        {horizon === 'nextWeek' && data.multiHorizonPlan?.nextWeek && (
                            <HorizonNextWeek plan={data.multiHorizonPlan.nextWeek} curr={curr} isINR={isINR} />
                        )}
                    </div>
                </div>

                {/* ── Macro Context ── */}
                <div className="premium-card rounded-xl bg-zinc-950/50 border-border">
                    <div className="p-6 border-b border-border">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                                <DollarSign size={16} className="text-blue-400" />
                            </div>
                            <div>
                                <h3 className="text-sm font-bold text-foreground uppercase tracking-wider">Macro Context</h3>
                                <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">USD / Correlations</p>
                            </div>
                        </div>
                    </div>
                    <div className="p-6 space-y-5">
                        {/* USD */}
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">USD Index (DXY)</p>
                                <p className="text-xl font-bold text-foreground">{data.macroContext?.usd?.value?.toFixed(2) || '—'}</p>
                            </div>
                            <div className="text-right">
                                <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-full border ${data.macroContext?.usd?.trend30d === 'weakening' ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' :
                                    data.macroContext?.usd?.trend30d === 'strengthening' ? 'text-rose-400 bg-rose-500/10 border-rose-500/20' :
                                        'text-zinc-400 bg-zinc-800/50 border-zinc-700'
                                    }`}>
                                    {data.macroContext?.usd?.trend30d || 'stable'}
                                </span>
                            </div>
                        </div>
                        <p className="text-xs text-muted-foreground font-medium italic">{data.macroContext?.usd?.impact}</p>

                        <div className="h-px bg-border" />

                        {/* Ratios */}
                        {data.macroContext?.ratios?.map((ratio: any, i: number) => (
                            <div key={i} className="flex items-center justify-between">
                                <div>
                                    <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">{ratio.name}</p>
                                    <p className="text-sm font-bold text-foreground">{ratio.ratio}</p>
                                </div>
                                <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border ${ratio.signal === 'BULLISH' ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' :
                                    ratio.signal === 'BEARISH' ? 'text-rose-400 bg-rose-500/10 border-rose-500/20' :
                                        'text-zinc-400 bg-zinc-800/50 border-zinc-700'
                                    }`}>
                                    {ratio.signal}
                                </span>
                            </div>
                        ))}

                        <div className="h-px bg-border" />

                        {/* Overall Macro Bias */}
                        <div className="flex items-center justify-between">
                            <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Overall Macro Bias</span>
                            <span className={`text-xs font-black uppercase ${data.macroContext?.overallBias === 'BULLISH' ? 'text-emerald-400' :
                                data.macroContext?.overallBias === 'BEARISH' ? 'text-rose-400' : 'text-zinc-400'
                                }`}>
                                {data.macroContext?.overallBias}
                            </span>
                        </div>
                    </div>
                </div>

                {/* ── Crash Detection ── */}
                <div className="premium-card rounded-xl bg-zinc-950/50 border-border">
                    <div className="p-6 border-b border-border">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-rose-500/10 flex items-center justify-center">
                                    <ShieldAlert size={16} className="text-rose-400" />
                                </div>
                                <div>
                                    <h3 className="text-sm font-bold text-foreground uppercase tracking-wider">Crash Detection</h3>
                                    <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">4-Signal System</p>
                                </div>
                            </div>
                            <span className={`text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full border ${getRiskColor(data.crashDetection?.overallRisk)}`}>
                                {data.crashDetection?.overallRisk || 'LOW'} RISK
                            </span>
                        </div>
                    </div>
                    <div className="p-6 space-y-4">
                        {/* Risk Probability Bar */}
                        <div>
                            <div className="flex justify-between items-center mb-2">
                                <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Crash Probability</span>
                                <span className="text-sm font-bold text-foreground">{data.crashDetection?.probability || 0}%</span>
                            </div>
                            <div className="w-full bg-zinc-900 rounded-full h-2 overflow-hidden">
                                <div
                                    className={`h-full rounded-full transition-all duration-1000 ${(data.crashDetection?.probability || 0) > 60 ? 'bg-rose-500' :
                                        (data.crashDetection?.probability || 0) > 30 ? 'bg-amber-500' : 'bg-emerald-500'
                                        }`}
                                    style={{ width: `${Math.max(2, data.crashDetection?.probability || 0)}%` }}
                                />
                            </div>
                        </div>

                        {/* Signals */}
                        <div className="space-y-2">
                            {data.crashDetection?.signals?.map((signal: any, i: number) => (
                                <div key={i} className="flex items-center justify-between py-2 px-3 rounded-lg bg-zinc-900/30">
                                    <div className="flex items-center gap-3">
                                        {signal.triggered ? (
                                            <AlertTriangle size={14} className="text-amber-400" />
                                        ) : (
                                            <CheckCircle2 size={14} className="text-emerald-400" />
                                        )}
                                        <span className="text-xs font-bold text-foreground">{signal.name}</span>
                                    </div>
                                    <span className={`text-[9px] font-black uppercase tracking-wider ${signal.triggered ? 'text-amber-400' : 'text-emerald-400'
                                        }`}>
                                        {signal.triggered ? signal.severity : 'CLEAR'}
                                    </span>
                                </div>
                            ))}
                        </div>

                        {/* Recommendations */}
                        {data.crashDetection?.recommendations?.map((rec: string, i: number) => (
                            <p key={i} className="text-xs text-muted-foreground font-medium leading-relaxed">{rec}</p>
                        ))}
                    </div>
                </div>

                {/* ── Seasonality ── */}
                <div className="premium-card rounded-xl bg-zinc-950/50 border-border">
                    <div className="p-6 border-b border-border">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-violet-500/10 flex items-center justify-center">
                                <Calendar size={16} className="text-violet-400" />
                            </div>
                            <div>
                                <h3 className="text-sm font-bold text-foreground uppercase tracking-wider">Seasonality</h3>
                                <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">Historical Patterns</p>
                            </div>
                        </div>
                    </div>
                    <div className="p-6 space-y-5">
                        {/* Current Month */}
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Current Month</p>
                                <p className="text-lg font-bold text-foreground">{data.commodityIndicators?.seasonality?.currentMonth}</p>
                            </div>
                            <div className="flex items-center gap-3">
                                <BiasTag bias={data.commodityIndicators?.seasonality?.bias} />
                                <span className="text-sm font-bold text-amber-400">{data.commodityIndicators?.seasonality?.winRate}%</span>
                            </div>
                        </div>
                        <p className="text-xs text-muted-foreground font-medium italic">{data.commodityIndicators?.seasonality?.explanation}</p>

                        <div className="h-px bg-border" />

                        {/* Next Month */}
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Next Month</p>
                                <p className="text-sm font-bold text-foreground">{data.commodityIndicators?.seasonality?.nextMonth}</p>
                            </div>
                            <BiasTag bias={data.commodityIndicators?.seasonality?.nextMonthBias} />
                        </div>

                        <div className="h-px bg-border" />

                        {/* Quarter Outlook */}
                        <div className="flex items-center justify-between">
                            <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Quarter Outlook</span>
                            <BiasTag bias={data.commodityIndicators?.seasonality?.quarterOutlook} />
                        </div>
                    </div>
                </div>

                {/* ── Confidence Breakdown ── */}
                <div className="premium-card rounded-xl bg-zinc-950/50 border-border">
                    <div className="p-6 border-b border-border">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-cyan-500/10 flex items-center justify-center">
                                <BarChart2 size={16} className="text-cyan-400" />
                            </div>
                            <div>
                                <h3 className="text-sm font-bold text-foreground uppercase tracking-wider">Confidence Breakdown</h3>
                                <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">5-Factor Analysis</p>
                            </div>
                        </div>
                    </div>
                    <div className="p-6 space-y-4">
                        {[
                            { label: 'Technical', value: data.commodityIndicators?.confidenceBreakdown?.technical, color: 'bg-blue-500' },
                            { label: 'Seasonality', value: data.commodityIndicators?.confidenceBreakdown?.seasonality, color: 'bg-violet-500' },
                            { label: 'Macro', value: data.commodityIndicators?.confidenceBreakdown?.macro, color: 'bg-cyan-500' },
                            { label: 'Price-Volume', value: data.commodityIndicators?.confidenceBreakdown?.priceVolume, color: 'bg-emerald-500' },
                            { label: 'Crash Safety', value: data.commodityIndicators?.confidenceBreakdown?.crashRisk, color: 'bg-rose-500' },
                        ].map((factor) => (
                            <div key={factor.label}>
                                <div className="flex justify-between items-center mb-1.5">
                                    <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">{factor.label}</span>
                                    <span className="text-xs font-bold text-foreground">{factor.value || 0}%</span>
                                </div>
                                <div className="w-full bg-zinc-900 rounded-full h-1.5 overflow-hidden">
                                    <div
                                        className={`${factor.color} h-full rounded-full transition-all duration-1000`}
                                        style={{ width: `${factor.value || 0}%` }}
                                    />
                                </div>
                            </div>
                        ))}

                        {/* Key Factors */}
                        {data.commodityIndicators?.factors && (
                            <div className="mt-4 pt-4 border-t border-border space-y-2">
                                <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Key Factors</p>
                                {data.commodityIndicators.factors.slice(0, 6).map((factor: string, i: number) => (
                                    <div key={i} className="flex items-start gap-2">
                                        <ChevronRight size={12} className="text-amber-400 mt-0.5 flex-shrink-0" />
                                        <span className="text-xs text-muted-foreground font-medium">{factor}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* ── Technicals Summary ── */}
                <div className="premium-card rounded-xl bg-zinc-950/50 border-border lg:col-span-2">
                    <div className="p-6 border-b border-border">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center">
                                <Activity size={16} className="text-amber-400" />
                            </div>
                            <div>
                                <h3 className="text-sm font-bold text-foreground uppercase tracking-wider">Technical Summary</h3>
                                <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">{data.metadata?.dataPoints || 0} data points analyzed</p>
                            </div>
                        </div>
                    </div>
                    <div className="p-6">
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                            <MetricBox label="RSI (14)" value={data.technicals?.rsi?.toFixed(1) || '—'} sub={data.technicals?.rsiInterpretation} />
                            <MetricBox label="MACD Trend" value={data.technicals?.macdTrend || '—'} />
                            <MetricBox label="MA Trend" value={data.technicals?.maTrend || '—'} />
                            <MetricBox label="Support" value={`${curr}${isINR ? Math.round(data.technicals?.support).toLocaleString('en-IN') : data.technicals?.support?.toFixed(2) || '—'}`} />
                            <MetricBox label="Resistance" value={`${curr}${isINR ? Math.round(data.technicals?.resistance).toLocaleString('en-IN') : data.technicals?.resistance?.toFixed(2) || '—'}`} />
                            <MetricBox label="ATR" value={`${curr}${isINR ? Math.round(data.technicals?.atr).toLocaleString('en-IN') : data.technicals?.atr?.toFixed(2) || '—'}`} sub={data.technicals?.volumeTrend} />
                        </div>
                    </div>
                </div>
            </div>

            {/* ── Metadata Footer ── */}
            <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-border text-[10px] font-black text-muted-foreground uppercase tracking-widest">
                <div className="flex items-center gap-4">
                    <span className="flex items-center gap-1.5">
                        <Clock size={10} />
                        {((data.metadata?.analysisTime || 0) / 1000).toFixed(1)}s analysis
                    </span>
                    <div className="h-3 w-px bg-border" />
                    <span>{data.metadata?.aiModel || 'System'}</span>
                    <div className="h-3 w-px bg-border" />
                    <span>News: {data.newsSentiment || 'neutral'}</span>
                    {data.exchangePricing?.conversionNote && (
                        <>
                            <div className="h-3 w-px bg-border" />
                            <span className="normal-case tracking-normal font-medium" title={data.exchangePricing.conversionNote}>{data.metadata?.exchange || 'COMEX'}</span>
                        </>
                    )}
                </div>
                <span>{new Date(data.metadata?.timestamp || Date.now()).toLocaleString()}</span>
            </div>
        </div>
    );
}

// ── Sub-Components ──

function BiasTag({ bias }: { bias?: string }) {
    const color = bias === 'BULLISH' ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' :
        bias === 'BEARISH' ? 'text-rose-400 bg-rose-500/10 border-rose-500/20' :
            'text-zinc-400 bg-zinc-800/50 border-zinc-700';
    return (
        <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border ${color}`}>
            {bias || 'NEUTRAL'}
        </span>
    );
}

function MetricBox({ label, value, sub }: { label: string; value: string; sub?: string }) {
    const isTrend = ['bullish', 'bearish', 'neutral'].includes(value.toLowerCase());
    const trendColor = value.toLowerCase() === 'bullish' ? 'text-emerald-400' :
        value.toLowerCase() === 'bearish' ? 'text-rose-400' : 'text-zinc-400';

    return (
        <div className="bg-zinc-900/50 rounded-lg p-4 text-center">
            <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest mb-2">{label}</p>
            <p className={`text-lg font-bold ${isTrend ? trendColor : 'text-foreground'}`}>{value}</p>
            {sub && <p className="text-[9px] text-muted-foreground font-bold uppercase tracking-widest mt-1">{sub}</p>}
        </div>
    );
}

function HorizonToday({ plan, curr, isINR }: { plan: any; curr: string; isINR: boolean }) {
    const fmt = (n: number) => isINR ? Math.round(n).toLocaleString('en-IN') : n.toFixed(2);
    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Action */}
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Action</span>
                    <span className={`text-sm font-black uppercase ${plan.action === 'BUY' ? 'text-emerald-400' :
                        plan.action === 'SELL' ? 'text-rose-400' : 'text-amber-400'
                        }`}>
                        {plan.action}
                    </span>
                </div>
                <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Urgency</span>
                    <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-1 rounded-full border ${plan.urgency === 'ACT_NOW' ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' :
                        plan.urgency === 'MONITOR' ? 'text-amber-400 bg-amber-500/10 border-amber-500/20' :
                            'text-zinc-400 bg-zinc-800/50 border-zinc-700'
                        }`}>
                        {plan.urgency}
                    </span>
                </div>
                <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Confidence</span>
                    <span className="text-sm font-bold text-foreground">{plan.confidence}%</span>
                </div>
            </div>

            {/* Price Levels */}
            <div className="space-y-3">
                <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Price Levels</p>
                {plan.entry && (
                    <div className="flex justify-between items-center py-2 px-3 rounded-lg bg-zinc-900/30">
                        <span className="text-xs font-bold text-zinc-400">Entry</span>
                        <span className="text-xs font-bold text-foreground">
                            {curr}{Array.isArray(plan.entry) ? `${fmt(plan.entry[0])} – ${fmt(plan.entry[1])}` : plan.entry}
                        </span>
                    </div>
                )}
                {plan.stopLoss && (
                    <div className="flex justify-between items-center py-2 px-3 rounded-lg bg-rose-500/5 border border-rose-500/10">
                        <span className="text-xs font-bold text-rose-400">Stop Loss</span>
                        <span className="text-xs font-bold text-rose-400">{curr}{typeof plan.stopLoss === 'number' ? fmt(plan.stopLoss) : plan.stopLoss}</span>
                    </div>
                )}
                {plan.target && (
                    <div className="flex justify-between items-center py-2 px-3 rounded-lg bg-emerald-500/5 border border-emerald-500/10">
                        <span className="text-xs font-bold text-emerald-400">Target</span>
                        <span className="text-xs font-bold text-emerald-400">{curr}{typeof plan.target === 'number' ? fmt(plan.target) : plan.target}</span>
                    </div>
                )}
            </div>

            {/* Reasoning + Risks */}
            <div className="space-y-3">
                <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Reasoning</p>
                <p className="text-xs text-muted-foreground font-medium leading-relaxed">{plan.reasoning}</p>
                {plan.risks && plan.risks.length > 0 && (
                    <div className="mt-3 space-y-1.5">
                        <p className="text-[10px] font-black text-rose-400 uppercase tracking-widest">Risks</p>
                        {plan.risks.map((risk: string, i: number) => (
                            <div key={i} className="flex items-start gap-2">
                                <AlertTriangle size={10} className="text-rose-400 mt-0.5 flex-shrink-0" />
                                <span className="text-xs text-muted-foreground">{risk}</span>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

function HorizonTomorrow({ plan, curr, isINR }: { plan: any; curr: string; isINR: boolean }) {
    const fmt = (n: number) => isINR ? Math.round(n).toLocaleString('en-IN') : n.toFixed(2);
    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-foreground">{plan.action}</span>
                <span className="text-sm font-bold text-amber-400">{plan.confidence}% confidence</span>
            </div>

            {/* Conditional Triggers */}
            {plan.conditions?.map((cond: any, i: number) => (
                <div key={i} className="p-4 rounded-lg border border-amber-500/20 bg-amber-500/5 space-y-3">
                    <div className="flex items-center gap-2">
                        <Zap size={14} className="text-amber-400" />
                        <span className="text-xs font-bold text-amber-400 uppercase tracking-wider">Trigger {i + 1}</span>
                    </div>
                    <p className="text-sm font-bold text-foreground">{cond.trigger}</p>
                    <p className="text-xs text-muted-foreground">Action: <span className="font-bold text-foreground">{cond.action}</span></p>
                    <div className="flex gap-4 text-xs text-muted-foreground">
                        {cond.entry && <span>Entry: <span className="text-foreground font-bold">{curr}{Array.isArray(cond.entry) ? `${fmt(cond.entry[0])}–${fmt(cond.entry[1])}` : cond.entry}</span></span>}
                        {cond.stopLoss && <span>SL: <span className="text-rose-400 font-bold">{curr}{typeof cond.stopLoss === 'number' ? fmt(cond.stopLoss) : cond.stopLoss}</span></span>}
                        {cond.target && <span>Target: <span className="text-emerald-400 font-bold">{curr}{typeof cond.target === 'number' ? fmt(cond.target) : cond.target}</span></span>}
                    </div>
                </div>
            ))}

            {/* Watch Levels */}
            {plan.watchLevels && (
                <div>
                    <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-2">Watch Levels</p>
                    <div className="flex gap-3">
                        {plan.watchLevels.map((level: number, i: number) => (
                            <span key={i} className="text-xs font-bold text-foreground bg-zinc-900 px-3 py-1.5 rounded-lg">
                                {curr}{typeof level === 'number' ? fmt(level) : level}
                            </span>
                        ))}
                    </div>
                </div>
            )}

            {/* News to Watch */}
            {plan.newsToWatch && (
                <div>
                    <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-2">Events to Monitor</p>
                    <div className="space-y-1.5">
                        {plan.newsToWatch.map((news: string, i: number) => (
                            <div key={i} className="flex items-center gap-2 text-xs text-muted-foreground">
                                <CircleDot size={10} className="text-amber-400" />
                                {news}
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

function HorizonNextWeek({ plan, curr, isINR }: { plan: any; curr: string; isINR: boolean }) {
    const fmt = (n: number) => isINR ? Math.round(n).toLocaleString('en-IN') : n.toFixed(2);
    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <BiasTag bias={plan.scenario} />
                    <span className="text-sm font-bold text-foreground">scenario</span>
                </div>
                <span className="text-sm font-bold text-amber-400">{plan.probability}% probability</span>
            </div>

            <p className="text-sm text-muted-foreground font-medium leading-relaxed">{plan.reasoning}</p>

            {plan.targetRange && Array.isArray(plan.targetRange) && plan.targetRange[0] > 0 && (
                <div className="flex items-center gap-4">
                    <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Target Range</span>
                    <span className="text-sm font-bold text-foreground">{curr}{fmt(plan.targetRange[0])} – {curr}{fmt(plan.targetRange[1])}</span>
                </div>
            )}

            {plan.strategy && (
                <div className="flex items-center gap-4">
                    <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Strategy</span>
                    <span className="text-sm font-bold text-foreground">{plan.strategy}</span>
                </div>
            )}

            {/* Key Events */}
            {plan.keyEvents && plan.keyEvents.length > 0 && (
                <div>
                    <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-3">Key Events</p>
                    <div className="space-y-2">
                        {plan.keyEvents.map((event: any, i: number) => (
                            <div key={i} className="flex items-center justify-between py-2 px-3 rounded-lg bg-zinc-900/30">
                                <div className="flex items-center gap-3">
                                    <Calendar size={12} className="text-amber-400" />
                                    <div>
                                        <span className="text-xs font-bold text-foreground">{event.event}</span>
                                        <span className="text-[10px] text-muted-foreground ml-2">{event.date}</span>
                                    </div>
                                </div>
                                <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border ${event.impact === 'HIGH' ? 'text-rose-400 bg-rose-500/10 border-rose-500/20' :
                                    event.impact === 'MEDIUM' ? 'text-amber-400 bg-amber-500/10 border-amber-500/20' :
                                        'text-zinc-400 bg-zinc-800/50 border-zinc-700'
                                    }`}>
                                    {event.impact}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
