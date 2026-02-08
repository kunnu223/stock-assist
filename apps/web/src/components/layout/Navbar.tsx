'use client';

import Link from 'next/link';
import { BarChart3, Search, BookOpen, Settings, Zap } from 'lucide-react';
import { usePathname } from 'next/navigation';

export function Navbar() {
    const pathname = usePathname();

    return (
        <nav className="glass sticky top-0 z-50 border-b border-white/5 shadow-2xl">
            <div className="container mx-auto px-4 py-3 flex items-center justify-between">
                <Link href="/" className="flex items-center space-x-2 group">
                    <div className="bg-primary-500/20 p-2 rounded-xl group-hover:bg-primary-500/30 transition-colors">
                        <Zap className="text-primary-500" size={20} fill="currentColor" />
                    </div>
                    <div className="flex flex-col">
                        <span className="text-xl font-black tracking-tighter text-white">STOCK ASSIST</span>
                        <span className="text-[10px] text-primary-500 font-bold tracking-widest uppercase">Dual Strategy AI</span>
                    </div>
                </Link>

                <div className="hidden md:flex items-center space-x-1 bg-white/[0.03] p-1 rounded-2xl border border-white/5">
                    <NavLink href="/" icon={<BarChart3 size={18} />} label="Dashboard" active={pathname === '/'} />
                    <NavLink href="/analyze" icon={<Search size={18} />} label="Analyze" active={pathname === '/analyze'} />
                    <NavLink href="/journal" icon={<BookOpen size={18} />} label="Journal" active={pathname === '/journal'} />
                    <NavLink href="/settings" icon={<Settings size={18} />} label="Settings" active={pathname === '/settings'} />
                </div>

                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-primary-600 to-purple-600 border border-white/20" />
                </div>
            </div>
        </nav>
    );
}

function NavLink({ href, icon, label, active }: { href: string; icon: React.ReactNode; label: string; active: boolean }) {
    return (
        <Link
            href={href}
            className={`flex items-center space-x-2 px-4 py-2 rounded-xl transition-all duration-300 font-medium ${active
                    ? 'bg-primary-500 text-white shadow-lg shadow-primary-500/20'
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}
        >
            {icon}
            <span>{label}</span>
        </Link>
    );
}
