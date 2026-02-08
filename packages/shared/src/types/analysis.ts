/**
 * Analysis Types - AI analysis result types
 * @module @stock-assist/shared/types/analysis
 */

/** Target price with probability */
export interface Target {
    price: number;
    probability: number;
}

/** Trade plan for a scenario */
export interface TradePlan {
    action: 'BUY' | 'SELL' | 'SHORT' | 'HOLD' | 'AVOID';
    entry: [number, number];
    stopLoss: number;
    stopLossPercent: number;
    targets: Target[];
    riskReward: number;
    potentialProfit: [number, number];
}

/** Single scenario (bullish or bearish) */
export interface Scenario {
    probability: number;
    score: number;
    trigger: string;
    confirmation: string;
    tradePlan: TradePlan;
    factors: string[];
    timeHorizon: string;
}

/** Stock analysis result */
export interface StockAnalysis {
    stock: string;
    currentPrice: number;
    bias: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
    confidence: 'HIGH' | 'MEDIUM' | 'LOW';
    confidenceScore: number;
    category: 'STRONG_SETUP' | 'NEUTRAL' | 'AVOID';
    recommendation: string;
    bullish: Scenario;
    bearish: Scenario;
    pattern?: {
        name: string;
        confidence: number;
    };
    newsSentiment: 'positive' | 'negative' | 'neutral';
}

/** Morning screening result */
export interface ScreeningResult {
    date: string;
    analyzedAt: string;
    processingTime: number;
    strongSetups: StockAnalysis[];
    neutral: StockAnalysis[];
    avoid: StockAnalysis[];
}
