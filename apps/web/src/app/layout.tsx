import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Navbar } from '@/components/layout/Navbar';
import { BottomNav } from '@/components/layout/BottomNav';
import { InstallPrompt } from '@/components/pwa/InstallPrompt';
import { WatchlistProvider } from '@/context/WatchlistContext';
import Script from 'next/script';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
    title: {
        default: 'Stock Assist - Intelligent Trading Insights',
        template: '%s | Stock Assist',
    },
    description: 'Advanced stock and commodity analysis for Indian markets. AI-powered Nifty 50 screener, Gold/Silver price analysis, and multi-horizon trading plans.',
    keywords: [
        'Stock Analysis India', 'Nifty 50 Screener', 'Bank Nifty Analysis',
        'Commodity Trading Signals', 'Gold Price India', 'Silver Price Analysis',
        'Intelligent Trading Tools', 'Stock Market AI', 'Technical Analysis India'
    ],
    authors: [{ name: 'Stock Assist Team' }],
    creator: 'Stock Assist',
    publisher: 'Stock Assist',
    category: 'Finance',
    formatDetection: {
        email: false,
        address: false,
        telephone: false,
    },
    manifest: '/manifest.json',
    appleWebApp: {
        capable: true,
        statusBarStyle: 'black-translucent',
        title: 'Stock Assist',
    },
    openGraph: {
        type: 'website',
        locale: 'en_IN',
        url: 'https://stock-assist.app',
        title: 'Stock Assist - Intelligent Trading Insights',
        description: 'Advanced stock and commodity analysis for Indian markets. Real-time Nifty 50 screener and multi-horizon trading plans.',
        siteName: 'Stock Assist',
        images: [
            {
                url: '/og-image.png',
                width: 1200,
                height: 630,
                alt: 'Stock Assist Dashboard',
            },
        ],
    },
    twitter: {
        card: 'summary_large_image',
        title: 'Stock Assist - Intelligent Trading Insights',
        description: 'Advanced stock and commodity analysis for Indian markets.',
        images: ['/og-image.png'],
        creator: '@StockAssist',
    },
    robots: {
        index: true,
        follow: true,
        googleBot: {
            index: true,
            follow: true,
            'max-video-preview': -1,
            'max-image-preview': 'large',
            'max-snippet': -1,
        },
    },
};

export const viewport: Viewport = {
    width: 'device-width',
    initialScale: 1,
    maximumScale: 5,
    userScalable: true,
    themeColor: '#f59e0b',
};

export default function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <html lang="en">
            <head>
                <link rel="manifest" href="/manifest.json" />
                <meta name="mobile-web-app-capable" content="yes" />
                <meta name="apple-mobile-web-app-capable" content="yes" />
                <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
                <meta name="apple-mobile-web-app-title" content="Stock Assist" />
            </head>
            <body className={`${inter.className} bg-background text-foreground min-h-screen selection:bg-primary-500/30`}>
                <script
                    type="application/ld+json"
                    dangerouslySetInnerHTML={{
                        __html: JSON.stringify({
                            '@context': 'https://schema.org',
                            '@type': 'SoftwareApplication',
                            name: 'Stock Assist',
                            applicationCategory: 'FinanceApplication',
                            operatingSystem: 'Any',
                            offers: {
                                '@type': 'Offer',
                                price: '0',
                                priceCurrency: 'INR',
                            },
                            author: {
                                '@type': 'Organization',
                                name: 'Stock Assist Team',
                                url: 'https://stock-assist.app',
                            },
                        }),
                    }}
                />
                <WatchlistProvider>
                    <Navbar />
                    <main className="pt-20 sm:pt-24 pb-28 sm:pb-12 px-4 sm:px-6">
                        {children}
                    </main>
                    <InstallPrompt />
                    <BottomNav />
                </WatchlistProvider>

                {/* Service Worker Registration */}
                <Script id="sw-register" strategy="afterInteractive">
                    {`
                        if ('serviceWorker' in navigator) {
                            window.addEventListener('load', () => {
                                navigator.serviceWorker.register('/sw.js')
                                    .then((registration) => {
                                        console.log('✅ Service Worker registered:', registration.scope);
                                    })
                                    .catch((error) => {
                                        console.log('❌ Service Worker registration failed:', error);
                                    });
                            });
                        }
                    `}
                </Script>
            </body>
        </html>
    );
}
