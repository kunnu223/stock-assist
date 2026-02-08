/**
 * Enhanced News Service
 * @module @stock-assist/api/services/news/enhanced
 */

import axios from 'axios';
import * as cheerio from 'cheerio';
import { STOCK_NAMES } from '@stock-assist/shared';

// Local type definitions
export interface EnhancedNewsItem {
    title: string;
    source: string;
    link: string;
    pubDate: string;
    sentiment: 'positive' | 'negative' | 'neutral';
    sentimentScore: number;
    impactKeywords: string[];
}

export interface EnhancedNewsAnalysis {
    items: EnhancedNewsItem[];
    breakingNews: EnhancedNewsItem[]; // < 2 hours
    recentNews: EnhancedNewsItem[];   // < 24 hours
    breakingImpact: 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE';
    sentiment: 'positive' | 'negative' | 'neutral';
    sentimentScore: number;
    impactLevel: 'high' | 'medium' | 'low';
    latestHeadlines: string[];
    dataFreshness: number;
}

// Sentiment keywords (expanded)
const POSITIVE_KEYWORDS = [
    'surge', 'rally', 'gain', 'jump', 'profit', 'growth', 'bullish', 'upgrade',
    'buy', 'outperform', 'beat', 'record', 'strong', 'positive', 'rises', 'soar',
    'breakout', 'momentum', 'expansion', 'dividend', 'acquisition', 'partnership'
];

const NEGATIVE_KEYWORDS = [
    'fall', 'drop', 'decline', 'crash', 'loss', 'bearish', 'downgrade', 'sell',
    'warning', 'miss', 'weak', 'negative', 'concern', 'risk', 'debt', 'lawsuit',
    'investigation', 'layoff', 'recession', 'default', 'bankruptcy', 'fraud'
];

const IMPACT_KEYWORDS = {
    high: ['earnings', 'acquisition', 'merger', 'regulatory', 'ceo', 'guidance', 'fda', 'lawsuit', 'bankruptcy'],
    medium: ['upgrade', 'downgrade', 'dividend', 'buyback', 'partnership', 'contract', 'expansion'],
    low: ['analyst', 'rating', 'price target', 'market', 'sector', 'industry']
};

// Simple in-memory cache (15-minute TTL)
interface NewsCache {
    data: EnhancedNewsAnalysis;
    timestamp: number;
}

const cache = new Map<string, NewsCache>();
const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes

/**
 * Enhanced sentiment analysis with confidence scoring
 */
const analyzeSentiment = (text: string): { sentiment: 'positive' | 'negative' | 'neutral'; score: number } => {
    const lower = text.toLowerCase();
    let pos = 0, neg = 0;

    POSITIVE_KEYWORDS.forEach((k) => {
        if (lower.includes(k)) pos++;
    });
    NEGATIVE_KEYWORDS.forEach((k) => {
        if (lower.includes(k)) neg++;
    });

    const total = pos + neg;
    if (total === 0) return { sentiment: 'neutral', score: 50 };

    // Weighted scoring
    const score = Math.min(100, Math.max(0, 50 + (pos - neg) * 10));
    const sentiment = score > 60 ? 'positive' : score < 40 ? 'negative' : 'neutral';

    return { sentiment, score: Math.round(score) };
};

/**
 * Detect impact keywords in text
 */
const detectImpactKeywords = (text: string): string[] => {
    const lower = text.toLowerCase();
    const found: string[] = [];

    [...IMPACT_KEYWORDS.high, ...IMPACT_KEYWORDS.medium].forEach((keyword) => {
        if (lower.includes(keyword)) {
            found.push(keyword);
        }
    });

    return found;
};

/**
 * Determine impact level based on keywords
 */
const getImpactLevel = (text: string): 'high' | 'medium' | 'low' => {
    const lower = text.toLowerCase();

    for (const keyword of IMPACT_KEYWORDS.high) {
        if (lower.includes(keyword)) return 'high';
    }
    for (const keyword of IMPACT_KEYWORDS.medium) {
        if (lower.includes(keyword)) return 'medium';
    }
    return 'low';
};

/**
 * Filter news by age (in hours)
 */
const filterNewsByAge = (items: EnhancedNewsItem[], maxAgeHours: number): EnhancedNewsItem[] => {
    const now = Date.now();
    const maxAge = maxAgeHours * 60 * 60 * 1000;

    return items.filter(item => {
        const pubDate = new Date(item.pubDate).getTime();
        const age = now - pubDate;
        return age <= maxAge;
    });
};

/**
 * Determine breaking news impact
 */
const getBreakingImpact = (breakingNews: EnhancedNewsItem[]): 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE' => {
    if (breakingNews.length === 0) return 'NONE';

    const hasHighImpact = breakingNews.some(item =>
        item.impactKeywords.some(k => IMPACT_KEYWORDS.high.includes(k))
    );

    const hasNegative = breakingNews.some(item => item.sentiment === 'negative');
    const hasPositive = breakingNews.some(item => item.sentiment === 'positive');

    if (hasHighImpact) return 'HIGH';
    if (hasNegative || hasPositive) return 'MEDIUM';
    return 'LOW';
};

/**
 * Fetch enhanced news for a stock
 */
export const fetchEnhancedNews = async (symbol: string): Promise<EnhancedNewsAnalysis> => {
    const cacheKey = symbol.toUpperCase();

    // Check cache
    const cached = cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
        console.log(`[EnhancedNews] Cache hit for ${symbol}`);
        return {
            ...cached.data,
            dataFreshness: Math.round((Date.now() - cached.timestamp) / 60000),
        };
    }

    const name = STOCK_NAMES[symbol] || symbol;
    const query = encodeURIComponent(`${name} stock NSE`);
    const url = `https://news.google.com/rss/search?q=${query}&hl=en-IN&gl=IN&ceid=IN:en`;

    try {
        const { data } = await axios.get(url, {
            headers: { 'User-Agent': 'Mozilla/5.0' },
            timeout: 10000,
        });

        const $ = cheerio.load(data, { xmlMode: true });
        const items: EnhancedNewsItem[] = [];

        $('item').slice(0, 15).each((_, el) => {
            const title = $(el).find('title').text();
            const link = $(el).find('link').text();
            const pubDate = $(el).find('pubDate').text();
            const parts = title.split(' - ');
            const source = parts.pop() || 'Unknown';
            const { sentiment, score } = analyzeSentiment(title);
            const impactKeywords = detectImpactKeywords(title);

            items.push({
                title: parts.join(' - '),
                source,
                link,
                pubDate: new Date(pubDate).toISOString(),
                sentiment,
                sentimentScore: score,
                impactKeywords,
            });
        });

        // Calculate overall sentiment
        const avgScore = items.length > 0
            ? items.reduce((sum, i) => sum + i.sentimentScore, 0) / items.length
            : 50;

        // Filter breaking and recent news
        const breakingNews = filterNewsByAge(items, 2);  // < 2 hours
        const recentNews = filterNewsByAge(items, 24);   // < 24 hours
        const breakingImpact = getBreakingImpact(breakingNews);

        // Determine overall impact
        const allImpactKeywords = items.flatMap((i) => i.impactKeywords);
        const hasHighImpact = IMPACT_KEYWORDS.high.some((k) => allImpactKeywords.includes(k));
        const hasMediumImpact = IMPACT_KEYWORDS.medium.some((k) => allImpactKeywords.includes(k));
        const impactLevel = hasHighImpact ? 'high' : hasMediumImpact ? 'medium' : 'low';

        const result: EnhancedNewsAnalysis = {
            items,
            breakingNews,
            recentNews,
            breakingImpact,
            sentiment: avgScore > 60 ? 'positive' : avgScore < 40 ? 'negative' : 'neutral',
            sentimentScore: Math.round(avgScore),
            impactLevel,
            latestHeadlines: items.slice(0, 5).map((i) => i.title),
            dataFreshness: 0,
        };

        // Update cache
        cache.set(cacheKey, { data: result, timestamp: Date.now() });
        console.log(`[EnhancedNews] Fetched ${items.length} news for ${symbol}, sentiment: ${result.sentiment} (${avgScore})`);

        return result;
    } catch (error) {
        console.warn(`[EnhancedNews] Error fetching ${symbol}:`, (error as Error).message);
        return getDefaultNews();
    }
};

/** Default news when fetch fails */
const getDefaultNews = (): EnhancedNewsAnalysis => ({
    items: [],
    breakingNews: [],
    recentNews: [],
    breakingImpact: 'NONE',
    sentiment: 'neutral',
    sentimentScore: 50,
    impactLevel: 'low',
    latestHeadlines: [],
    dataFreshness: -1, // Indicates no data
});

/** Clear news cache (for testing) */
export const clearNewsCache = (): void => {
    cache.clear();
};
