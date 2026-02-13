'use client';

import { useState } from 'react';
import { Activity, Zap, Shield, Gem, Flame, Droplets, Cpu, CircleDot, Globe, MapPin, Building2 } from 'lucide-react';
import { CommodityResult } from '@/components/commodity/CommodityResult';

interface CommodityOption {
    key: string;
    name: string;
    icon: React.ReactNode;
    color: string;
    bgColor: string;
    borderColor: string;
}

interface ExchangeOption {
    key: string;
    label: string;
    flag: string;
    icon: React.ReactNode;
    description: string;
    color: string;
    bgColor: string;
    borderColor: string;
}

const COMMODITIES: CommodityOption[] = [
    { key: 'GOLD', name: 'Gold', icon: <Gem size={22} />, color: 'text-amber-400', bgColor: 'bg-amber-500/10', borderColor: 'border-amber-500/30' },
    { key: 'SILVER', name: 'Silver', icon: <CircleDot size={22} />, color: 'text-zinc-300', bgColor: 'bg-zinc-400/10', borderColor: 'border-zinc-400/30' },
    { key: 'CRUDEOIL', name: 'Crude Oil', icon: <Droplets size={22} />, color: 'text-rose-400', bgColor: 'bg-rose-500/10', borderColor: 'border-rose-500/30' },
    { key: 'NATURALGAS', name: 'Natural Gas', icon: <Flame size={22} />, color: 'text-sky-400', bgColor: 'bg-sky-500/10', borderColor: 'border-sky-500/30' },
    { key: 'COPPER', name: 'Copper', icon: <Cpu size={22} />, color: 'text-orange-400', bgColor: 'bg-orange-500/10', borderColor: 'border-orange-500/30' },
];

const EXCHANGES: ExchangeOption[] = [
    {
        key: 'COMEX',
        label: 'COMEX',
        flag: '🇺🇸',
        icon: <Globe size={16} />,
        description: 'US Futures (USD)',
        color: 'text-blue-400',
        bgColor: 'bg-blue-500/10',
        borderColor: 'border-blue-500/30',
    },
    {
        key: 'MCX',
        label: 'MCX',
        flag: '🇮🇳',
        icon: <Building2 size={16} />,
        description: 'Indian Futures (INR)',
        color: 'text-orange-400',
        bgColor: 'bg-orange-500/10',
        borderColor: 'border-orange-500/30',
    },
    {
        key: 'SPOT',
        label: 'Spot / Hazar',
        flag: '🏪',
        icon: <MapPin size={16} />,
        description: 'Physical / Spot (INR)',
        color: 'text-emerald-400',
        bgColor: 'bg-emerald-500/10',
        borderColor: 'border-emerald-500/30',
    },
];

export default function CommodityPage() {
    const [selectedCommodity, setSelectedCommodity] = useState<string | null>(null);
    const [selectedExchange, setSelectedExchange] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [data, setData] = useState<any | null>(null);
    const [error, setError] = useState<string | null>(null);

    const handleCommoditySelect = (commodityKey: string) => {
        setSelectedCommodity(commodityKey);
        setSelectedExchange(null);
        setData(null);
        setError(null);
    };

    const handleExchangeSelect = async (exchangeKey: string) => {
        if (!selectedCommodity) return;
        setSelectedExchange(exchangeKey);
        setLoading(true);
        setError(null);
        setData(null);

        try {
            const res = await fetch('/api/analyze/commodity', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ symbol: selectedCommodity, exchange: exchangeKey }),
            });
            const response = await res.json();
            if (response.success) {
                setData(response.data);
            } else {
                setError(response.error || 'Analysis failed');
            }
        } catch (err) {
            console.error('Commodity analysis failed:', err);
            setError('Unable to connect. Please try again.');
        }
        setLoading(false);
    };

    const activeCommodity = COMMODITIES.find(c => c.key === selectedCommodity);
    const activeExchange = EXCHANGES.find(e => e.key === selectedExchange);

    return (
        <div className="space-y-12 max-w-7xl mx-auto px-4 pb-24 pt-10">
            {/* Hero Header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-border pb-10">
                <div className="space-y-4">
                    <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-500 text-[10px] font-black uppercase tracking-widest">
                        <Zap size={12} />
                        <span>Commodity Intelligence</span>
                    </div>
                    <h1 className="text-5xl font-bold text-foreground tracking-tight">
                        Commodity <span className="text-amber-500">Analysis</span>
                    </h1>
                    <p className="text-muted-foreground max-w-xl font-medium">
                        Multi-horizon trading plans with crash detection, seasonality patterns, and macro context — powered by AI. Supports COMEX 🇺🇸, MCX 🇮🇳, and Spot/Hazar 🏪 pricing.
                    </p>
                </div>
                <div className="flex items-center gap-4 text-xs font-bold text-muted-foreground uppercase tracking-widest">
                    <div className="flex items-center gap-2">
                        <Shield size={14} className="text-amber-500" />
                        <span>Multi-Exchange</span>
                    </div>
                    <div className="h-4 w-px bg-border" />
                    <span>USD / INR</span>
                </div>
            </div>

            {/* ── Step 1: Commodity Selector ── */}
            <div className="space-y-4">
                <div className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground px-1 flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center text-[9px] font-black">1</span>
                    Select Commodity
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                    {COMMODITIES.map((commodity) => {
                        const isSelected = selectedCommodity === commodity.key;

                        return (
                            <button
                                key={commodity.key}
                                onClick={() => handleCommoditySelect(commodity.key)}
                                disabled={loading}
                                className={`
                                    relative group flex flex-col items-center gap-3 px-4 py-6 rounded-xl border transition-all duration-300
                                    ${isSelected
                                        ? `${commodity.bgColor} ${commodity.borderColor} shadow-lg`
                                        : 'bg-zinc-950/50 border-border hover:border-zinc-600 hover:bg-zinc-900/50'
                                    }
                                    ${loading ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}
                                    active:scale-95
                                `}
                            >
                                {isSelected && (
                                    <div className={`absolute inset-0 ${commodity.bgColor} rounded-xl blur-xl opacity-30 -z-10`} />
                                )}

                                <div className={`
                                    w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-300
                                    ${isSelected
                                        ? `${commodity.bgColor} ${commodity.color}`
                                        : 'bg-zinc-900 text-zinc-500 group-hover:text-zinc-300'
                                    }
                                `}>
                                    {commodity.icon}
                                </div>

                                <span className={`text-sm font-bold tracking-tight ${isSelected ? commodity.color : 'text-foreground'}`}>
                                    {commodity.name}
                                </span>

                                {isSelected && (
                                    <div className={`absolute -top-1 -right-1 w-3 h-3 rounded-full ${commodity.color.replace('text-', 'bg-')} shadow-lg`} />
                                )}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* ── Step 2: Exchange Selector (shown after commodity selection) ── */}
            {selectedCommodity && (
                <div className="space-y-4 animate-in fade-in slide-in-from-top-4 duration-500">
                    <div className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground px-1 flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center text-[9px] font-black">2</span>
                        Select Exchange for <span className={activeCommodity?.color}>{activeCommodity?.name}</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        {EXCHANGES.map((exchange) => {
                            const isSelected = selectedExchange === exchange.key;
                            const isLoading = loading && isSelected;

                            return (
                                <button
                                    key={exchange.key}
                                    onClick={() => handleExchangeSelect(exchange.key)}
                                    disabled={loading}
                                    className={`
                                        relative group flex items-center gap-4 px-5 py-4 rounded-xl border transition-all duration-300
                                        ${isSelected
                                            ? `${exchange.bgColor} ${exchange.borderColor} shadow-lg`
                                            : 'bg-zinc-950/50 border-border hover:border-zinc-600 hover:bg-zinc-900/50'
                                        }
                                        ${loading && !isSelected ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}
                                        active:scale-95
                                    `}
                                >
                                    {isSelected && (
                                        <div className={`absolute inset-0 ${exchange.bgColor} rounded-xl blur-xl opacity-20 -z-10`} />
                                    )}

                                    <div className={`
                                        w-10 h-10 rounded-lg flex items-center justify-center transition-all duration-300 text-lg
                                        ${isSelected
                                            ? `${exchange.bgColor} ${exchange.color}`
                                            : 'bg-zinc-900 text-zinc-500 group-hover:text-zinc-300'
                                        }
                                    `}>
                                        {isLoading ? <Activity className="animate-spin" size={18} /> : <span>{exchange.flag}</span>}
                                    </div>

                                    <div className="text-left flex-1">
                                        <div className="flex items-center gap-2">
                                            <span className={`text-sm font-bold ${isSelected ? exchange.color : 'text-foreground'}`}>
                                                {exchange.label}
                                            </span>
                                            {isLoading && (
                                                <span className="text-[9px] font-bold text-muted-foreground animate-pulse uppercase tracking-widest">
                                                    Analyzing...
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">{exchange.description}</p>
                                    </div>

                                    {isSelected && !isLoading && (
                                        <div className={`w-2.5 h-2.5 rounded-full ${exchange.color.replace('text-', 'bg-')} shadow-lg`} />
                                    )}
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Error */}
            {error && (
                <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-8 text-center animate-in fade-in zoom-in-95 duration-500">
                    <p className="text-rose-500 font-bold uppercase tracking-widest text-xs mb-2">{error}</p>
                    <button
                        onClick={() => selectedExchange && handleExchangeSelect(selectedExchange)}
                        className="text-amber-500 font-black uppercase tracking-widest text-[10px] border border-amber-500/20 px-4 py-2 rounded hover:bg-amber-500/5 transition-all"
                    >
                        Retry Analysis
                    </button>
                </div>
            )}

            {/* Loading State */}
            {loading && (
                <div className="space-y-6 animate-in fade-in duration-500">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {[1, 2, 3, 4, 5, 6].map(i => (
                            <div key={i} className="premium-card h-64 rounded-xl animate-pulse bg-zinc-900/50 border-border" />
                        ))}
                    </div>
                </div>
            )}

            {/* Results */}
            {data && !loading && (
                <div className="animate-in fade-in slide-in-from-bottom-6 duration-1000">
                    <CommodityResult data={data} accentColor={activeCommodity?.color || 'text-amber-400'} />
                </div>
            )}

            {/* Empty State */}
            {!selectedCommodity && !loading && !error && (
                <div className="py-32 flex flex-col items-center justify-center text-center space-y-8 animate-in fade-in zoom-in-95 duration-700">
                    <div className="w-24 h-24 bg-zinc-900 border border-border rounded-2xl flex items-center justify-center rotate-3 hover:rotate-0 transition-transform duration-500 shadow-premium">
                        <Gem className="text-amber-600/40" size={40} />
                    </div>
                    <div className="space-y-2">
                        <h3 className="text-2xl font-bold text-foreground tracking-tight uppercase">Select a Commodity</h3>
                        <p className="text-muted-foreground font-medium max-w-sm mx-auto">
                            Choose from Gold, Silver, Crude Oil, Natural Gas, or Copper, then select your exchange.
                        </p>
                    </div>
                </div>
            )}

            {/* Exchange-selected but no data yet state */}
            {selectedCommodity && !selectedExchange && !loading && !error && !data && (
                <div className="py-20 flex flex-col items-center justify-center text-center space-y-6 animate-in fade-in zoom-in-95 duration-500">
                    <div className="flex items-center gap-3 text-muted-foreground">
                        <div className="w-8 h-px bg-border" />
                        <Activity className="text-amber-500/50" size={20} />
                        <div className="w-8 h-px bg-border" />
                    </div>
                    <p className="text-muted-foreground font-medium text-sm">
                        Select an exchange above to analyze <span className={activeCommodity?.color + ' font-bold'}>{activeCommodity?.name}</span>
                    </p>
                </div>
            )}
        </div>
    );
}
