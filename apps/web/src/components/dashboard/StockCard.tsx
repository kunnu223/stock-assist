'use client';

import { useState } from 'react';
import type { StockAnalysis } from '@stock-assist/shared';
import { Target, ShieldAlert, Calendar, ArrowRight, ExternalLink, Star } from 'lucide-react';
import { calcPositionSize, formatPrice } from '@stock-assist/shared';
import { useWatchlist } from '@/context/WatchlistContext';

interface Props {
    analysis: StockAnalysis;
    date?: string;
    onClick?: () => void;
}

export function StockCard({ analysis, date, onClick }: Props) {
    const { stock, currentPrice, bias, confidence, confidenceScore, recommendation, bullish, bearish } = analysis;

    const isBullish = bias === 'BULLISH';
    const biasColor = isBullish ? 'text-green-500' : bias === 'BEARISH' ? 'text-red-500' : 'text-yellow-500';
    const biasBg = isBullish ? 'bg-green-500/10' : bias === 'BEARISH' ? 'bg-red-500/10' : 'bg-yellow-500/10';

    const { isFollowing, toggleFollow } = useWatchlist();
    const followed = isFollowing(stock);

    const handleToggle = (e: React.MouseEvent) => {
        e.stopPropagation();
        toggleFollow(stock);
    };

    const scenario = isBullish ? bullish : bearish;

    return (
        <div
            onClick={onClick}
            className={`premium-card p-6 rounded-xl group relative overflow-hidden flex flex-col h-full bg-zinc-950/50 ${onClick ? 'cursor-pointer' : ''
                }`}
        >
            {/* Header */}
            <div className="flex justify-between items-start mb-6">
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-xl font-bold tracking-tight text-foreground transition-colors uppercase">{stock}</h3>
                        <button
                            onClick={handleToggle}
                            className={`p-1 rounded hover:bg-white/5 transition-colors ${followed ? 'text-amber-500' : 'text-zinc-700'}`}
                        >
                            <Star size={16} fill={followed ? 'currentColor' : 'none'} />
                        </button>
                        {date && (
                            <span className="text-[10px] text-muted-foreground font-medium flex items-center gap-1">
                                <Calendar size={10} />
                                {new Date(date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                            </span>
                        )}
                    </div>
                    <p className="text-2xl font-bold text-foreground">{formatPrice(currentPrice)}</p>
                </div>
                <div className="flex flex-col items-end gap-2">
                    <div className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${biasBg} ${biasColor} border border-current/10`}>
                        {bias}
                    </div>
                </div>
            </div>

            {/* Signal Description */}
            <div className="bg-muted/30 border border-border rounded-lg p-4 mb-6 flex-grow">
                <p className="text-xs text-muted-foreground leading-relaxed font-medium line-clamp-2 italic">
                    "{recommendation}"
                </p>
            </div>

            {/* Metrics Grid */}
            <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="space-y-1">
                    <p className="text-[9px] text-muted-foreground uppercase font-bold tracking-widest">Bullish Probability</p>
                    <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-foreground">{bullish.probability}%</span>
                        <div className="flex-grow h-1 bg-muted rounded-full overflow-hidden">
                            <div className="h-full bg-green-500" style={{ width: `${bullish.probability}%` }} />
                        </div>
                    </div>
                </div>
                <div className="space-y-1">
                    <p className="text-[9px] text-muted-foreground uppercase font-bold tracking-widest">Bearish Probability</p>
                    <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-foreground">{bearish.probability}%</span>
                        <div className="flex-grow h-1 bg-muted rounded-full overflow-hidden">
                            <div className="h-full bg-red-500" style={{ width: `${bearish.probability}%` }} />
                        </div>
                    </div>
                </div>
            </div>

            {/* Confidence Label */}
            <div className="flex items-center justify-between mb-6 px-1">
                <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">Confidence</span>
                <span className={`text-[10px] font-bold uppercase tracking-wider ${confidence === 'HIGH' ? 'text-green-500' : confidence === 'MEDIUM' ? 'text-yellow-500' : 'text-red-500'
                    }`}>
                    {confidence} ({confidenceScore}%)
                </span>
            </div>

            {/* Footer */}
            <div className="flex justify-between items-center pt-5 border-t border-border mt-auto">
                <div className="space-y-1">
                    <span className="text-[9px] text-muted-foreground uppercase font-bold tracking-widest block text-center">TP1</span>
                    <span className="text-sm font-bold text-green-500">{formatPrice(bullish.tradePlan.targets[0]?.price)}</span>
                </div>
                <div className="h-8 w-px bg-border " />
                <div className="space-y-1">
                    <span className="text-[9px] text-muted-foreground uppercase font-bold tracking-widest block text-center">Stop Loss</span>
                    <span className="text-sm font-bold text-red-500">{formatPrice(scenario.tradePlan.stopLoss)}</span>
                </div>
            </div>

            {onClick && (
                <div className="absolute inset-x-0 bottom-0 py-1.5 bg-primary-600 text-white text-[9px] font-bold uppercase tracking-[0.2em] text-center opacity-0 group-hover:opacity-100 transition-all transform translate-y-full group-hover:translate-y-0">
                    <div className="flex items-center justify-center gap-2">
                        Review Full Analysis
                        <ExternalLink size={10} />
                    </div>
                </div>
            )}
        </div>
    );
}
