'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export const SplashScreen = () => {
    const [isVisible, setIsVisible] = useState(true);

    useEffect(() => {
        // Check if splash has already been shown in this session
        const hasSeenSplash = sessionStorage.getItem('hasSeenSplash');

        if (hasSeenSplash) {
            setIsVisible(false);
            return;
        }

        // Show splash and mark as seen
        const timer = setTimeout(() => {
            setIsVisible(false);
            sessionStorage.setItem('hasSeenSplash', 'true');
        }, 2500);

        return () => clearTimeout(timer);
    }, []);

    return (
        <AnimatePresence>
            {isVisible && (
                <motion.div
                    className="fixed inset-0 z-[9999] flex items-center justify-center bg-black overflow-hidden"
                    initial={{ opacity: 1 }}
                    exit={{ opacity: 0, pointerEvents: 'none' }}
                    transition={{ duration: 0.8, ease: "easeInOut" }}
                >
                    {/* Left Door Panel */}
                    <motion.div
                        className="absolute left-0 top-0 h-full w-1/2 bg-zinc-950 border-r border-zinc-900 shadow-2xl z-20"
                        initial={{ x: 0 }}
                        exit={{ x: '-100%' }}
                        transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1], delay: 1.5 }}
                    >
                        <div className="absolute right-0 top-1/2 -translate-y-1/2 w-[2px] h-32 bg-gradient-to-b from-transparent via-amber-500/50 to-transparent" />
                    </motion.div>

                    {/* Right Door Panel */}
                    <motion.div
                        className="absolute right-0 top-0 h-full w-1/2 bg-zinc-950 border-l border-zinc-900 shadow-2xl z-20"
                        initial={{ x: 0 }}
                        exit={{ x: '100%' }}
                        transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1], delay: 1.5 }}
                    >
                        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[2px] h-32 bg-gradient-to-b from-transparent via-amber-500/50 to-transparent" />
                    </motion.div>

                    {/* Content Behind Doors (visible quickly as doors open) */}
                    {/* Center Text Animation */}
                    <div className="relative z-30 flex flex-col items-center justify-center h-full">
                        <div className="flex items-center gap-4 overflow-hidden">
                            <motion.div
                                initial={{ x: 100, opacity: 0 }}
                                animate={{ x: 0, opacity: 1 }}
                                exit={{ x: -100, opacity: 0 }}
                                transition={{ duration: 0.8, ease: "easeOut", delay: 0.2 }}
                            >
                                <span className="text-4xl md:text-6xl font-black text-white tracking-widest">STOCK</span>
                            </motion.div>

                            <motion.div
                                initial={{ x: -100, opacity: 0 }}
                                animate={{ x: 0, opacity: 1 }}
                                exit={{ x: 100, opacity: 0 }}
                                transition={{ duration: 0.8, ease: "easeOut", delay: 0.2 }}
                            >
                                <span className="text-4xl md:text-6xl font-black text-amber-500 tracking-widest">ASSIST</span>
                            </motion.div>
                        </div>

                        <motion.div
                            initial={{ y: 20, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.5, delay: 0.8 }}
                            className="mt-4"
                        >
                            <p className="text-zinc-500 text-sm md:text-base tracking-[0.3em] uppercase">
                                Intelligent Trading Insights
                            </p>
                        </motion.div>

                        {/* Elegant Loading Line */}
                        <motion.div
                            className="w-32 h-[2px] bg-zinc-900 mt-12 overflow-hidden relative"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 1 }}
                        >
                            <motion.div
                                className="absolute left-0 top-0 bottom-0 bg-gradient-to-r from-transparent via-amber-500 to-transparent w-full"
                                initial={{ x: "-100%" }}
                                animate={{ x: "100%" }}
                                transition={{ duration: 1.5, ease: "easeInOut", repeat: Infinity }}
                            />
                        </motion.div>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};
