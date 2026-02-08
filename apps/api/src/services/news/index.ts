/**
 * News Fetcher Service
 * @module @stock-assist/api/services/news
 */

import axios from 'axios';
import * as cheerio from 'cheerio';
import type { NewsItem, NewsAnalysis } from '@stock-assist/shared';
import { STOCK_NAMES } from '@stock-assist/shared';

const POSITIVE = ['surge', 'rally', 'gain', 'jump', 'profit', 'growth', 'bullish', 'upgrade', 'buy'];
const NEGATIVE = ['fall', 'drop', 'decline', 'crash', 'loss', 'bearish', 'downgrade', 'sell', 'warning'];

/** Analyze sentiment of text */
const analyzeSentiment = (text: string): { sentiment: 'positive' | 'negative' | 'neutral'; score: number } => {
    const lower = text.toLowerCase();
    let pos = 0, neg = 0;

    POSITIVE.forEach((k) => { if (lower.includes(k)) pos++; });
    NEGATIVE.forEach((k) => { if (lower.includes(k)) neg++; });

    const total = pos + neg;
    if (total === 0) return { sentiment: 'neutral', score: 50 };

    const score = ((pos - neg) / total) * 50 + 50;
    const sentiment = score > 60 ? 'positive' : score < 40 ? 'negative' : 'neutral';

    return { sentiment, score: Math.round(score) };
};

/** Fetch news for a stock */
export const fetchNews = async (symbol: string, _days = 3): Promise<NewsAnalysis> => {
    const name = STOCK_NAMES[symbol] || symbol;
    const query = encodeURIComponent(`${name} stock NSE`);
    const url = `https://news.google.com/rss/search?q=${query}&hl=en-IN&gl=IN&ceid=IN:en`;

    try {
        const { data } = await axios.get(url, {
            headers: { 'User-Agent': 'Mozilla/5.0' },
            timeout: 10000,
        });

        const $ = cheerio.load(data, { xmlMode: true });
        const items: NewsItem[] = [];

        $('item').slice(0, 10).each((_, el) => {
            const title = $(el).find('title').text();
            const link = $(el).find('link').text();
            const pubDate = $(el).find('pubDate').text();
            const parts = title.split(' - ');
            const source = parts.pop() || 'Unknown';
            const { sentiment, score } = analyzeSentiment(title);

            items.push({
                title: parts.join(' - '),
                source,
                link,
                pubDate: new Date(pubDate).toISOString(),
                sentiment,
                score,
            });
        });

        const avgScore = items.length > 0
            ? items.reduce((sum, i) => sum + i.score, 0) / items.length
            : 50;

        return {
            items,
            overallSentiment: avgScore > 60 ? 'positive' : avgScore < 40 ? 'negative' : 'neutral',
            score: Math.round(avgScore),
            keyDevelopments: items.filter((i) => Math.abs(i.score - 50) > 20).slice(0, 3).map((i) => i.title),
        };
    } catch {
        return { items: [], overallSentiment: 'neutral', score: 50, keyDevelopments: [] };
    }
};
