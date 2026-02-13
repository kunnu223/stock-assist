/**
 * Enhanced AI Prompt Builder
 * @module @stock-assist/api/services/ai/enhancedPrompt
 */

import type { StockData, TechnicalIndicators, PatternAnalysis } from '@stock-assist/shared';
import { TRADING } from '@stock-assist/shared';
import type { FundamentalData } from '../data/fundamentals';
import type { EnhancedNewsAnalysis } from '../news/enhanced';
import type { ConfidenceResult } from '../analysis/confidenceScoring';

// Re-export types for convenience
export type { EnhancedNewsAnalysis, FundamentalData, ConfidenceResult };

import type { MultiTimeframeAnalysis } from '../analysis/technicalAnalysis';

export interface EnhancedPromptInput {
   stock: StockData;
   indicators: TechnicalIndicators;
   patterns: PatternAnalysis;
   news: EnhancedNewsAnalysis;
   fundamentals: FundamentalData;
   technicalSummary: string;
   confidenceResult: ConfidenceResult;
   weeklyIndicators?: TechnicalIndicators;
   monthlyIndicators?: TechnicalIndicators;
   weeklyPatterns?: PatternAnalysis;
   monthlyPatterns?: PatternAnalysis;
   patternConfluence?: any;
   ftConflict?: any;
   sectorComparison?: any;
   multiTimeframe?: MultiTimeframeAnalysis;
   language?: string;
}

/**
 * Build comprehensive enhanced analysis prompt
 */
export const buildEnhancedPrompt = (input: EnhancedPromptInput): string => {
   const { stock, indicators, patterns, news, fundamentals, confidenceResult, weeklyIndicators, monthlyIndicators, patternConfluence, ftConflict, sectorComparison, multiTimeframe, language } = input;
   const { quote } = stock;
   const { rsi, ma, macd } = indicators;

   // Use multiTimeframe data if available, otherwise fallback to basic
   const dailyBias = multiTimeframe?.timeframes['1D'].trend || 'neutral';
   const weeklyBias = multiTimeframe?.timeframes['1W'].trend || 'neutral';
   const monthlyBias = multiTimeframe?.timeframes['1M'].trend || 'neutral';

   const langInstruction = language === 'hi'
      ? 'IMPORTANT: Provide the response in HINDI language (Devanagari script) for all text fields (summary, reasoning, action, etc). Keep JSON keys in English.'
      : '';

   const prompt = `You are an expert stock analyst. Analyze ${quote.symbol}:

${langInstruction}

📊 CURRENT PRICE: ₹${quote.price}

═══════════════════════════════════════
MULTI-TIMEFRAME TECHNICAL ANALYSIS
═══════════════════════════════════════

📈 DAILY (1D) - Short-term view:
├─ RSI: ${rsi.value.toFixed(1)} (${rsi.interpretation})
├─ MACD: ${macd.trend}
├─ Moving Average: ${ma.trend} (SMA20: ${ma.sma20.toFixed(2)}, SMA50: ${ma.sma50.toFixed(2)})
├─ Patterns: ${patterns.primary ? patterns.primary.name : 'None'}
└─ Overall Bias: ${dailyBias.toUpperCase()}

📊 WEEKLY (1W) - Medium-term view:
${weeklyIndicators ? `├─ RSI: ${weeklyIndicators.rsi.value.toFixed(1)} (${weeklyIndicators.rsi.interpretation})
├─ MACD: ${weeklyIndicators.macd.trend}
├─ Moving Average: ${weeklyIndicators.ma.trend}
├─ Patterns: ${input.weeklyPatterns?.primary ? input.weeklyPatterns.primary.name : 'None'}
└─ Overall Bias: ${weeklyBias.toUpperCase()}` : '└─ Data unavailable'}

📉 MONTHLY (1M) - Long-term view:
${monthlyIndicators ? `├─ RSI: ${monthlyIndicators.rsi.value.toFixed(1)} (${monthlyIndicators.rsi.interpretation})
├─ MACD: ${monthlyIndicators.macd.trend}
├─ Moving Average: ${monthlyIndicators.ma.trend}
├─ Patterns: ${input.monthlyPatterns?.primary ? input.monthlyPatterns.primary.name : 'None'}
└─ Overall Bias: ${monthlyBias.toUpperCase()}` : '└─ Data unavailable'}

⚖️ TIMEFRAME CONFLUENCE:
${patternConfluence ? `├─ Bullish timeframes: ${patternConfluence.bullishTimeframes.join(', ') || 'None'}
├─ Bearish timeframes: ${patternConfluence.bearishTimeframes.join(', ') || 'None'}
├─ Neutral timeframes: ${patternConfluence.neutralTimeframes.join(', ') || 'None'}
├─ Agreement Score: ${patternConfluence.score}/100 (${patternConfluence.agreement})
└─ Recommendation: ${patternConfluence.recommendation}` : '└─ Data unavailable'}

${news.breakingNews && news.breakingNews.length > 0 ? `
🚨 BREAKING NEWS (< 2 hours old):
${news.breakingNews.map((n: any) => `├─ [${n.sentiment.toUpperCase()}] ${n.title}`).join('\n')}
└─ Impact: ${news.breakingImpact}` : ''}

💰 FUNDAMENTAL vs TECHNICAL:
${ftConflict ? (ftConflict.hasConflict ? `
⚠️ CONFLICT DETECTED: ${ftConflict.conflictType}
├─ Technical Bias: ${ftConflict.technicalBias}
├─ Fundamental Verdict: ${ftConflict.fundamentalVerdict}
└─ Adjustment: ${ftConflict.confidenceAdjustment}%` : '✅ No conflict - fundamentals support technical setup') : '└─ Data unavailable'}

📊 SECTOR COMPARISON:
${sectorComparison ? `├─ Stock Change: ${sectorComparison.stockChange.toFixed(2)}%
├─ Sector Change: ${sectorComparison.sectorChange ? sectorComparison.sectorChange.toFixed(2) + '%' : 'N/A'}
├─ Outperformance: ${sectorComparison.outperformance ? sectorComparison.outperformance.toFixed(2) + '%' : 'N/A'}
└─ Verdict: ${sectorComparison.verdict}` : '└─ Data unavailable'}

═══════════════════════════════════════
YOUR ANALYSIS TASK
═══════════════════════════════════════

1️⃣ TIMEFRAME ANALYSIS:
   - Which timeframe shows the strongest setup?
   - Do 2+ timeframes confirm the same direction?
   - Is there a conflict between short-term and long-term trends?

2️⃣ CONFLUENCE CHECK:
   - How many indicators align on each timeframe?
   - Is there a "golden cross" or "death cross" on any timeframe?
   - Do RSI levels support the price action?

3️⃣ NEWS & FUNDAMENTALS:
   - Does breaking news invalidate the technical setup?
   - Should the fundamental conflict reduce our confidence?

4️⃣ RISK ASSESSMENT:
   - What are the key risks to this trade?
   - What could invalidate the setup?

═══════════════════════════════════════
DECISION RULES (MUST FOLLOW)
═══════════════════════════════════════

✅ HIGH PROBABILITY (70-85%):
   - 3+ timeframes align in same direction
   - Strong pattern confluence score (>75)
   - No breaking negative news
   - No fundamental conflicts OR conflict is minor

⚠️ MEDIUM PROBABILITY (50-70%):
   - 2 timeframes align
   - Moderate confluence (50-75)
   - Minor news or fundamental issues

❌ LOW PROBABILITY (<50%):
   - Only 1 timeframe bullish/bearish
   - Conflicting signals across timeframes
   - Major fundamental conflicts
   - Breaking negative news overrides technicals

🚫 NO TRADE (WAIT):
   - Strong conflict (1D bullish but 1M bearish)
   - Breaking negative news on bullish setup
   - Confluence score < 40

Provide your analysis in the required JSON format with REALISTIC probabilities.`;

   return prompt;
};
