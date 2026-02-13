'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { translations, Language } from '../utils/translations';

interface LanguageContextType {
    language: Language;
    setLanguage: (lang: Language) => void;
    t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
    const [language, setLanguage] = useState<Language>('en');

    // Load saved language from local storage on mount
    useEffect(() => {
        const saved = localStorage.getItem('stock-assist-lang') as Language;
        if (saved && (saved === 'en' || saved === 'hi')) {
            setLanguage(saved);
        }
    }, []);

    // Save language change to local storage
    const handleSetLanguage = (lang: Language) => {
        setLanguage(lang);
        localStorage.setItem('stock-assist-lang', lang);
    };

    // Translation helper function
    // Usage: t('nav.dashboard') -> "Dashboard" or "डैशबोर्ड"
    const t = (path: string): string => {
        const keys = path.split('.');
        let current: any = translations;

        for (const key of keys) {
            if (current[key] === undefined) {
                console.warn(`Translation key missing: ${path}`);
                return path;
            }
            current = current[key];
        }

        return current[language] || path;
    };

    return (
        <LanguageContext.Provider value={{ language, setLanguage: handleSetLanguage, t }}>
            {children}
        </LanguageContext.Provider>
    );
}

export function useLanguage() {
    const context = useContext(LanguageContext);
    if (context === undefined) {
        throw new Error('useLanguage must be used within a LanguageProvider');
    }
    return context;
}
