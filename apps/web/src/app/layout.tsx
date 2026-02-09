import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Navbar } from '@/components/layout/Navbar';
import { WatchlistProvider } from '@/context/WatchlistContext';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
    title: 'Stock Assist - AI Trading Assistant',
    description: 'Dual Strategy Trading Analysis for 70%+ Win Rate',
};

export default function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <html lang="en">
            <body className={`${inter.className} bg-background text-foreground min-h-screen selection:bg-primary-500/30`}>
                <WatchlistProvider>
                    <Navbar />
                    <main className="pt-24 pb-12">
                        {children}
                    </main>
                </WatchlistProvider>
            </body>
        </html>
    );
}
