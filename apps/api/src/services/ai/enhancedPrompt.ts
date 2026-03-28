import type { StockData, TechnicalIndicators, PatternAnalysis } from '@stock-assist/shared';
import { TRADING } from '@stock-assist/shared';
import type { FundamentalData } from '../data/fundamentals';
import type { EnhancedNewsAnalysis } from '../news/enhanced';
import type { SplitConfidenceResult } from '../analysis/confidenceScoring';

export type { EnhancedNewsAnalysis, FundamentalData, SplitConfidenceResult };

import type { MultiTimeframeAnalysis } from '../analysis/technicalAnalysis';

export interface EnhancedPromptInput {
   stock: StockData;
   indicators: TechnicalIndicators;
   patterns: PatternAnalysis;
   news: EnhancedNewsAnalysis;
   fundamentals: FundamentalData;
   technicalSummary: string;
   confidenceResult: SplitConfidenceResult;
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

export const buildUserFriendlyPrompt = (input: EnhancedPromptInput): string => {
   const { stock, indicators, patterns, news, fundamentals, weeklyIndicators, monthlyIndicators, patternConfluence, ftConflict, sectorComparison, multiTimeframe, language } = input;
   const { quote } = stock;
   const { rsi, ma, macd, volume, sr } = indicators;

   const langInstruction = language === 'hi'
      ? '\n\nIMPORTANT: Write your ENTIRE analysis in HINDI (Devanagari script). Keep numbers, prices, and stock symbols in English.\n'
      : '';

   // Multi-timeframe section
   let mtfSection = '';
   if (weeklyIndicators) {
      mtfSection += `
WEEKLY TIMEFRAME:
  RSI: ${weeklyIndicators.rsi.value.toFixed(1)} (${weeklyIndicators.rsi.interpretation})
  MACD: ${weeklyIndicators.macd.trend}
  MA Trend: ${weeklyIndicators.ma.trend}
  SMA20: ₹${weeklyIndicators.ma.sma20.toFixed(2)}, SMA50: ₹${weeklyIndicators.ma.sma50.toFixed(2)}`;
   }
   if (monthlyIndicators) {
      mtfSection += `
MONTHLY TIMEFRAME:
  RSI: ${monthlyIndicators.rsi.value.toFixed(1)} (${monthlyIndicators.rsi.interpretation})
  MACD: ${monthlyIndicators.macd.trend}
  MA Trend: ${monthlyIndicators.ma.trend}`;
   }

   // Timeframe biases
   let biasSection = '';
   if (multiTimeframe) {
      biasSection = `
TIMEFRAME BIASES:
  Daily:   ${multiTimeframe.timeframes['1D']?.trend?.toUpperCase() || 'N/A'}
  Weekly:  ${multiTimeframe.timeframes['1W']?.trend?.toUpperCase() || 'N/A'}
  Monthly: ${multiTimeframe.timeframes['1M']?.trend?.toUpperCase() || 'N/A'}
  Overall alignment: ${multiTimeframe.alignment || 'N/A'}`;
   }

   // Confluence
   let confluenceSection = '';
   if (patternConfluence) {
      confluenceSection = `
TIMEFRAME CONFLUENCE:
  Bullish timeframes: ${patternConfluence.bullishTimeframes?.join(', ') || 'None'}
  Bearish timeframes: ${patternConfluence.bearishTimeframes?.join(', ') || 'None'}
  Agreement score: ${patternConfluence.score}/100 (${patternConfluence.agreement})`;
   }

   // News
   let newsSection = '';
   if (news.breakingNews && news.breakingNews.length > 0) {
      newsSection = `
BREAKING NEWS:
${news.breakingNews.map((n: any) => `  - [${n.sentiment.toUpperCase()}] ${n.title}`).join('\n')}
  Impact: ${news.breakingImpact}`;
   } else {
      newsSection = `
NEWS (last 72 hours):
  Overall sentiment: ${news.sentiment} (Score: ${news.sentimentScore}%)`;
   }

   // Fundamentals
   const fundSection = `
FUNDAMENTALS:
  Valuation: ${fundamentals.valuation} (PE: ${fundamentals.metrics.peRatio || 'N/A'}, PB: ${fundamentals.metrics.pbRatio || 'N/A'})
  Growth: ${fundamentals.growth}
  Dividend Yield: ${fundamentals.metrics.dividendYield || 'N/A'}%
${ftConflict?.hasConflict ? `  ⚠️ Fundamental-Technical Conflict: ${ftConflict.conflictType}` : '  No fundamental-technical conflict'}`;

   // Sector
   let sectorSection = '';
   if (sectorComparison) {
      sectorSection = `
SECTOR COMPARISON:
  Verdict: ${sectorComparison.verdict}
  Stock change: ${sectorComparison.stockChange?.toFixed(2) || 'N/A'}%
  Sector change: ${sectorComparison.sectorChange?.toFixed(2) || 'N/A'}%
  Outperformance: ${sectorComparison.outperformance?.toFixed(2) || 'N/A'}%`;
   }

   // System pre-analysis
   let systemSection = '';
   if (input.confidenceResult) {
      const cr = input.confidenceResult;
      systemSection = `
SYSTEM PRE-ANALYSIS (our system already computed this — use as reference):
  Direction: ${cr.direction?.direction || 'N/A'}
  Conviction: ${cr.direction?.conviction || 'N/A'}%
  Confidence Score: ${cr.score}/100
  Recommendation: ${cr.recommendation}
  Key signals: ${cr.direction?.signalDetails?.slice(0, 6).join(', ') || 'N/A'}`;
   }

   const patternInfo = patterns.primary
      ? `${patterns.primary.name} (${patterns.primary.confidence}% confidence, type: ${patterns.primary.type || 'N/A'})`
      : 'No clear pattern detected';

   return `You are a stock market analyst. Analyze ALL the data below and give a clear trading recommendation.
${langInstruction}
READ EVERY SECTION before making your decision. Do not skip any data.

=====================================
STOCK: ${quote.symbol}
=====================================

PRICE DATA:
  Current: ₹${quote.price}
  Previous Close: ₹${quote.previousClose}
  Day Change: ${quote.changePercent >= 0 ? '+' : ''}${quote.changePercent}%
  Day Range: ₹${quote.dayLow} - ₹${quote.dayHigh}
  Volume: ${quote.volume.toLocaleString()} (${volume.ratio.toFixed(2)}x average)
  Volume trend: ${volume.trend}

DAILY TECHNICAL INDICATORS:
  RSI (14): ${rsi.value.toFixed(1)} — ${rsi.interpretation}
  MACD: ${macd.trend} (line: ${macd.macd}, signal: ${macd.signal}, histogram: ${macd.histogram})
  MA Trend: ${ma.trend}
  SMA20: ₹${ma.sma20.toFixed(2)}, SMA50: ₹${ma.sma50.toFixed(2)}, SMA200: ₹${ma.sma200.toFixed(2)}
  EMA9: ₹${ma.ema9.toFixed(2)}, EMA21: ₹${ma.ema21.toFixed(2)}
  Support: ₹${sr.support} | Resistance: ₹${sr.resistance}

PATTERN: ${patternInfo}
TREND: ${patterns.trend.direction} (strength: ${patterns.trend.strength}%)
${mtfSection}
${biasSection}
${confluenceSection}
${fundSection}
${sectorSection}
${newsSection}
${systemSection}

=====================================
HOW TO ANALYZE — FOLLOW THESE STEPS
=====================================

STEP 1 — COUNT THE EVIDENCE
  Go through EVERY indicator and classify it as bullish, bearish, or neutral:
  - RSI: Oversold (<30) in UPTREND = bullish bounce. Oversold in DOWNTREND = falling knife (bearish).
         Overbought (>70) in UPTREND = momentum (mild bullish). Overbought in DOWNTREND = bearish.
  - MACD: Bullish, bearish, or neutral?
  - MA Trend: Price above key MAs = bullish, below = bearish
  - EMA9 vs EMA21: EMA9 > EMA21 = bullish crossover, EMA9 < EMA21 = bearish
  - Pattern: Is the detected pattern bullish or bearish?
  - Volume: High volume confirms the current move. Low volume = weak signal.
  - Weekly/Monthly: Higher timeframes confirming or contradicting daily?
  Write down your count: X bullish, Y bearish, Z neutral.

STEP 2 — DETERMINE DIRECTION
  - More bearish signals → stock is BEARISH
  - More bullish signals → stock is BULLISH
  - The dominant side gets probability = 55 + (signal_difference × 5), capped at 85
  - CRITICAL: Do NOT call a stock bullish just because RSI is oversold. If MAs, MACD, pattern, and weekly trend are all bearish, the stock IS bearish regardless of RSI.

STEP 3 — CREATE TRADE PLAN
  For the dominant direction, set realistic levels:
  - Entry: near current price or key technical level
  - Stop loss: beyond nearest support (if bullish) or resistance (if bearish)
  - Target 1: next key level (60-70% probability)
  - Target 2: further level (30-50% probability)
  - Risk-reward must be at least 1:1.5

STEP 4 — GIVE YOUR VERDICT

=====================================
WHAT I NEED FROM YOU
=====================================

1. VERDICT: BULLISH or BEARISH (one word + your confidence %)

2. TRADE PLAN:
   Action: BUY / SELL / HOLD
   Entry: ₹___
   Stop Loss: ₹___ (% risk)
   Target 1: ₹___ (probability %)
   Target 2: ₹___ (probability %)
   Risk-Reward: ___
   Holding Period: ___ days

3. KEY REASONING (2-3 lines):
   Which signals drove your decision? Cite specific numbers.

4. RISKS (bullet points):
   What could invalidate this trade?

5. TRIGGER:
   What specific price/event confirms entry?

Trading constraints: Capital ₹${TRADING.CAPITAL}, max risk ₹${TRADING.MAX_RISK}, swing trading (1-5 days).

Be DECISIVE. The market always leans one way — find that lean.`;
};
