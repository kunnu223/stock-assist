/**
 * Enhanced Analysis Types
 * @module @stock-assist/shared/types/enhanced
 */

/** Timeframe analysis result */
export interface TimeframeResult {
    patterns: string[];
    trend: 'bullish' | 'bearish' | 'neutral';
    strength: number; // 0-100
    keyLevels: {
        support: number;
        resistance: number;
    };
}

/** Multi-timeframe analysis */
export interface MultiTimeframeAnalysis {
    timeframes: {
        '1D': TimeframeResult;
        '1W': TimeframeResult;
        '1M': TimeframeResult;
    };
    alignment: 'bullish' | 'bearish' | 'neutral' | 'mixed';
    alignmentScore: number; // 0-100
}

/** Candlestick pattern */
export interface CandlestickPattern {
    name: string;
    type: 'bullish' | 'bearish' | 'neutral';
    reliability: 'high' | 'medium' | 'low';
    description: string;
}

/** Bollinger Bands */
export interface BollingerBandsResult {
    upper: number;
    middle: number;
    lower: number;
    position: 'above_upper' | 'upper_half' | 'middle' | 'lower_half' | 'below_lower';
    percentB: number;
}

/** Enhanced news analysis */
export interface EnhancedNewsAnalysis {
    items: EnhancedNewsItem[];
    sentiment: 'positive' | 'negative' | 'neutral';
    sentimentScore: number; // 0-100
    impactLevel: 'high' | 'medium' | 'low';
    latestHeadlines: string[];
    dataFreshness: number; // minutes since fetch
}

/** Enhanced news item */
export interface EnhancedNewsItem {
    title: string;
    source: string;
    link: string;
    pubDate: string;
    sentiment: 'positive' | 'negative' | 'neutral';
    sentimentScore: number;
    impactKeywords: string[];
}

/** Fundamental data */
export interface FundamentalData {
    valuation: 'undervalued' | 'fair' | 'overvalued' | 'unknown';
    growth: 'strong' | 'moderate' | 'weak' | 'unknown';
    metrics: {
        peRatio: number | null;
        pbRatio: number | null;
        marketCap: number | null;
        dividendYield: number | null;
        eps: number | null;
        bookValue: number | null;
    };
    sectorComparison: 'outperforming' | 'inline' | 'underperforming' | 'unknown';
}

/** Confidence breakdown */
export interface ConfidenceBreakdown {
    patternStrength: number;      // 25% weight
    newsSentiment: number;        // 20% weight
    technicalAlignment: number;   // 25% weight
    volumeConfirmation: number;   // 15% weight
    fundamentalStrength: number;  // 15% weight
}

/** Confidence scoring result */
export interface ConfidenceResult {
    score: number; // 0-100
    breakdown: ConfidenceBreakdown;
    factors: string[];
    recommendation: 'BUY' | 'SELL' | 'HOLD' | 'WAIT';
}

/** Price targets */
export interface PriceTargets {
    entry: number;
    target1: number;
    target2: number;
    stopLoss: number;
    riskReward: number;
}

/** Enhanced stock analysis response */
export interface EnhancedStockAnalysis {
    symbol: string;
    currentPrice: number;
    recommendation: 'BUY' | 'SELL' | 'HOLD' | 'WAIT';
    confidenceScore: number;
    timeframe: 'intraday' | 'short-term' | 'swing' | 'long-term';
    analysis: {
        technicalPatterns: {
            '1D': string[];
            '1W': string[];
            '1M': string[];
            alignment: 'bullish' | 'bearish' | 'neutral' | 'mixed';
        };
        indicators: {
            RSI: number;
            RSIInterpretation: 'oversold' | 'neutral' | 'overbought';
            MACD: string;
            volumeTrend: 'high' | 'normal' | 'low';
            bollingerPosition: string;
        };
        news: {
            sentiment: 'positive' | 'negative' | 'neutral';
            sentimentScore: number;
            latestHeadlines: string[];
            impactLevel: 'high' | 'medium' | 'low';
        };
        fundamentals: {
            valuation: string;
            growth: string;
            peRatio: number | null;
        };
        candlestickPatterns: string[];
    };
    priceTargets: PriceTargets;
    risks: string[];
    reasoning: string;
    validUntil: string;
    confidenceBreakdown: ConfidenceBreakdown;
}
