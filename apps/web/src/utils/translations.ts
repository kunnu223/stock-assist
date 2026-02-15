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
        },
        inputPlaceholder: {
            en: 'Enter Symbol (e.g. RELIANCE)',
            hi: 'सिंबल दर्ज करें (जैसे RELIANCE)'
        },
        scanButton: {
            en: 'SCAN STOCK',
            hi: 'स्टॉक स्कैन'
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
    },
    history: {
        auditLog: {
            en: 'Audit Log',
            hi: 'ऑडिट लॉग'
        },
        title: {
            en: 'Intelligence',
            hi: 'इंटेलिजेंस'
        },
        history: {
            en: 'History',
            hi: 'इतिहास'
        },
        description: {
            en: 'Access your comprehensive audit log of historical AI stock analysis from the last 60 days.',
            hi: 'पिछले 60 दिनों के एआई स्टॉक विश्लेषण का अपना विस्तृत ऑडिट लॉग एक्सेस करें।'
        },
        filterButton: {
            en: 'Advanced Filters',
            hi: 'उन्नत फिल्टर'
        },
        exportButton: {
            en: 'Export Dataset',
            hi: 'डेटासेट निर्यात करें'
        },
        searchPlaceholder: {
            en: 'Instrument Search',
            hi: 'इंस्ट्रूमेंट खोजें'
        },
        startPoint: {
            en: 'Start Point',
            hi: 'आरंभ बिंदु'
        },
        endPoint: {
            en: 'End Point',
            hi: 'अंत बिंदु'
        },
        minConfidence: {
            en: 'Minimum Confidence',
            hi: 'न्यूनतम आत्मविश्वास'
        },
        bullishSaturation: {
            en: 'Bullish Saturation',
            hi: 'तेजी संतृप्ति'
        },
        bearishSaturation: {
            en: 'Bearish Saturation',
            hi: 'मंदी संतृप्ति'
        },
        clearConfig: {
            en: 'Clear Configuration',
            hi: 'कॉन्फ़िगरेशन साफ़ करें'
        },
        datasetSize: {
            en: 'Dataset Size',
            hi: 'डेटासेट आकार'
        },
        retention: {
            en: 'Retention',
            hi: 'प्रतिधारण'
        },
        entries: {
            en: 'Entries',
            hi: 'प्रविष्टियां'
        },
        zeroMatches: {
            en: 'ZERO MATCHES',
            hi: 'कोई मैच नहीं'
        },
        noRecords: {
            en: 'No historical records match your current filter parameters.',
            hi: 'कोई ऐतिहासिक रिकॉर्ड आपके वर्तमान फ़िल्टर मापदंडों से मेल नहीं खाता है।'
        },
        resetDefaults: {
            en: 'Reset To Defaults',
            hi: 'डिफ़ॉल्ट पर रीसेट करें'
        }
    },
    commodityResult: {
        multiHorizonPlan: {
            en: 'Multi-Horizon Plan',
            hi: 'बहु-क्षितिज योजना'
        },
        intelligentActions: {
            en: 'Intelligent Trading Actions',
            hi: 'बुद्धिमान ट्रेडिंग कार्रवाई'
        },
        today: {
            en: 'Today',
            hi: 'आज'
        },
        tomorrow: {
            en: 'Tomorrow',
            hi: 'कल'
        },
        nextWeek: {
            en: 'Next Week',
            hi: 'अगला सप्ताह'
        },
        macroContext: {
            en: 'Macro Context',
            hi: 'मैक्रो संदर्भ'
        },
        usdCorrelations: {
            en: 'USD / Correlations',
            hi: 'USD / सहसंबंध'
        },
        crashDetection: {
            en: 'Crash Detection',
            hi: 'क्रैश पहचान'
        },
        fourSignalSystem: {
            en: '4-Signal System',
            hi: '4-सिग्नल सिस्टम'
        },
        crashProbability: {
            en: 'Crash Probability',
            hi: 'क्रैश संभावना'
        },
        seasonality: {
            en: 'Seasonality',
            hi: 'मौसमी रुझान'
        },
        historicalPatterns: {
            en: 'Historical Patterns',
            hi: 'ऐतिहासिक पैटर्न'
        },
        currentMonth: {
            en: 'Current Month',
            hi: 'वर्तमान माह'
        },
        nextMonth: {
            en: 'Next Month',
            hi: 'अगला माह'
        },
        quarterOutlook: {
            en: 'Quarter Outlook',
            hi: 'तिमाही दृष्टिकोण'
        },
        confidenceBreakdown: {
            en: 'Confidence Breakdown',
            hi: 'आत्मविश्वास विश्लेषण'
        },
        fiveFactorAnalysis: {
            en: '5-Factor Analysis',
            hi: '5-कारक विश्लेषण'
        },
        technicalSummary: {
            en: 'Technical Summary',
            hi: 'तकनीकी सारांश'
        },
        dataPointsAnalyzed: {
            en: 'data points analyzed',
            hi: 'डेटा बिंदुओं का विश्लेषण'
        },
        keyFactors: {
            en: 'Key Factors',
            hi: 'मुख्य कारक'
        },
        overallMacroBias: {
            en: 'Overall Macro Bias',
            hi: 'समग्र मैक्रो रुझान'
        },
        action: {
            en: 'Action',
            hi: 'कार्रवाई'
        },
        urgency: {
            en: 'Urgency',
            hi: 'तत्परता'
        },
        confidence: {
            en: 'Confidence',
            hi: 'आत्मविश्वास'
        },
        priceLevels: {
            en: 'Price Levels',
            hi: 'मूल्य स्तर'
        },
        entry: {
            en: 'Entry',
            hi: 'प्रवेश'
        },
        stopLoss: {
            en: 'Stop Loss',
            hi: 'स्टॉप लॉस'
        },
        target: {
            en: 'Target',
            hi: 'लक्ष्य'
        },
        reasoning: {
            en: 'Reasoning',
            hi: 'तर्क'
        },
        risks: {
            en: 'Risks',
            hi: 'जोखिम'
        },
        watchLevels: {
            en: 'Watch Levels',
            hi: 'निगरानी स्तर'
        },
        eventsToMonitor: {
            en: 'Events to Monitor',
            hi: 'निगरानी अनुसूची'
        },
        targetRange: {
            en: 'Target Range',
            hi: 'लक्ष्य सीमा'
        },
        strategy: {
            en: 'Strategy',
            hi: 'रणनीति'
        },
        keyEvents: {
            en: 'Key Events',
            hi: 'प्रमुख घटनाएं'
        }
    },
    planB: {
        title: {
            en: 'Plan B — Loss Prevention',
            hi: 'प्लान B — हानि रोकथाम'
        },
        ifThisHappens: {
            en: 'If This Happens',
            hi: 'अगर ये होता है'
        },
        recoverySteps: {
            en: 'Recovery Steps',
            hi: 'रिकवरी चरण'
        },
        recovery: {
            en: 'Recovery',
            hi: 'रिकवरी'
        },
        maxLoss: {
            en: 'Max Loss',
            hi: 'अधिकतम हानि'
        },
        timeline: {
            en: 'Timeline',
            hi: 'समय सीमा'
        },
        holdPosition: {
            en: 'Hold Position',
            hi: 'पोजीशन होल्ड करें'
        },
        averageDown: {
            en: 'Average Down',
            hi: 'एवरेज डाउन'
        },
        exitTrade: {
            en: 'Exit Trade',
            hi: 'ट्रेड बंद करें'
        },
        hedgePosition: {
            en: 'Hedge Position',
            hi: 'हेज करें'
        },
        reverseTrade: {
            en: 'Reverse Trade',
            hi: 'उलटा ट्रेड'
        },
        reduceSize: {
            en: 'Reduce Size',
            hi: 'साइज़ कम करें'
        }
    },
    theme: {
        light: {
            en: 'Light Mode',
            hi: 'लाइट मोड'
        },
        dark: {
            en: 'Dark Mode',
            hi: 'डार्क मोड'
        }
    },
    mcx: {
        open: {
            en: 'OPEN',
            hi: 'खुला'
        },
        closed: {
            en: 'CLOSED',
            hi: 'बंद'
        },
        opensMonday: {
            en: 'Opens Monday 9:00 AM IST',
            hi: 'सोमवार सुबह 9:00 IST को खुलेगा'
        },
        opensTomorrow: {
            en: 'Opens tomorrow 9:00 AM IST',
            hi: 'कल सुबह 9:00 IST को खुलेगा'
        }
    },
    dashboard: {
        title: {
            en: 'Trading',
            hi: 'ट्रेडिंग'
        },
        subtitle: {
            en: 'Dashboard',
            hi: 'डैशबोर्ड'
        },
        topStocks: {
            en: 'Top Stocks',
            hi: 'शीर्ष स्टॉक्स'
        },
        refresh: {
            en: 'Refresh',
            hi: 'रीफ्रेश'
        },
        lastUpdated: {
            en: 'Last Updated',
            hi: 'अंतिम अपडेट'
        }
    }
};
