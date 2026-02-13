export type Language = 'en' | 'hi';

export const translations = {
    nav: {
        dashboard: {
            en: 'Dashboard',
            hi: 'डैशबोर्ड'
        },
        scanner: {
            en: 'Scanner',
            hi: 'स्कैनर'
        },
        commodity: {
            en: 'Commodity',
            hi: 'कमोडिटी'
        },
        history: {
            en: 'History',
            hi: 'इतिहास'
        },
        journal: {
            en: 'Journal',
            hi: 'जर्नल'
        }
    },
    analyze: {
        title: {
            en: 'Market',
            hi: 'बाज़ार'
        },
        subtitle: {
            en: 'X-Ray',
            hi: 'एक्स-रे'
        },
        description: {
            en: 'Stop guessing. Scan any stock to reveal hidden patterns, risks, and true market direction instantly.',
            hi: 'अनुमान लगाना बंद करें। किसी भी स्टॉक को स्कैन करें और छिपे हुए पैटर्न, जोखिम और बाज़ार की सही दिशा तुरंत जानें।'
        },
        liveScan: {
            en: 'Live Scan',
            hi: 'लाइव स्कैन'
        },
        patternVerified: {
            en: 'Pattern Verified',
            hi: 'पैटर्न सत्यापित'
        },
        precision: {
            en: 'LLM-4 Precision',
            hi: 'LLM-4 सटीकता'
        },
        placeholder: {
            en: 'Enter Instrument Symbol (e.g., RELIANCE)',
            hi: 'स्टॉक सिंबल दर्ज करें (जैसे RELIANCE)'
        },
        execute: {
            en: 'Execute Scan',
            hi: 'स्कैन शुरू करें'
        },
        support: {
            en: 'Support for NSE, BSE, and Global Exchanges via Yahoo Finance API',
            hi: 'याहू फाइनेंस एपीआई के माध्यम से एनएसई, बीएसई और वैश्विक एक्सचेंजों के लिए समर्थन'
        },
        ready: {
            en: 'Ready for Deployment',
            hi: 'तैनाती के लिए तैयार'
        },
        readyDesc: {
            en: 'Input a ticker symbol above to generate a comprehensive institutional-grade market report.',
            hi: 'संस्थागत-स्तर की विस्तृत बाज़ार रिपोर्ट बनाने के लिए ऊपर एक टिकर सिंबल दर्ज करें।'
        }
    },
    commodity: {
        badge: {
            en: 'Strategic Outlook',
            hi: 'रणनीतिक दृष्टिकोण'
        },
        pageTitle: {
            en: 'Commodity',
            hi: 'कमोडिटी'
        },
        pageSubtitle: {
            en: 'Analysis',
            hi: 'विश्लेषण'
        },
        description: {
            en: 'Advanced multi-horizon trading plans for Gold, Silver, Crude Oil, and Natural Gas with crash detection and seasonality analysis.',
            hi: 'सोना, चांदी, कच्चा तेल और प्राकृतिक गैस के लिए क्रैश डिटेक्शन और मौसमी विश्लेषण के साथ उन्नत बहु-क्षितिज ट्रेडिंग योजनाएं।'
        },
        step1: {
            en: 'Select Commodity',
            hi: 'कमोडिटी चुनें'
        },
        step2: {
            en: 'Select Exchange for',
            hi: 'एक्सचेंज चुनें'
        },
        items: {
            GOLD: { en: 'Gold', hi: 'सोना' },
            SILVER: { en: 'Silver', hi: 'चांदी' },
            CRUDEOIL: { en: 'Crude Oil', hi: 'कच्चा तेल' },
            NATURALGAS: { en: 'Natural Gas', hi: 'प्राकृतिक गैस' },
            COPPER: { en: 'Copper', hi: 'तांबा' }
        },
        results: {
            en: 'Multi-Horizon Trading Plan',
            hi: 'बहु-क्षितिज ट्रेडिंग योजना'
        },
        emptyState: {
            title: {
                en: 'Select a Commodity',
                hi: 'कमोडिटी का चयन करें'
            },
            desc: {
                en: 'Choose from Gold, Silver, Crude Oil, Natural Gas, or Copper, then select your exchange.',
                hi: 'सोना, चांदी, कच्चा तेल, प्राकृतिक गैस या तांबे में से चुनें, फिर अपना एक्सचेंज चुनें।'
            }
        },
        waitingForExchange: {
            en: 'Select an exchange above to analyze',
            hi: 'विश्लेषण करने के लिए ऊपर एक एक्सचेंज चुनें'
        },
        exchanges: {
            COMEX: {
                label: { en: 'COMEX', hi: 'COMEX' },
                desc: { en: 'US Futures (USD)', hi: 'अमेरिकी वायदा (USD)' }
            },
            MCX: {
                label: { en: 'MCX', hi: 'MCX' },
                desc: { en: 'Indian Futures (INR)', hi: 'भारतीय वायदा (INR)' }
            },
            SPOT: {
                label: { en: 'Spot / Hazar', hi: 'हाजिर बाजार' },
                desc: { en: 'Physical / Spot (INR)', hi: 'फिजिकल / स्पॉट (INR)' }
            }
        }
    },
    common: {
        loading: {
            en: 'Analyzing...',
            hi: 'विश्लेषण कर रहा है...'
        },
        error: {
            en: 'Error occurred',
            hi: 'त्रुटि हुई'
        }
    }
};
