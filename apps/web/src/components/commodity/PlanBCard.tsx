'use client';

import { useState } from 'react';
import { Shield, ChevronDown, AlertTriangle, ArrowDown, ArrowUp, RotateCcw } from 'lucide-react';

interface PlanBData {
    scenario?: string;
    action?: string;
    reasoning?: string;
    recoveryTarget?: number;
    maxLoss?: string;
    timeline?: string;
    steps?: string[];
}

interface PlanBCardProps {
    planB: PlanBData;
    curr: string;
    isINR: boolean;
}

const ACTION_CONFIG: Record<string, { color: string; icon: typeof Shield; label: string }> = {
    HOLD: { color: 'text-amber-400 bg-amber-500/10 border-amber-500/20', icon: Shield, label: 'Hold Position' },
    AVERAGE_DOWN: { color: 'text-blue-400 bg-blue-500/10 border-blue-500/20', icon: ArrowDown, label: 'Average Down' },
    EXIT: { color: 'text-rose-400 bg-rose-500/10 border-rose-500/20', icon: AlertTriangle, label: 'Exit Trade' },
    HEDGE: { color: 'text-violet-400 bg-violet-500/10 border-violet-500/20', icon: Shield, label: 'Hedge Position' },
    REVERSE: { color: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20', icon: RotateCcw, label: 'Reverse Trade' },
    REDUCE: { color: 'text-orange-400 bg-orange-500/10 border-orange-500/20', icon: ArrowDown, label: 'Reduce Size' },
};

export function PlanBCard({ planB, curr, isINR }: PlanBCardProps) {
    const [isOpen, setIsOpen] = useState(false);

    if (!planB || (!planB.scenario && !planB.steps?.length)) return null;

    const fmt = (n: number) => isINR ? Math.round(n).toLocaleString('en-IN') : n.toFixed(2);
    const config = ACTION_CONFIG[planB.action || 'HOLD'] || ACTION_CONFIG.HOLD;
    const ActionIcon = config.icon;

    return (
        <div className="mt-4 rounded-lg border border-orange-500/20 bg-orange-500/5 overflow-hidden">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-full px-4 py-3 flex items-center justify-between hover:bg-orange-500/10 transition-colors duration-200"
                type="button"
            >
                <div className="flex items-center gap-2.5">
                    <Shield size={14} className="text-orange-400" />
                    <span className="text-[10px] font-black text-orange-400 uppercase tracking-widest">
                        Plan B — Loss Prevention
                    </span>
                </div>
                <div className="flex items-center gap-2">
                    <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border ${config.color}`}>
                        {config.label}
                    </span>
                    <ChevronDown
                        size={14}
                        className={`text-orange-400 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}
                    />
                </div>
            </button>

            <div className={`transition-all duration-300 ease-in-out overflow-hidden ${isOpen ? 'max-h-[1000px] opacity-100' : 'max-h-0 opacity-0'}`}>
                <div className="px-4 pb-4 space-y-3 border-t border-orange-500/10">
                    {/* Scenario */}
                    {planB.scenario && (
                        <div className="pt-3">
                            <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1">If This Happens</p>
                            <p className="text-xs text-foreground font-medium leading-relaxed">{planB.scenario}</p>
                        </div>
                    )}

                    {/* Action + Reasoning */}
                    <div className="flex items-start gap-3 py-2 px-3 rounded-lg bg-zinc-900/30">
                        <ActionIcon size={14} className={config.color.split(' ')[0]} />
                        <div>
                            <p className="text-xs font-bold text-foreground mb-0.5">{planB.action}</p>
                            <p className="text-xs text-muted-foreground leading-relaxed">{planB.reasoning}</p>
                        </div>
                    </div>

                    {/* Recovery Target + Max Loss + Timeline */}
                    <div className="grid grid-cols-3 gap-2">
                        {planB.recoveryTarget && planB.recoveryTarget > 0 && (
                            <div className="bg-zinc-900/30 rounded-lg px-3 py-2 text-center">
                                <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest mb-1">Recovery</p>
                                <p className="text-xs font-bold text-emerald-400">{curr}{fmt(planB.recoveryTarget)}</p>
                            </div>
                        )}
                        {planB.maxLoss && (
                            <div className="bg-zinc-900/30 rounded-lg px-3 py-2 text-center">
                                <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest mb-1">Max Loss</p>
                                <p className="text-xs font-bold text-rose-400">{planB.maxLoss}</p>
                            </div>
                        )}
                        {planB.timeline && (
                            <div className="bg-zinc-900/30 rounded-lg px-3 py-2 text-center">
                                <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest mb-1">Timeline</p>
                                <p className="text-xs font-bold text-foreground">{planB.timeline}</p>
                            </div>
                        )}
                    </div>

                    {/* Steps */}
                    {planB.steps && planB.steps.length > 0 && (
                        <div className="space-y-2">
                            <p className="text-[10px] font-black text-orange-400 uppercase tracking-widest">Recovery Steps</p>
                            {planB.steps.map((step, i) => (
                                <div key={i} className="flex items-start gap-2.5 py-1.5 px-3 rounded-lg bg-zinc-900/20">
                                    <span className={`flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-black ${i === 0 ? 'bg-emerald-500/15 text-emerald-400' :
                                            i === 1 ? 'bg-amber-500/15 text-amber-400' :
                                                'bg-rose-500/15 text-rose-400'
                                        }`}>
                                        {i + 1}
                                    </span>
                                    <span className="text-xs text-muted-foreground font-medium leading-relaxed">{step}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
