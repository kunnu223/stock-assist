'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export const SplashScreen = () => {
    const [showSplash, setShowSplash] = useState(true);

    useEffect(() => {
        // Check session storage immediately
        const hasSeenSplash = sessionStorage.getItem('hasSeenSplash');

        // If already seen, hide IMMEDIATELY
        if (hasSeenSplash) {
            setShowSplash(false);
            return;
        }

        // Otherwise, it stays true, then hides after delay
        const timer = setTimeout(() => {
            setShowSplash(false);
            sessionStorage.setItem('hasSeenSplash', 'true');
        }, 2000); // 2 seconds simple splash

        return () => clearTimeout(timer);
    }, []);

    if (!showSplash) return null;

    return (
        <motion.div
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-black"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
        >
            <div className="flex flex-col items-center">
                <div className="flex items-center gap-3">
                    <span className="text-4xl font-bold text-white tracking-widest">STOCK</span>
                    <span className="text-4xl font-bold text-amber-500 tracking-widest">ASSIST</span>
                </div>
                <div className="mt-4 h-0.5 w-24 bg-zinc-800 overflow-hidden">
                    <motion.div
                        className="h-full bg-amber-500"
                        initial={{ x: "-100%" }}
                        animate={{ x: "100%" }}
                        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                    />
                </div>
            </div>
        </motion.div>
    );
};
