/**
 * Web App Types — Single source of truth for all frontend types.
 * Import from '@/types' instead of defining inline in components.
 * @module @stock-assist/web/types
 */

// ═══════════════════════════════════════════════════════════════
// API RESPONSE TYPES
// ═══════════════════════════════════════════════════════════════

/** Standard API response envelope */
export interface ApiResponse<T = unknown> {
    success: boolean;
    error?: string;
    message?: string;
    data?: T;
}

/** Single stock analysis API response */
export interface AnalysisResponse {
    success: boolean;
    processingTime: string;
    analysis: AnalysisData;
    error?: string;
}

/** Top stocks screening API response */
export interface TopStocksResponse {
    success: boolean;
    stocks: TopStock[];
    count: number;
    totalScanned: number;
    updatedAt: string;
    message?: string;
    metadata?: {
        cached: boolean;
        isFallback?: boolean;
        scanDuration?: string;
        avgConfidence: number;
        signalPersistence: { age3: number; age2: number; age1: number };
        directionSplit: { bullish: number; bearish: number };
    };
}

/** OHLC chart data API response */
export interface ChartDataResponse {
    success: boolean;
    symbol: string;
    data: OHLCBar[];
    range: string;
    interval: string;
    error?: string;
}

// ═══════════════════════════════════════════════════════════════
// CHART TYPES
// ═══════════════════════════════════════════════════════════════

/** Single OHLC bar for charting */
export interface OHLCBar {
    date: string;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
}

/** Chart time range options */
export type ChartRange = '1mo' | '3mo' | '6mo' | '1y' | '2y';

/** Chart interval options */
export type ChartInterval = '1d' | '1wk';

/** Price marker overlay on chart (S/R, entry, SL, targets) */
export interface ChartMarker {
    price: number;
    label: string;
    color: string;
    lineStyle?: 'solid' | 'dashed';
}

/** Projected future price path for chart visualization */
export interface PriceProjection {
    /** Label for the projection (e.g., "Bullish Target", "Bearish Risk") */
    label: string;
    /** Target price at end of projection */
    targetPrice: number;
    /** Probability of this scenario (0-100) */
    probability: number;
    /** Type determines color and rendering */
    type: 'bullish' | 'bearish' | 'neutral';
    /** Number of trading days into the future */
    daysAhead: number;
    /** Optional intermediate price points for curved path */
    waypoints?: number[];
}

// ═══════════════════════════════════════════════════════════════
// ANALYSIS TYPES
// ═══════════════════════════════════════════════════════════════

/** Candlestick pattern detail */
export interface CandlestickPattern {
    name: string;
    type: 'bullish' | 'bearish' | 'neutral';
    strength: 'weak' | 'moderate' | 'strong';
    confidenceWeight: number;
    description: string;
    candles: number;
}

/** Candlestick analysis result */
export interface CandlestickAnalysis {
    patterns: CandlestickPattern[];
    bullishCount: number;
    bearishCount: number;
    dominantBias: 'bullish' | 'bearish' | 'neutral';
    compositeScore: number;
    summary: string;
}

/** Signal card from SMC analysis */
export interface SignalCard {
    ticker: string;
    direction: 'bullish' | 'bearish' | 'none';
    status: 'SETUP_ACTIVE' | 'WAITING_FOR_ENTRY' | 'NO_SETUP';
    convictionScore: number;
    entryZone: {
        entryZoneLow: number;
        entryZoneHigh: number;
        stopLoss: number;
        target1: number;
        target2: number;
        riskReward: number;
        isValid: boolean;
        entryTrigger: string;
    } | null;
    explanation: string[];
    mtfAlignment: {
        weeklyTrend: string;
        dailySetup: string;
        alignmentScore: number;
        alignmentValid: boolean;
    };
    smcSummary: {
        trendState: string;
        orderBlockCount: number;
        unmitigatedOBCount: number;
        unfilledFVGCount: number;
        chochDetected: boolean;
        sweepDetected: boolean;
    };
}

/** Trade target with probability */
export interface TradeTarget {
    price: number | string;
    probability: number;
}

/** Trade plan within a scenario */
export interface TradePlan {
    action: string;
    entry: (string | number)[];
    stopLoss: string | number;
    stopLossPercent?: string | number;
    targets: TradeTarget[];
    riskReward: string | number;
    potentialProfit?: (string | number)[];
}

/** Bullish/Bearish scenario */
export interface Scenario {
    probability: number;
    score: number;
    trigger: string;
    confirmation: string;
    tradePlan: TradePlan;
    factors: string[];
    timeHorizon: string;
}

/** Confidence breakdown */
export interface ConfidenceBreakdown {
    patternStrength: number;
    newsSentiment: number;
    technicalAlignment: number;
    volumeConfirmation: number;
    fundamentalStrength: number;
}

/** Risk metrics */
export interface RiskMetrics {
    expectedReturn: number;
    sharpeRatio: number;
    maxDrawdown: number;
    volatility: number;
    riskRewardRatio: number;
    winRate: number;
}

/** Full analysis data from the API */
export interface AnalysisData {
    stock: string;
    currentPrice: number;
    recommendation: 'BUY' | 'SELL' | 'HOLD' | 'WAIT';
    confidenceScore: number;
    timeframe: string;
    technicalPatterns: {
        '1D': string[];
        '1W': string[];
        '1M': string[];
        alignment: string;
    };
    indicators: {
        RSI: number;
        RSIInterpretation: string;
        MACD: string;
        volumeTrend: string;
        bollingerPosition: string;
    };
    news: {
        sentiment: string;
        sentimentScore: number;
        latestHeadlines: string[];
        impactLevel: string;
    };
    fundamentals: {
        valuation: string;
        growth: string;
        peRatio: number | null;
    };
    candlestickPatterns: string[];
    candlestickAnalysis?: CandlestickAnalysis;
    confidenceBreakdown: ConfidenceBreakdown;
    bullish: Scenario;
    bearish: Scenario;
    risks: string[];
    category: string;
    bias: string;
    confidence: string;
    rawPrompt?: string;
    signalCard?: SignalCard;
    riskMetrics?: RiskMetrics;
    priceTargets?: {
        entry: number;
        target1: number;
        target2: number;
        stopLoss: number;
        riskReward: number | string;
    };
}

// ═══════════════════════════════════════════════════════════════
// SCREENING TYPES
// ═══════════════════════════════════════════════════════════════

/** Individual indicator signal */
export interface IndicatorSignal {
    name: string;
    direction: 'bullish' | 'bearish' | 'neutral';
    strength: number;
    detail: string;
}

/** Top stock from screening */
export interface TopStock {
    symbol: string;
    name: string;
    price: number;
    changePercent: number;
    confidence: number;
    reason: string;
    technicalScore: number;
    direction: 'bullish' | 'bearish';
    signalClarity: number;
    signalAge?: number;
    signals: IndicatorSignal[];
    updatedAt: string;
}
