'use client';

import { useState, useEffect, useMemo } from 'react';
import { Calculator, ChevronDown, ChevronUp } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';

interface PositionSizerProps {
    entry: number[];        // [low, high]
    stopLoss: number;
    target: number;
    commodity: string;      // 'GOLD', 'SILVER', etc.
    exchange: string;       // 'MCX', 'COMEX', 'SPOT'
    currencySymbol: string;
    isINR: boolean;
}

// MCX lot sizes
const MCX_LOTS: Record<string, { big: number; bigLabel: string; mini: number; miniLabel: string; unit: string }> = {
    GOLD: { big: 100, bigLabel: '100g', mini: 10, miniLabel: '10g', unit: 'g' },
    SILVER: { big: 30000, bigLabel: '30kg', mini: 5000, miniLabel: '5kg', unit: 'g' },
    CRUDEOIL: { big: 100, bigLabel: '100 bbl', mini: 10, miniLabel: '10 bbl', unit: 'bbl' },
    NATURALGAS: { big: 1250, bigLabel: '1250 MMBtu', mini: 250, miniLabel: '250 MMBtu', unit: 'MMBtu' },
    COPPER: { big: 2500, bigLabel: '2500 kg', mini: 1000, miniLabel: '1000 kg', unit: 'kg' },
};

const STORAGE_KEY = 'stock-assist-capital';
const RISK_STORAGE_KEY = 'stock-assist-risk-pct';

export function PositionSizer({ entry, stopLoss, target, commodity, exchange, currencySymbol, isINR }: PositionSizerProps) {
    const [capital, setCapital] = useState<number>(500000);
    const [riskPct, setRiskPct] = useState<number>(2);
    const [isOpen, setIsOpen] = useState<boolean>(false);
    const { t } = useLanguage();

    // Load from localStorage
    useEffect(() => {
        const savedCapital = localStorage.getItem(STORAGE_KEY);
        const savedRisk = localStorage.getItem(RISK_STORAGE_KEY);
        if (savedCapital) setCapital(Number(savedCapital));
        if (savedRisk) setRiskPct(Number(savedRisk));
    }, []);

    // Save to localStorage
    useEffect(() => {
        localStorage.setItem(STORAGE_KEY, String(capital));
    }, [capital]);

    useEffect(() => {
        localStorage.setItem(RISK_STORAGE_KEY, String(riskPct));
    }, [riskPct]);

    const calculations = useMemo(() => {
        const entryPrice = (entry[0] + entry[1]) / 2;
        const riskPerUnit = Math.abs(entryPrice - stopLoss);
        const rewardPerUnit = Math.abs(target - entryPrice);

        if (riskPerUnit === 0) return null;

        const maxRiskAmount = capital * (riskPct / 100);
        const positionUnits = Math.floor(maxRiskAmount / riskPerUnit);
        const maxLoss = positionUnits * riskPerUnit;
        const potentialProfit = positionUnits * rewardPerUnit;
        const riskRewardRatio = rewardPerUnit / riskPerUnit;

        // MCX lot calculation
        const isMCX = exchange === 'MCX' || exchange === 'SPOT';
        const lotInfo = isMCX ? MCX_LOTS[commodity] : null;
        let miniLots = 0;
        let bigLots = 0;
        let actualUnits = positionUnits;

        if (lotInfo) {
            miniLots = Math.floor(positionUnits / lotInfo.mini);
            bigLots = Math.floor(positionUnits / lotInfo.big);
            // Use mini lots (more accessible for retail traders)
            actualUnits = miniLots * lotInfo.mini;
        }

        return {
            entryPrice,
            riskPerUnit,
            rewardPerUnit,
            maxRiskAmount,
            positionUnits,
            actualUnits,
            maxLoss: Math.round(maxLoss),
            potentialProfit: Math.round(potentialProfit),
            riskRewardRatio,
            lotInfo,
            miniLots,
            bigLots,
            isMCX,
        };
    }, [capital, riskPct, entry, stopLoss, target, commodity, exchange]);

    const fmtPrice = (v: number) => isINR ? `${currencySymbol}${Math.round(v).toLocaleString('en-IN')}` : `${currencySymbol}${v.toFixed(2)}`;

    if (!calculations) return null;

    return (
        <div className="premium-card rounded-xl bg-zinc-950/50 border-border overflow-hidden">
            {/* Toggle header */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex items-center justify-between p-4 sm:p-5 hover:bg-zinc-900/50 transition-colors"
            >
                <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-violet-500/15 border border-violet-500/20 flex items-center justify-center">
                        <Calculator size={16} className="text-violet-400" />
                    </div>
                    <div className="text-left">
                        <span className="text-xs sm:text-sm font-bold text-foreground">Position Sizing</span>
                        <p className="text-[9px] sm:text-[10px] text-muted-foreground font-medium">
                            Risk: {riskPct}% • Max Loss: {fmtPrice(calculations.maxRiskAmount)}
                        </p>
                    </div>
                </div>
                {isOpen ? <ChevronUp size={16} className="text-muted-foreground" /> : <ChevronDown size={16} className="text-muted-foreground" />}
            </button>

            {/* Expanded content */}
            {isOpen && (
                <div className="px-4 sm:px-5 pb-4 sm:pb-5 space-y-4 border-t border-border pt-4">
                    {/* Inputs */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {/* Capital */}
                        <div>
                            <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1 block">
                                Your Capital
                            </label>
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground font-bold">{currencySymbol}</span>
                                <input
                                    type="number"
                                    value={capital}
                                    onChange={(e) => setCapital(Math.max(0, Number(e.target.value)))}
                                    className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 pl-7 text-sm text-foreground font-bold focus:outline-none focus:border-violet-500/50 transition-colors"
                                />
                            </div>
                        </div>

                        {/* Risk % */}
                        <div>
                            <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1 block">
                                Risk Per Trade: {riskPct}%
                            </label>
                            <input
                                type="range"
                                min={0.5}
                                max={5}
                                step={0.5}
                                value={riskPct}
                                onChange={(e) => setRiskPct(Number(e.target.value))}
                                className="w-full accent-violet-500 mt-2"
                            />
                            <div className="flex justify-between text-[8px] text-muted-foreground font-bold mt-0.5">
                                <span>0.5% (Safe)</span>
                                <span>2% (Standard)</span>
                                <span>5% (Aggressive)</span>
                            </div>
                        </div>
                    </div>

                    {/* Results Grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        <div className="bg-zinc-900/60 border border-zinc-800 rounded-lg p-2.5 text-center">
                            <p className="text-[8px] text-muted-foreground font-bold uppercase tracking-widest mb-0.5">Max Risk</p>
                            <p className="text-sm font-black text-rose-400">{fmtPrice(calculations.maxRiskAmount)}</p>
                        </div>
                        <div className="bg-zinc-900/60 border border-zinc-800 rounded-lg p-2.5 text-center">
                            <p className="text-[8px] text-muted-foreground font-bold uppercase tracking-widest mb-0.5">Potential Profit</p>
                            <p className="text-sm font-black text-emerald-400">{fmtPrice(calculations.potentialProfit)}</p>
                        </div>
                        <div className="bg-zinc-900/60 border border-zinc-800 rounded-lg p-2.5 text-center">
                            <p className="text-[8px] text-muted-foreground font-bold uppercase tracking-widest mb-0.5">Risk : Reward</p>
                            <p className={`text-sm font-black ${calculations.riskRewardRatio >= 2 ? 'text-emerald-400' : calculations.riskRewardRatio >= 1 ? 'text-amber-400' : 'text-rose-400'}`}>
                                1 : {calculations.riskRewardRatio.toFixed(1)}
                            </p>
                        </div>
                        <div className="bg-zinc-900/60 border border-zinc-800 rounded-lg p-2.5 text-center">
                            <p className="text-[8px] text-muted-foreground font-bold uppercase tracking-widest mb-0.5">Quantity</p>
                            <p className="text-sm font-black text-violet-400">
                                {calculations.isMCX && calculations.lotInfo
                                    ? `${calculations.miniLots} mini`
                                    : `${calculations.positionUnits} units`
                                }
                            </p>
                        </div>
                    </div>

                    {/* MCX Lot Info */}
                    {calculations.isMCX && calculations.lotInfo && (
                        <div className="bg-violet-500/8 border border-violet-500/15 rounded-lg p-3">
                            <p className="text-[10px] font-bold text-violet-400 uppercase tracking-wider mb-2">MCX Lot Sizing</p>
                            <div className="grid grid-cols-2 gap-2 text-xs">
                                <div>
                                    <span className="text-muted-foreground">Mini lot: </span>
                                    <span className="font-bold text-foreground">{calculations.lotInfo.miniLabel}</span>
                                    <span className="text-muted-foreground"> × </span>
                                    <span className="font-bold text-violet-400">{calculations.miniLots} lots</span>
                                </div>
                                <div>
                                    <span className="text-muted-foreground">Big lot: </span>
                                    <span className="font-bold text-foreground">{calculations.lotInfo.bigLabel}</span>
                                    <span className="text-muted-foreground"> × </span>
                                    <span className="font-bold text-violet-400">{calculations.bigLots} lots</span>
                                </div>
                            </div>
                            <p className="text-[9px] text-muted-foreground mt-2">
                                Max loss if SL hits: {fmtPrice(calculations.maxLoss)} ({(calculations.maxLoss / capital * 100).toFixed(1)}% of capital)
                            </p>
                        </div>
                    )}

                    {/* Warning for high risk */}
                    {riskPct > 3 && (
                        <p className="text-[10px] text-amber-400 font-bold">
                            ⚠️ Risking more than 3% per trade is aggressive. Professional traders typically risk 1-2%.
                        </p>
                    )}
                </div>
            )}
        </div>
    );
}
