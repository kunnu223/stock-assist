import { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'Commodity Analysis',
    description: 'Advanced multi-horizon trading plans for Gold, Silver, Crude Oil, and Natural Gas with crash detection and seasonality analysis.',
    keywords: ['Commodity Trading', 'Gold Price India', 'Silver Futures', 'MCX Trading', 'Crude Oil Analysis'],
};

export default function CommodityLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return <>{children}</>;
}
