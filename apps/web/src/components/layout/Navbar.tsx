'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Search, History, Settings, TrendingUp, BookOpen, Star } from 'lucide-react';
import { WatchlistPanel } from '../dashboard/WatchlistPanel';
import { useWatchlist } from '@/context/WatchlistContext';

export function Navbar() {
    const [isWatchlistOpen, setIsWatchlistOpen] = useState(false);
    const { watchlist } = useWatchlist();

    return (
        <>
            <nav className="fixed top-0 left-0 right-0 z-[100] border-b border-border bg-background/80 backdrop-blur-xl">
                <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-8">
                        <Link href="/" className="flex items-center gap-2 group">
                            <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center group-hover:bg-primary-500 transition-colors shadow-lg shadow-primary-500/20">
                                <TrendingUp className="text-white" size={18} />
                            </div>
                            <span className="font-bold text-lg tracking-tight text-foreground uppercase italic">STOCK<span className="text-primary-500">ASSIST</span></span>
                        </Link>

                        <div className="hidden md:flex items-center gap-1">
                            <NavLink href="/" icon={<LayoutDashboard size={18} />} label="Dashboard" />
                            <NavLink href="/analyze" icon={<Search size={18} />} label="Scanner" />
                            <NavLink href="/history" icon={<History size={18} />} label="History" />
                            <NavLink href="/journal" icon={<BookOpen size={18} />} label="Journal" />
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => setIsWatchlistOpen(true)}
                            className="p-2 text-muted-foreground hover:text-amber-500 transition-colors relative"
                        >
                            <Star size={20} className={watchlist.length > 0 ? 'text-amber-500' : ''} fill={watchlist.length > 0 ? 'currentColor' : 'none'} />
                            {watchlist.length > 0 && (
                                <span className="absolute -top-1 -right-1 flex items-center justify-center min-w-[16px] h-[16px] px-1 bg-amber-500 rounded-full border-2 border-zinc-950 text-[8px] font-black text-white italic">
                                    {watchlist.length}
                                </span>
                            )}
                        </button>
                        <button className="p-2 text-muted-foreground hover:text-foreground transition-colors">
                            <Settings size={20} />
                        </button>
                        <div className="h-4 w-px bg-border mx-2" />
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-primary-500/10 border border-primary-500/20 flex items-center justify-center text-[10px] font-bold text-primary-500">
                                JD
                            </div>
                        </div>
                    </div>
                </div>
            </nav>
            <WatchlistPanel isOpen={isWatchlistOpen} onClose={() => setIsWatchlistOpen(false)} />
        </>
    );
}

function NavLink({ href, icon, label }: { href: string; icon: React.ReactNode; label: string }) {
    const pathname = usePathname();
    const isActive = pathname === href;

    return (
        <Link
            href={href}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${isActive
                ? 'bg-primary-500/10 text-primary-500'
                : 'text-muted-foreground hover:text-foreground hover:bg-white/[0.03]'
                }`}
        >
            {icon}
            <span>{label}</span>
        </Link>
    );
}
