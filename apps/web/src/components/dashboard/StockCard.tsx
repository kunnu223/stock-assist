'use client';

import type { StockAnalysis } from '@stock-assist/shared';
import { Target, ShieldAlert, Calculator } from 'lucide-react';
import { calcPositionSize, formatPrice } from '@stock-assist/shared';

interface Props {
    analysis: StockAnalysis;
}

export function StockCard({ analysis }: Props) {
    const { stock, currentPrice, bias, confidence, confidenceScore, recommendation, bullish, bearish } = analysis;

    const isBullish = bias === 'BULLISH';
    const biasColor = isBullish ? 'text-bullish' : bias === 'BEARISH' ? 'text-bearish' : 'text-neutral';

    // Risk Management: Calculate shares for ₹500 risk based on the primary bias scenario
    const scenario = isBullish ? bullish : bearish;
    const shares = calcPositionSize(currentPrice, scenario.tradePlan.stopLoss);
    const totalValue = shares * currentPrice;

    return (
        <div className={`glass rounded-2xl p-5 hover:translate-y-[-4px] transition-all duration-300 group ${isBullish ? 'hover:shadow-[0_0_30px_rgba(34,197,94,0.15)]' : 'hover:shadow-[0_0_30px_rgba(239,68,68,0.15)]'
            }`}>
            <div className="flex justify-between items-start mb-4">
                <div>
                    <h3 className="text-xl font-bold tracking-tight group-hover:text-primary-400 transition-colors">{stock}</h3>
                    <p className="text-2xl font-black text-white">{formatPrice(currentPrice)}</p>
                </div>
                <div className="text-right">
                    <div className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-white/5 ${biasColor} border border-current/20`}>
                        {bias}
                    </div>
                    <p className="text-[10px] text-gray-500 mt-1 uppercase tracking-widest font-bold">
                        {confidence} ({confidenceScore}%)
                    </p>
                </div>
            </div>

            <div className="bg-white/[0.03] border border-white/5 rounded-xl p-3 mb-4 min-h-[60px] flex items-center">
                <p className="text-sm text-gray-300 leading-relaxed italic">"{recommendation}"</p>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-5">
                <div className="bg-white/[0.03] p-3 rounded-xl border border-white/5">
                    <p className="text-[10px] text-gray-500 mb-1 uppercase font-bold">Recommended Qty</p>
                    <div className="flex items-center gap-2 text-white font-bold">
                        <Calculator size={14} className="text-primary-500" />
                        {shares} <span className="text-xs text-gray-400 font-normal">Shares</span>
                    </div>
                </div>
                <div className="bg-white/[0.03] p-3 rounded-xl border border-white/5">
                    <p className="text-[10px] text-gray-500 mb-1 uppercase font-bold">Max Capital</p>
                    <p className="text-white font-bold">{formatPrice(totalValue)}</p>
                </div>
            </div>

            <div className="flex justify-between items-center text-xs font-medium pt-4 border-t border-white/10">
                <div className="flex items-center gap-1.5 text-bullish/90">
                    <Target size={14} />
                    <span>T1: {formatPrice(bullish.tradePlan.targets[0]?.price)}</span>
                </div>
                <div className="flex items-center gap-1.5 text-bearish/90 font-bold">
                    <ShieldAlert size={14} />
                    <span>SL: {formatPrice(scenario.tradePlan.stopLoss)}</span>
                </div>
            </div>

            <div className="mt-3 flex gap-2">
                <div className="flex-1 h-1 bg-white/5 rounded-full overflow-hidden">
                    <div
                        className="h-full bg-bullish transition-all duration-500"
                        style={{ width: `${bullish.probability}%` }}
                    />
                </div>
                <div className="flex-1 h-1 bg-white/5 rounded-full overflow-hidden">
                    <div
                        className="h-full bg-bearish transition-all duration-500"
                        style={{ width: `${bearish.probability}%` }}
                    />
                </div>
            </div>
        </div>
    );
}
