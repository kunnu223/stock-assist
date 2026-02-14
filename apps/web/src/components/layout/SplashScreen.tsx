'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export const SplashScreen = () => {
    const [isVisible, setIsVisible] = useState(true);

    useEffect(() => {
        // Show splash for 2.5 seconds
        const timer = setTimeout(() => {
            setIsVisible(false);
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
                    {/* Center Logo Animation */}
                    <div className="relative z-30 flex flex-col items-center gap-6">
                        <motion.div
                            initial={{ scale: 0.8, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 1.1, opacity: 0 }}
                            transition={{ duration: 0.5, delay: 0.2 }}
                            className="relative"
                        >
                            {/* Glowing Orb/Logo */}
                            <div className="w-24 h-24 rounded-full bg-gradient-to-tr from-amber-600 to-yellow-400 blur-2xl opacity-20 absolute inset-0 animate-pulse" />
                            <div className="w-24 h-24 relative flex items-center justify-center">
                                <svg
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    className="w-16 h-16 text-amber-500"
                                    stroke="currentColor"
                                    strokeWidth="1.5"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z"
                                    />
                                </svg>
                            </div>
                        </motion.div>

                        <motion.div
                            initial={{ y: 20, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.5, delay: 0.4 }}
                            className="text-center"
                        >
                            <h1 className="text-2xl font-bold text-white tracking-widest uppercase">
                                Stock Assist
                            </h1>
                            <p className="text-zinc-500 text-sm mt-2 tracking-wider">
                                Intelligent Trading Insights
                            </p>
                        </motion.div>

                        {/* Loading Bar */}
                        <motion.div
                            className="w-48 h-1 bg-zinc-800 rounded-full mt-8 overflow-hidden relative"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 0.6 }}
                        >
                            <motion.div
                                className="absolute left-0 top-0 bottom-0 bg-amber-500"
                                initial={{ width: "0%" }}
                                animate={{ width: "100%" }}
                                transition={{ duration: 1.5, ease: "easeInOut", delay: 0.6 }}
                            />
                        </motion.div>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};
