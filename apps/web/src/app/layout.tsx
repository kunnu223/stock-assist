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
    title: 'Stock Assist - Intelligent Trading Insights',
    description: 'Advanced stock and commodity analysis with multi-horizon trading plans, crash detection, and technical indicators for Indian markets',
    manifest: '/manifest.json',
    appleWebApp: {
        capable: true,
        statusBarStyle: 'black-translucent',
        title: 'Stock Assist',
    },
    icons: {
        icon: '/icon-192.png',
        apple: '/icon-192.png',
    },
    openGraph: {
        type: 'website',
        title: 'Stock Assist - Intelligent Trading Insights',
        description: 'Advanced stock and commodity analysis for Indian markets',
        siteName: 'Stock Assist',
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
