'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Search, History, BookOpen, Gem } from 'lucide-react';

export function BottomNav() {
    const pathname = usePathname();

    const navItems = [
        {
            href: '/',
            label: 'Home',
            icon: LayoutDashboard,
        },
        {
            href: '/analyze',
            label: 'Scanner',
            icon: Search,
        },
        {
            href: '/commodity',
            label: 'Commodity',
            icon: Gem,
        },
        {
            href: '/history',
            label: 'History',
            icon: History,
        },
        {
            href: '/journal',
            label: 'Journal',
            icon: BookOpen,
        },
    ];

    return (
        <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-xl border-t border-border pb-[env(safe-area-inset-bottom)]">
            <div className="flex items-center justify-around h-16">
                {navItems.map((item) => {
                    const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
                    const Icon = item.icon;

                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={`flex flex-col items-center justify-center w-full h-full gap-1 transition-all duration-200 ${isActive
                                    ? "text-primary-500"
                                    : "text-muted-foreground hover:text-foreground"
                                }`}
                        >
                            <div className={`relative p-1.5 rounded-xl transition-all duration-200 ${isActive ? "bg-primary-500/10 scale-110" : ""
                                }`}>
                                <Icon size={20} strokeWidth={isActive ? 2.5 : 2} />
                            </div>
                            <span className={`text-[10px] font-medium transition-all duration-200 ${isActive ? "scale-105 font-semibold" : "opacity-80"
                                }`}>
                                {item.label}
                            </span>
                        </Link>
                    );
                })}
            </div>
        </div>
    );
}
