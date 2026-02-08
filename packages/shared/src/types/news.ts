/**
 * News Types
 * @module @stock-assist/shared/types/news
 */

/** Single news item */
export interface NewsItem {
    title: string;
    source: string;
    link: string;
    pubDate: string;
    sentiment: 'positive' | 'negative' | 'neutral';
    score: number;
}

/** News analysis result */
export interface NewsAnalysis {
    items: NewsItem[];
    overallSentiment: 'positive' | 'negative' | 'neutral';
    score: number;
    keyDevelopments: string[];
}
