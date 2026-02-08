import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Navbar } from '@/components/layout/Navbar';

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
            <body className={`${inter.className} gradient-bg min-h-screen`}>
                <Navbar />
                <main className="container mx-auto px-4 py-6">
                    {children}
                </main>
            </body>
        </html>
    );
}
