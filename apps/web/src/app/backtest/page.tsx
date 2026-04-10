'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import {
    FlaskConical, Play, RefreshCw, ChevronDown, ChevronUp,
    TrendingUp, TrendingDown, Target, ShieldAlert, Clock,
    BarChart2, Layers, Trophy, AlertTriangle, CheckCircle2,
    XCircle, Timer, Minus, History, Settings2
} from 'lucide-react';
import {
    startBacktest, fetchBacktestResult, fetchBacktestRuns,
    type BacktestConfig, type BacktestResult, type BacktestRun, type BacktestReport,
} from '@/services/api';

// ─── helpers ────────────────────────────────────────────────────
function fmt(n: number | undefined | null, dec = 1): string {
    if (n == null || isNaN(n)) return '—';
    return n.toFixed(dec);
}
function pct(n: number | undefined | null): string { return `${fmt(n)}%`; }
function signed(n: number | undefined | null): string {
    if (n == null || isNaN(n)) return '—';
    return `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`;
}
function msToTime(ms: number): string {
    const s = Math.floor(ms / 1000);
    if (s < 60) return `${s}s`;
    const m = Math.floor(s / 60);
    return `${m}m ${s % 60}s`;
}

// ─── sub-components ─────────────────────────────────────────────

function MetricCard({ label, value, sub, color = 'default', icon }: {
    label: string; value: string; sub?: string;
    color?: 'green' | 'red' | 'amber' | 'blue' | 'default';
    icon?: React.ReactNode;
}) {
    const colors = {
        green: 'text-emerald-400',
        red: 'text-rose-400',
        amber: 'text-amber-400',
        blue: 'text-primary-400',
        default: 'text-foreground',
    };
    return (
        <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-5 space-y-2 hover:border-zinc-700 transition-colors">
            <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{label}</span>
                {icon && <span className="text-zinc-600">{icon}</span>}
            </div>
            <p className={`text-2xl md:text-3xl font-black tracking-tight ${colors[color]}`}>{value}</p>
            {sub && <p className="text-[10px] text-muted-foreground font-medium">{sub}</p>}
        </div>
    );
}

function OutcomeBar({ report }: { report: BacktestReport }) {
    const total = report.totalSignals || 1;
    const bars = [
        { label: 'Target Hit', count: report.outcomes.targetHit, color: 'bg-emerald-500', icon: <CheckCircle2 size={12} /> },
        { label: 'Partial', count: report.outcomes.partialProfit, color: 'bg-cyan-500', icon: <Target size={12} /> },
        { label: 'Stop Hit', count: report.outcomes.stopHit, color: 'bg-rose-500', icon: <XCircle size={12} /> },
        { label: 'Expired', count: report.outcomes.expired, color: 'bg-zinc-600', icon: <Timer size={12} /> },
    ];

    return (
        <div className="space-y-4">
            <div className="flex h-3 rounded-full overflow-hidden gap-0.5">
                {bars.map(b => (
                    <div
                        key={b.label}
                        className={`${b.color} transition-all`}
                        style={{ width: `${(b.count / total) * 100}%` }}
                        title={`${b.label}: ${b.count}`}
                    />
                ))}
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {bars.map(b => (
                    <div key={b.label} className="flex items-center gap-2">
                        <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${b.color}`} />
                        <div>
                            <p className="text-xs font-black text-foreground">{b.count}</p>
                            <p className="text-[10px] text-muted-foreground font-medium">{b.label}</p>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

function BucketTable({ title, data, keyLabel, icon }: {
    title: string;
    data: Array<{ bucket?: string; regime?: string; total: number; winRate: number; avgPnl: number }>;
    keyLabel: string;
    icon: React.ReactNode;
}) {
    if (!data || data.length === 0) return null;
    return (
        <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-zinc-800 flex items-center gap-2">
                <span className="text-zinc-500">{icon}</span>
                <h3 className="text-[11px] font-black uppercase tracking-widest text-foreground">{title}</h3>
            </div>
            <div className="overflow-x-auto">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="border-b border-zinc-800/50">
                            <th className="text-left px-5 py-2.5 text-[10px] font-black uppercase tracking-widest text-muted-foreground">{keyLabel}</th>
                            <th className="text-right px-5 py-2.5 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Signals</th>
                            <th className="text-right px-5 py-2.5 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Win Rate</th>
                            <th className="text-right px-5 py-2.5 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Avg P&L</th>
                        </tr>
                    </thead>
                    <tbody>
                        {data.map((row, i) => {
                            const key = row.bucket ?? row.regime ?? String(i);
                            const winColor = row.winRate >= 65 ? 'text-emerald-400' : row.winRate >= 50 ? 'text-amber-400' : 'text-rose-400';
                            const pnlColor = row.avgPnl >= 0 ? 'text-emerald-400' : 'text-rose-400';
                            return (
                                <tr key={key} className="border-b border-zinc-800/30 hover:bg-zinc-800/20 transition-colors">
                                    <td className="px-5 py-3 font-bold text-foreground text-xs">{key}</td>
                                    <td className="px-5 py-3 text-right text-xs text-muted-foreground font-medium">{row.total}</td>
                                    <td className={`px-5 py-3 text-right text-xs font-black ${winColor}`}>{pct(row.winRate)}</td>
                                    <td className={`px-5 py-3 text-right text-xs font-bold ${pnlColor}`}>{signed(row.avgPnl)}</td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

function StackCard({ stack, rank, type }: {
    stack: { conditions: string[]; totalSignals: number; winRate: number; avgPnl: number; profitFactor: number; edge: number };
    rank: number;
    type: 'top' | 'worst';
}) {
    const isTop = type === 'top';
    const borderColor = isTop ? 'border-emerald-500/20 hover:border-emerald-500/40' : 'border-rose-500/20 hover:border-rose-500/40';
    const rankColor = isTop ? 'text-emerald-400 bg-emerald-500/10' : 'text-rose-400 bg-rose-500/10';
    const winColor = stack.winRate >= 60 ? 'text-emerald-400' : stack.winRate >= 50 ? 'text-amber-400' : 'text-rose-400';

    return (
        <div className={`bg-zinc-900/60 border ${borderColor} rounded-xl p-4 space-y-3 transition-colors`}>
            <div className="flex items-start justify-between gap-2">
                <div className="flex flex-wrap gap-1 flex-1">
                    {stack.conditions.map(c => (
                        <span key={c} className="px-1.5 py-0.5 text-[9px] font-black rounded border border-zinc-700 bg-zinc-800 text-zinc-300 uppercase tracking-wide">
                            {c.replace(/([A-Z])/g, ' $1').trim()}
                        </span>
                    ))}
                </div>
                <span className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black ${rankColor}`}>
                    {rank}
                </span>
            </div>
            <div className="grid grid-cols-3 gap-2 pt-1 border-t border-zinc-800/50">
                <div>
                    <p className="text-[9px] text-muted-foreground uppercase tracking-widest font-black">Win Rate</p>
                    <p className={`text-sm font-black ${winColor}`}>{pct(stack.winRate)}</p>
                </div>
                <div>
                    <p className="text-[9px] text-muted-foreground uppercase tracking-widest font-black">Avg P&L</p>
                    <p className={`text-sm font-black ${stack.avgPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{signed(stack.avgPnl)}</p>
                </div>
                <div>
                    <p className="text-[9px] text-muted-foreground uppercase tracking-widest font-black">Signals</p>
                    <p className="text-sm font-black text-foreground">{stack.totalSignals}</p>
                </div>
            </div>
        </div>
    );
}

function RunHistoryItem({ run, onLoad }: { run: BacktestRun; onLoad: (id: string) => void }) {
    const statusIcon = run.status === 'COMPLETED'
        ? <CheckCircle2 size={14} className="text-emerald-400" />
        : run.status === 'RUNNING'
            ? <RefreshCw size={14} className="text-primary-400 animate-spin" />
            : <XCircle size={14} className="text-rose-400" />;

    return (
        <div
            className="flex items-center justify-between px-4 py-3 hover:bg-zinc-800/30 transition-colors cursor-pointer rounded-lg group"
            onClick={() => run.status === 'COMPLETED' && onLoad(String(run.id))}
        >
            <div className="flex items-center gap-3">
                {statusIcon}
                <div>
                    <p className="text-xs font-bold text-foreground">
                        {run.config.startDate} → {run.config.endDate}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                        {run.config.symbolCount} stocks · {run.config.minConfidence}% min confidence
                        {run.duration ? ` · ${msToTime(run.duration)}` : ''}
                    </p>
                </div>
            </div>
            {run.status === 'COMPLETED' && (
                <span className="text-[10px] text-primary-500 font-black uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity">
                    Load →
                </span>
            )}
            {run.status === 'RUNNING' && (
                <span className="text-[10px] text-muted-foreground">{run.progress}</span>
            )}
        </div>
    );
}

// ─── main page ──────────────────────────────────────────────────

export default function BacktestPage() {
    const [config, setConfig] = useState<BacktestConfig>({
        startDate: '2024-04-01',
        endDate: '2025-03-31',
        minConfidence: 50,
        signalExpiry: 7,
        partialTargetR: 1.5,
        fullTargetR: 2.5,
        strategy: 'momentum',
    });
    const [showConfig, setShowConfig] = useState(false);
    const [showHistory, setShowHistory] = useState(false);

    const [runningId, setRunningId] = useState<string | null>(null);
    const [progress, setProgress] = useState<string>('');
    const [result, setResult] = useState<BacktestResult | null>(null);
    const [pastRuns, setPastRuns] = useState<BacktestRun[]>([]);
    const [loadingRuns, setLoadingRuns] = useState(false);

    const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // Load past runs
    const loadPastRuns = useCallback(async () => {
        setLoadingRuns(true);
        try {
            const data = await fetchBacktestRuns();
            if (data.success) setPastRuns(data.results);
        } catch {
            // demo mode — no runs
        } finally {
            setLoadingRuns(false);
        }
    }, []);

    useEffect(() => {
        loadPastRuns();
        return () => { if (pollRef.current) clearInterval(pollRef.current); };
    }, [loadPastRuns]);

    // Poll while running
    const startPolling = useCallback((id: string) => {
        if (pollRef.current) clearInterval(pollRef.current);
        pollRef.current = setInterval(async () => {
            try {
                const data = await fetchBacktestResult(id);
                if (data.status === 'RUNNING') {
                    setProgress(data.progress ?? '');
                } else {
                    if (pollRef.current) clearInterval(pollRef.current);
                    setRunningId(null);
                    setResult(data);
                    if (data.status === 'COMPLETED') {
                        toast.success('Backtest completed!');
                        loadPastRuns();
                    } else {
                        toast.error(`Backtest failed: ${data.error}`);
                    }
                }
            } catch {
                if (pollRef.current) clearInterval(pollRef.current);
                setRunningId(null);
            }
        }, 5000);
    }, [loadPastRuns]);

    const handleRun = async () => {
        try {
            const res = await startBacktest(config);
            if (res.success) {
                setRunningId(res.backtestId);
                setResult(null);
                setProgress(`Starting...`);
                toast.info('Backtest started — this may take several minutes');
                startPolling(res.backtestId);
            }
        } catch {
            // error handled by api.ts
        }
    };

    const handleLoad = async (id: string) => {
        try {
            const data = await fetchBacktestResult(id);
            setResult(data);
            setShowHistory(false);
            window.scrollTo({ top: 0, behavior: 'smooth' });
        } catch {
            toast.error('Failed to load backtest result');
        }
    };

    const report = result?.report;

    return (
        <div className="space-y-6 md:space-y-10 max-w-7xl mx-auto pb-24 pt-1 md:pt-10">

            {/* ── Header ── */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-border pb-6 md:pb-10">
                <div className="space-y-3 md:space-y-4">
                    <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-400 text-[10px] font-black uppercase tracking-widest">
                        <FlaskConical size={12} />
                        <span>Walk-Forward Engine</span>
                    </div>
                    <h1 className="text-3xl md:text-5xl font-bold text-foreground tracking-tight">
                        Backtest <span className="text-primary-500">Lab</span>
                    </h1>
                    <p className="text-muted-foreground max-w-xl font-medium text-sm md:text-base">
                        Simulate signals on historical NSE data — day-by-day, no future leakage. Measure real win rate, profit factor, and which condition stacks actually work.
                    </p>
                </div>

                <div className="flex items-center gap-3 flex-wrap">
                    <button
                        onClick={() => setShowHistory(!showHistory)}
                        className="flex items-center gap-2 px-5 py-3.5 rounded-lg border border-border bg-zinc-900 text-muted-foreground hover:text-foreground transition-all font-black uppercase text-[10px] tracking-widest"
                    >
                        <History size={14} />
                        Past Runs
                    </button>
                    <button
                        onClick={() => setShowConfig(!showConfig)}
                        className={`flex items-center gap-2 px-5 py-3.5 rounded-lg border transition-all font-black uppercase text-[10px] tracking-widest ${showConfig ? 'bg-zinc-700 border-zinc-600 text-foreground' : 'border-border bg-zinc-900 text-muted-foreground hover:text-foreground'}`}
                    >
                        <Settings2 size={14} />
                        Config
                        {showConfig ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                    </button>
                    <button
                        onClick={handleRun}
                        disabled={!!runningId}
                        className="flex items-center gap-2 px-6 py-3.5 bg-primary-600 hover:bg-primary-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-all font-black uppercase text-[10px] tracking-widest shadow-lg shadow-primary-500/20"
                    >
                        {runningId ? <RefreshCw size={14} className="animate-spin" /> : <Play size={14} />}
                        {runningId ? 'Running...' : 'Run Backtest'}
                    </button>
                </div>
            </div>

            {/* ── Past Runs ── */}
            {showHistory && (
                <div className="bg-zinc-950 border border-zinc-800 rounded-xl overflow-hidden animate-in fade-in slide-in-from-top-4 duration-300">
                    <div className="px-5 py-4 border-b border-zinc-800 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <History size={14} className="text-zinc-500" />
                            <h3 className="text-[11px] font-black uppercase tracking-widest">Past Backtest Runs</h3>
                        </div>
                        {loadingRuns && <RefreshCw size={12} className="animate-spin text-zinc-500" />}
                    </div>
                    {pastRuns.length === 0 ? (
                        <div className="px-5 py-10 text-center">
                            <p className="text-sm font-bold text-zinc-600">No runs yet</p>
                            <p className="text-[11px] text-zinc-700 mt-1">Run your first backtest above</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-zinc-800/40 p-2">
                            {pastRuns.map(r => (
                                <RunHistoryItem key={String(r.id)} run={r} onLoad={handleLoad} />
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* ── Config Panel ── */}
            {showConfig && (
                <div className="bg-zinc-950/80 border border-zinc-800 rounded-xl p-6 md:p-8 animate-in fade-in slide-in-from-top-4 duration-300">
                    {/* ── Strategy selector ── */}
                    <div className="mb-6">
                        <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Strategy</label>
                        <div className="mt-2 inline-flex rounded-lg border border-zinc-800 bg-zinc-900 p-1">
                            <button
                                type="button"
                                onClick={() => setConfig(c => ({ ...c, strategy: 'momentum' }))}
                                className={`px-4 py-2 text-xs font-black uppercase tracking-widest rounded-md transition-colors ${config.strategy === 'momentum' ? 'bg-emerald-500/20 text-emerald-300' : 'text-zinc-500 hover:text-zinc-300'}`}
                            >
                                Momentum
                            </button>
                            <button
                                type="button"
                                onClick={() => setConfig(c => ({ ...c, strategy: 'legacy' }))}
                                className={`px-4 py-2 text-xs font-black uppercase tracking-widest rounded-md transition-colors ${config.strategy === 'legacy' ? 'bg-blue-500/20 text-blue-300' : 'text-zinc-500 hover:text-zinc-300'}`}
                            >
                                Legacy (SMC)
                            </button>
                        </div>
                        <p className="mt-2 text-[10px] text-zinc-600 font-medium">
                            {config.strategy === 'momentum'
                                ? 'Cross-sectional momentum + 200-SMA + Donchian breakout + volume + ATR stops. Long-only. Confidence slider is ignored.'
                                : 'Original SMC pipeline (order blocks, CHoCH, liquidity sweeps, confidence scoring).'}
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Start Date</label>
                            <input
                                type="date"
                                value={config.startDate}
                                onChange={e => setConfig(c => ({ ...c, startDate: e.target.value }))}
                                className="w-full bg-zinc-900 border border-border rounded-lg py-3 px-4 text-foreground font-bold text-sm focus:outline-none focus:ring-1 focus:ring-primary-500"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">End Date</label>
                            <input
                                type="date"
                                value={config.endDate}
                                onChange={e => setConfig(c => ({ ...c, endDate: e.target.value }))}
                                className="w-full bg-zinc-900 border border-border rounded-lg py-3 px-4 text-foreground font-bold text-sm focus:outline-none focus:ring-1 focus:ring-primary-500"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                                Min Confidence — <span className="text-primary-400">{config.minConfidence}%</span>
                            </label>
                            <input
                                type="range" min="50" max="90" step="5"
                                value={config.minConfidence}
                                onChange={e => setConfig(c => ({ ...c, minConfidence: Number(e.target.value) }))}
                                className="w-full h-1 bg-zinc-800 rounded-full appearance-none cursor-pointer accent-blue-500"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                                Signal Expiry — <span className="text-primary-400">{config.signalExpiry} days</span>
                            </label>
                            <input
                                type="range" min="3" max="30" step="1"
                                value={config.signalExpiry}
                                onChange={e => setConfig(c => ({ ...c, signalExpiry: Number(e.target.value) }))}
                                className="w-full h-1 bg-zinc-800 rounded-full appearance-none cursor-pointer accent-blue-500"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                                Partial Target R — <span className="text-cyan-400">{config.partialTargetR}R</span>
                            </label>
                            <input
                                type="range" min="1" max="3" step="0.5"
                                value={config.partialTargetR}
                                onChange={e => setConfig(c => ({ ...c, partialTargetR: Number(e.target.value) }))}
                                className="w-full h-1 bg-zinc-800 rounded-full appearance-none cursor-pointer accent-cyan-500"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                                Full Target R — <span className="text-emerald-400">{config.fullTargetR}R</span>
                            </label>
                            <input
                                type="range" min="1.5" max="5" step="0.5"
                                value={config.fullTargetR}
                                onChange={e => setConfig(c => ({ ...c, fullTargetR: Number(e.target.value) }))}
                                className="w-full h-1 bg-zinc-800 rounded-full appearance-none cursor-pointer accent-emerald-500"
                            />
                        </div>
                    </div>
                    <p className="mt-6 text-[11px] text-zinc-600 font-medium">
                        Symbols: NIFTY 100 (default) · Walk-forward simulation with no future data leakage
                    </p>
                </div>
            )}

            {/* ── Running Progress ── */}
            {runningId && (
                <div className="bg-primary-500/5 border border-primary-500/20 rounded-xl p-6 animate-in fade-in duration-300">
                    <div className="flex items-center gap-3 mb-3">
                        <RefreshCw size={16} className="animate-spin text-primary-400" />
                        <span className="text-sm font-black text-primary-400 uppercase tracking-widest">Backtest Running</span>
                    </div>
                    <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden mb-3">
                        <div className="h-full bg-primary-500 animate-pulse rounded-full w-1/3" />
                    </div>
                    <p className="text-xs text-muted-foreground font-medium">{progress || 'Initialising...'}</p>
                    <p className="text-[10px] text-zinc-600 mt-1">Polling every 5 seconds — this may take 5–15 minutes for NIFTY 100</p>
                </div>
            )}

            {/* ── Results ── */}
            {result?.status === 'FAILED' && (
                <div className="bg-rose-500/5 border border-rose-500/20 rounded-xl p-6">
                    <div className="flex items-center gap-2 mb-2">
                        <XCircle size={16} className="text-rose-400" />
                        <span className="text-sm font-black text-rose-400 uppercase tracking-widest">Backtest Failed</span>
                    </div>
                    <p className="text-sm text-muted-foreground">{result.error ?? 'Unknown error'}</p>
                    <p className="text-[10px] text-zinc-600 mt-2">Check that MongoDB is connected and the API server is running.</p>
                </div>
            )}

            {result?.status === 'COMPLETED' && report && (
                <div className="space-y-8 animate-in fade-in duration-500">

                    {/* Config badge */}
                    <div className="flex flex-wrap items-center gap-2">
                        {[
                            `${result.config?.startDate} → ${result.config?.endDate}`,
                            `${result.config?.symbolCount} stocks`,
                            `≥${result.config?.minConfidence}% confidence`,
                            `${result.signalCount} signals`,
                            result.duration ? msToTime(result.duration) : null,
                        ].filter(Boolean).map(tag => (
                            <span key={tag!} className="px-2.5 py-1 text-[10px] font-black rounded-full border border-zinc-700 bg-zinc-800/60 text-zinc-400 uppercase tracking-wide">
                                {tag}
                            </span>
                        ))}
                    </div>

                    {/* ── Core Metrics ── */}
                    <div>
                        <h2 className="text-[11px] font-black uppercase tracking-widest text-muted-foreground mb-4 flex items-center gap-2">
                            <BarChart2 size={12} /> Core Performance
                        </h2>
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                            <MetricCard
                                label="Win Rate"
                                value={pct(report.winRate)}
                                color={report.winRate >= 60 ? 'green' : report.winRate >= 50 ? 'amber' : 'red'}
                                icon={<TrendingUp size={16} />}
                                sub={`${report.outcomes.targetHit} of ${report.totalSignals}`}
                            />
                            <MetricCard
                                label="Profit Factor"
                                value={fmt(report.profitFactor, 2)}
                                color={report.profitFactor >= 1.5 ? 'green' : report.profitFactor >= 1 ? 'amber' : 'red'}
                                icon={<Trophy size={16} />}
                                sub="Gross profit / gross loss"
                            />
                            <MetricCard
                                label="Expectancy"
                                value={`${fmt(report.expectancy, 2)}%`}
                                color={report.expectancy > 0 ? 'green' : 'red'}
                                icon={<Target size={16} />}
                                sub="Per trade expected value"
                            />
                            <MetricCard
                                label="Sharpe Ratio"
                                value={fmt((report as any).sharpeRatio, 2)}
                                color={(report as any).sharpeRatio >= 1 ? 'green' : (report as any).sharpeRatio >= 0 ? 'amber' : 'red'}
                                icon={<BarChart2 size={16} />}
                                sub="Annualised"
                            />
                            <MetricCard
                                label="Max Drawdown"
                                value={pct((report as any).maxDrawdownPercent)}
                                color={(report as any).maxDrawdownPercent <= 10 ? 'green' : (report as any).maxDrawdownPercent <= 20 ? 'amber' : 'red'}
                                icon={<TrendingDown size={16} />}
                                sub={`Max ${(report as any).maxConsecutiveLosses ?? '—'} consec. losses`}
                            />
                            <MetricCard
                                label="Total Signals"
                                value={String(report.totalSignals)}
                                icon={<Layers size={16} />}
                                sub={`Avg ${fmt((report as any).avgDaysToOutcome)} days/trade`}
                            />
                        </div>
                    </div>

                    {/* ── Outcome Breakdown ── */}
                    <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-6">
                        <h2 className="text-[11px] font-black uppercase tracking-widest text-muted-foreground mb-4 flex items-center gap-2">
                            <Target size={12} /> Outcome Breakdown
                        </h2>
                        <OutcomeBar report={report} />
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-6 pt-5 border-t border-zinc-800/50">
                            <div>
                                <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-black">Avg Days — Winners</p>
                                <p className="text-lg font-black text-foreground mt-0.5">{fmt((report as any).avgDaysWinners)} days</p>
                            </div>
                            <div>
                                <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-black">Avg Days — Losers</p>
                                <p className="text-lg font-black text-foreground mt-0.5">{fmt((report as any).avgDaysLosers)} days</p>
                            </div>
                            <div>
                                <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-black">Avg Total P&L</p>
                                <p className={`text-lg font-black mt-0.5 ${(report.avgPnlPercent ?? 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                    {signed(report.avgPnlPercent)}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* ── MFE / MAE ── */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-5 space-y-3">
                            <div className="flex items-center gap-2">
                                <TrendingUp size={14} className="text-emerald-500" />
                                <h3 className="text-[11px] font-black uppercase tracking-widest text-muted-foreground">MFE — Max Favourable Excursion</h3>
                            </div>
                            <p className="text-2xl font-black text-emerald-400">{pct((report as any).avgMFE)}</p>
                            <p className="text-xs text-muted-foreground">
                                On losing trades: <span className="text-amber-400 font-bold">{pct((report as any).mfeOnLosers)}</span>
                                <span className="text-zinc-600 ml-1">— how far price moved before turning</span>
                            </p>
                        </div>
                        <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-5 space-y-3">
                            <div className="flex items-center gap-2">
                                <TrendingDown size={14} className="text-rose-500" />
                                <h3 className="text-[11px] font-black uppercase tracking-widest text-muted-foreground">MAE — Max Adverse Excursion</h3>
                            </div>
                            <p className="text-2xl font-black text-rose-400">{pct((report as any).avgMAE)}</p>
                            <p className="text-xs text-muted-foreground">
                                On winning trades: <span className="text-amber-400 font-bold">{pct((report as any).maeOnWinners)}</span>
                                <span className="text-zinc-600 ml-1">— entry heat on winners</span>
                            </p>
                        </div>
                    </div>

                    {/* ── Breakdown Tables ── */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        <BucketTable
                            title="Win Rate by Confidence"
                            data={Object.entries((report as any).byConfidenceBucket ?? {}).map(([k, v]: [string, any]) => ({ bucket: k, total: v.count, winRate: v.winRate, avgPnl: v.avgPnl }))}
                            keyLabel="Confidence Range"
                            icon={<ShieldAlert size={14} />}
                        />
                        <BucketTable
                            title="Win Rate by Regime"
                            data={Object.entries((report as any).byRegime ?? {}).map(([k, v]: [string, any]) => ({ bucket: k, total: v.count, winRate: v.winRate, avgPnl: v.avgPnl }))}
                            keyLabel="Market Regime"
                            icon={<BarChart2 size={14} />}
                        />
                    </div>

                    {Object.keys((report as any).byPattern ?? {}).length > 0 && (
                        <BucketTable
                            title="Win Rate by Pattern"
                            data={Object.entries((report as any).byPattern ?? {}).map(([k, v]: [string, any]) => ({ bucket: k, total: v.count, winRate: v.winRate, avgPnl: v.avgPnl }))}
                            keyLabel="Pattern Type"
                            icon={<Layers size={14} />}
                        />
                    )}

                    {/* ── Condition Stacks ── */}
                    {result.topStacks && result.topStacks.length > 0 && (
                        <div>
                            <h2 className="text-[11px] font-black uppercase tracking-widest text-muted-foreground mb-4 flex items-center gap-2">
                                <Trophy size={12} className="text-emerald-400" /> Top Condition Stacks — Highest Edge
                            </h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                {result.topStacks.slice(0, 9).map((stack, i) => (
                                    <StackCard key={i} stack={stack} rank={i + 1} type="top" />
                                ))}
                            </div>
                        </div>
                    )}

                    {result.worstStacks && result.worstStacks.length > 0 && (
                        <div>
                            <h2 className="text-[11px] font-black uppercase tracking-widest text-muted-foreground mb-4 flex items-center gap-2">
                                <AlertTriangle size={12} className="text-rose-400" /> Worst Condition Stacks — Avoid These
                            </h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                {result.worstStacks.slice(0, 6).map((stack, i) => (
                                    <StackCard key={i} stack={stack} rank={i + 1} type="worst" />
                                ))}
                            </div>
                        </div>
                    )}

                    {/* ── Insights ── */}
                    {report.insights && report.insights.length > 0 && (
                        <div className="bg-zinc-900/40 border border-zinc-800 rounded-xl p-6">
                            <h2 className="text-[11px] font-black uppercase tracking-widest text-muted-foreground mb-4 flex items-center gap-2">
                                <CheckCircle2 size={12} className="text-primary-400" /> System Insights
                            </h2>
                            <ul className="space-y-2.5">
                                {report.insights.map((insight, i) => (
                                    <li key={i} className="flex items-start gap-3">
                                        <Minus size={12} className="text-zinc-600 mt-0.5 flex-shrink-0" />
                                        <span className="text-sm text-muted-foreground font-medium">{insight}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>
            )}

            {/* ── Empty state (no result yet) ── */}
            {!runningId && !result && (
                <div className="py-32 text-center border border-dashed border-zinc-800 rounded-xl bg-zinc-950/20">
                    <div className="max-w-sm mx-auto space-y-5">
                        <div className="w-16 h-16 bg-zinc-900 rounded-full flex items-center justify-center mx-auto border border-zinc-800">
                            <FlaskConical size={24} className="text-zinc-600" />
                        </div>
                        <div className="space-y-2">
                            <h3 className="text-lg font-black text-foreground tracking-tight italic">No Results Yet</h3>
                            <p className="text-sm text-muted-foreground font-medium px-4">
                                Click <span className="text-primary-400 font-bold">Run Backtest</span> to simulate signals on historical NSE data and measure real system accuracy.
                            </p>
                        </div>
                        <div className="flex items-center justify-center gap-4 text-[10px] text-zinc-600 font-black uppercase tracking-widest">
                            <span className="flex items-center gap-1"><Clock size={10} /> 5–15 min runtime</span>
                            <span className="flex items-center gap-1"><Layers size={10} /> NIFTY 100</span>
                            <span className="flex items-center gap-1"><ShieldAlert size={10} /> No data leakage</span>
                        </div>
                        <button
                            onClick={handleRun}
                            className="mx-auto flex items-center gap-2 px-8 py-4 bg-primary-600 hover:bg-primary-500 text-white rounded-lg transition-all font-black uppercase text-[10px] tracking-widest shadow-lg shadow-primary-500/20"
                        >
                            <Play size={14} />
                            Run Backtest
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
