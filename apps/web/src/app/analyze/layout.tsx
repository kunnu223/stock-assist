import { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'Stock Scanner',
    description: 'Real-time intelligent stock scanner for NSE/BSE markets. Analyze patterns, sentiment, and fundamentals instantly.',
    keywords: ['Stock Scanner India', 'AI Stock Analysis', 'Nifty 50 Screener', 'Intraday Trading Tools'],
};

export default function AnalyzeLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return <>{children}</>;
}
