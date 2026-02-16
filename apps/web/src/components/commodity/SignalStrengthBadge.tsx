'use client';

import { Star } from 'lucide-react';

interface SignalStrengthBadgeProps {
    stars: number;
    aligned: number;
    total: number;
    label: string;
    compact?: boolean;
}

const STAR_CONFIG: Record<number, { color: string; bg: string; border: string; glow?: string }> = {
    5: { color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', glow: 'shadow-emerald-500/20' },
    4: { color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/20', glow: 'shadow-blue-500/20' },
    3: { color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20' },
    2: { color: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/20' },
    1: { color: 'text-rose-400', bg: 'bg-rose-500/10', border: 'border-rose-500/20' }
};

export function SignalStrengthBadge({ stars, aligned, total, label, compact }: SignalStrengthBadgeProps) {
    const safeStars = Math.max(1, Math.min(5, stars)) as keyof typeof STAR_CONFIG;
    const config = STAR_CONFIG[safeStars];

    if (compact) {
        return (
            <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider border ${config.bg} ${config.border} ${config.color}`}>
                <div className="flex">
                    {Array.from({ length: 5 }, (_, i) => (
                        <Star
                            key={i}
                            size={8}
                            className={i < safeStars ? config.color : 'text-zinc-700'}
                            fill={i < safeStars ? 'currentColor' : 'none'}
                        />
                    ))}
                </div>
                <span>{aligned}/{total}</span>
            </div>
        );
    }

    return (
        <div className={`rounded-xl border p-3 sm:p-4 ${config.bg} ${config.border} ${config.glow || ''}`}>
            {/* Stars row */}
            <div className="flex items-center justify-between gap-3 mb-2">
                <div className="flex gap-0.5">
                    {Array.from({ length: 5 }, (_, i) => (
                        <Star
                            key={i}
                            size={18}
                            className={`transition-all duration-300 ${i < safeStars ? config.color : 'text-zinc-700'}`}
                            fill={i < safeStars ? 'currentColor' : 'none'}
                            style={{ animationDelay: `${i * 100}ms` }}
                        />
                    ))}
                </div>
                <span className={`text-[10px] font-black uppercase tracking-widest ${config.color}`}>
                    {aligned}/{total} signals
                </span>
            </div>

            {/* Label */}
            <p className={`text-xs sm:text-sm font-bold ${config.color}`}>
                {label}
            </p>
        </div>
    );
}
