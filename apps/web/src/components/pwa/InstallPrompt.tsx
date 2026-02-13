'use client';

import { useState, useEffect } from 'react';
import { Download, X } from 'lucide-react';

export function InstallPrompt() {
    const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        const handler = (e: any) => {
            e.preventDefault();
            setDeferredPrompt(e);
            setIsVisible(true);
        };

        window.addEventListener('beforeinstallprompt', handler);

        return () => {
            window.removeEventListener('beforeinstallprompt', handler);
        };
    }, []);

    const handleInstall = async () => {
        if (!deferredPrompt) return;

        deferredPrompt.prompt();

        const { outcome } = await deferredPrompt.userChoice;

        if (outcome === 'accepted') {
            setDeferredPrompt(null);
            setIsVisible(false);
        }
    };

    if (!isVisible) return null;

    return (
        <div className="fixed bottom-20 left-4 right-4 z-50 animate-in slide-in-from-bottom-5 fade-in duration-300">
            <div className="bg-zinc-900/90 backdrop-blur-md border border-primary-500/20 rounded-xl p-4 shadow-xl shadow-black/50 ring-1 ring-white/10 flex items-center justify-between gap-4">
                <div className="flex-1">
                    <h3 className="text-sm font-semibold text-primary-50 mb-1">Install App</h3>
                    <p className="text-xs text-zinc-400">
                        Add to home screen for faster access
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={handleInstall}
                        className="bg-primary-600 hover:bg-primary-500 text-white text-xs font-semibold py-2 px-3 rounded-lg flex items-center gap-1.5 transition-colors shadow-lg shadow-primary-500/20"
                    >
                        <Download size={14} />
                        Install
                    </button>
                    <button
                        onClick={() => setIsVisible(false)}
                        className="text-zinc-500 hover:text-inventory-red p-1.5 rounded-lg hover:bg-white/5 transition-colors"
                    >
                        <X size={16} />
                    </button>
                </div>
            </div>
        </div>
    );
}
