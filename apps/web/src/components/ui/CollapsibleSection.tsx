'use client';

import { useState, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';

interface CollapsibleSectionProps {
    title: string;
    subtitle?: string;
    icon?: ReactNode;
    badge?: ReactNode;
    defaultOpen?: boolean;
    children: ReactNode;
    /** Accent color class for the icon background, e.g. 'bg-blue-500/10' */
    iconBg?: string;
    /** Full-width spanning for grid layouts */
    fullWidth?: boolean;
}

export function CollapsibleSection({
    title,
    subtitle,
    icon,
    badge,
    defaultOpen = false,
    children,
    iconBg = 'bg-zinc-800/50',
    fullWidth = false,
}: CollapsibleSectionProps) {
    const [isOpen, setIsOpen] = useState(defaultOpen);

    return (
        <div className={`premium-card rounded-xl bg-zinc-950/50 border-border overflow-hidden ${fullWidth ? 'lg:col-span-2' : ''}`}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-full p-4 sm:p-6 flex items-center justify-between gap-3 hover:bg-zinc-900/30 transition-colors duration-200"
                type="button"
            >
                <div className="flex items-center gap-3">
                    {icon && (
                        <div className={`w-8 h-8 rounded-lg ${iconBg} flex items-center justify-center flex-shrink-0`}>
                            {icon}
                        </div>
                    )}
                    <div className="text-left">
                        <h3 className="text-sm font-bold text-foreground uppercase tracking-wider">{title}</h3>
                        {subtitle && <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">{subtitle}</p>}
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    {badge}
                    <ChevronDown
                        size={16}
                        className={`text-muted-foreground transition-transform duration-300 flex-shrink-0 ${isOpen ? 'rotate-180' : ''}`}
                    />
                </div>
            </button>
            <div
                className={`transition-all duration-300 ease-in-out overflow-hidden ${isOpen ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'}`}
            >
                <div className="p-4 sm:p-6 pt-0 sm:pt-0 border-t border-border">
                    {children}
                </div>
            </div>
        </div>
    );
}
