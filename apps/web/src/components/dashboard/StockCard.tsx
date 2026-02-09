'use client';

import type { StockAnalysis } from '@stock-assist/shared';
import { Target, ShieldAlert, Calculator, Calendar, ArrowRight } from 'lucide-react';
import { calcPositionSize, formatPrice } from '@stock-assist/shared';

interface Props {
    analysis: StockAnalysis;
    date?: string;
    onClick?: () => void;
}

export function StockCard({ analysis, date, onClick }: Props) {
    const { stock, currentPrice, bias, confidence, confidenceScore, recommendation, bullish, bearish } = analysis;

    const isBullish = bias === 'BULLISH';
    const biasColor = isBullish ? 'text-green-400' : bias === 'BEARISH' ? 'text-red-400' : 'text-yellow-400';

    // Risk Management logic
    const scenario = isBullish ? bullish : bearish;
    const shares = calcPositionSize(currentPrice, scenario.tradePlan.stopLoss);
    const totalValue = shares * currentPrice;

    return (
        <div
            onClick={onClick}
            className={`glass rounded-[32px] p-6 transition-all duration-500 group relative border border-white/5 overflow-hidden ${onClick ? 'cursor-pointer hover:translate-y-[-6px]' : ''
                } ${isBullish
                    ? 'hover:shadow-[0_20px_40px_rgba(34,197,94,0.15)] hover:border-green-500/20'
                    : 'hover:shadow-[0_20px_40px_rgba(239,68,68,0.15)] hover:border-red-500/20'
                }`}
        >
            <div className="absolute top-0 right-0 w-32 h-32 bg-primary-500/5 blur-3xl rounded-full -mr-16 -mt-16 pointer-events-none" />

            <div className="flex justify-between items-start mb-6 relative z-10">
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-2xl font-black tracking-tighter text-white group-hover:text-primary-400 transition-colors uppercase">{stock}</h3>
                        {date && (
                            <div className="flex items-center gap-1 px-2 py-0.5 bg-white/5 rounded-lg border border-white/5 text-[9px] font-bold text-gray-500 uppercase">
                                <Calendar size={10} />
                                {new Date(date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                            </div>
                        )}
                    </div>
                    <p className="text-3xl font-black text-white tracking-tight">{formatPrice(currentPrice)}</p>
                </div>
                <div className="text-right">
                    <div className={`px-3 py-1 rounded-xl text-[10px] font-black uppercase tracking-widest bg-white/5 border border-white/5 ${biasColor}`}>
                        {bias}
                    </div>
                    <div className="mt-1.5 space-y-0.5">
                        <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest">
                            Confidence: <span className="text-primary-400">{confidence}</span>
                        </p>
                        <p className="text-[11px] text-white font-black">{confidenceScore}%</p>
                    </div>
                </div>
            </div>

            <div className="bg-black/40 border border-white/5 rounded-2xl p-4 mb-6 min-h-[70px] flex items-center italic">
                <p className="text-xs text-gray-300 leading-relaxed font-medium">"{recommendation}"</p>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="bg-white/5 p-4 rounded-2xl border border-white/5 group-hover:bg-white/[0.07] transition-colors">
                    <p className="text-[10px] text-gray-500 mb-1.5 uppercase font-black tracking-widest">Bullish Prob</p>
                    <div className="flex items-center justify-between">
                        <span className="text-xl font-black text-green-400">{bullish.probability}%</span>
                        <div className="w-1.5 h-1.5 rounded-full bg-green-500/20" />
                    </div>
                    <div className="mt-2 h-1 bg-white/5 rounded-full overflow-hidden">
                        <div className="h-full bg-green-500/50" style={{ width: `${bullish.probability}%` }} />
                    </div>
                </div>
                <div className="bg-white/5 p-4 rounded-2xl border border-white/5 group-hover:bg-white/[0.07] transition-colors">
                    <p className="text-[10px] text-gray-500 mb-1.5 uppercase font-black tracking-widest">Bearish Prob</p>
                    <div className="flex items-center justify-between">
                        <span className="text-xl font-black text-red-400">{bearish.probability}%</span>
                        <div className="w-1.5 h-1.5 rounded-full bg-red-500/20" />
                    </div>
                    <div className="mt-2 h-1 bg-white/5 rounded-full overflow-hidden">
                        <div className="h-full bg-red-500/50" style={{ width: `${bearish.probability}%` }} />
                    </div>
                </div>
            </div>

            <div className="flex justify-between items-center text-[10px] font-black tracking-widest pt-5 border-t border-white/5 uppercase">
                <div className="flex items-center gap-1.5 text-green-500/60 transition-colors group-hover:text-green-500">
                    <Target size={12} />
                    <span>T1: {formatPrice(bullish.tradePlan.targets[0]?.price)}</span>
                </div>
                <div className="flex items-center gap-1.5 text-red-500/60 transition-colors group-hover:text-red-500">
                    <ShieldAlert size={12} />
                    <span>SL: {formatPrice(scenario.tradePlan.stopLoss)}</span>
                </div>
            </div>

            {onClick && (
                <div className="mt-4 flex items-center justify-center gap-2 text-[10px] font-black uppercase text-primary-500/0 group-hover:text-primary-500 transition-all duration-500">
                    <span>View Detailed Analysis</span>
                    <ArrowRight size={12} />
                </div>
            )}
        </div>
    );
}
