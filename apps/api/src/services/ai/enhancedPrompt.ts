import type { StockData, TechnicalIndicators, PatternAnalysis, SMCAnalysis, SignalCard, CandlestickAnalysis, BollingerBandsResult } from '@stock-assist/shared';
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
   // v6: new data fields
   smcAnalysis?: SMCAnalysis;
   signalCard?: SignalCard;
   candlestickAnalysis?: CandlestickAnalysis;
   bollingerBands?: BollingerBandsResult;
   regime?: { regime: string; confidence: number; description: string };
   atr?: number;
}

export const buildUserFriendlyPrompt = (input: EnhancedPromptInput): string => {
   const { stock, indicators, patterns, news, fundamentals, weeklyIndicators, monthlyIndicators, patternConfluence, ftConflict, sectorComparison, multiTimeframe, language } = input;
   const { quote } = stock;
   const { rsi, ma, macd, volume, sr } = indicators;

   const langInstruction = language === 'hi'
      ? '\n\nIMPORTANT: Write your ENTIRE analysis in HINDI (Devanagari script). Keep numbers, prices, and stock symbols in English.\n'
      : '';

   // ─── Multi-timeframe ───
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

   // ─── Timeframe biases ───
   let biasSection = '';
   if (multiTimeframe) {
      biasSection = `
TIMEFRAME BIASES:
  Daily:   ${multiTimeframe.timeframes['1D']?.trend?.toUpperCase() || 'N/A'}
  Weekly:  ${multiTimeframe.timeframes['1W']?.trend?.toUpperCase() || 'N/A'}
  Monthly: ${multiTimeframe.timeframes['1M']?.trend?.toUpperCase() || 'N/A'}
  Overall alignment: ${multiTimeframe.alignment || 'N/A'} (score: ${multiTimeframe.alignmentScore ?? 'N/A'}/100)`;
   }

   // ─── Confluence ───
   let confluenceSection = '';
   if (patternConfluence) {
      confluenceSection = `
TIMEFRAME CONFLUENCE:
  Bullish timeframes: ${patternConfluence.bullishTimeframes?.join(', ') || 'None'}
  Bearish timeframes: ${patternConfluence.bearishTimeframes?.join(', ') || 'None'}
  Agreement score: ${patternConfluence.score}/100 (${patternConfluence.agreement})`;
   }

   // ─── News ───
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

   // ─── Fundamentals ───
   const fundSection = `
FUNDAMENTALS:
  Valuation: ${fundamentals.valuation} (PE: ${fundamentals.metrics.peRatio || 'N/A'}, PB: ${fundamentals.metrics.pbRatio || 'N/A'})
  Growth: ${fundamentals.growth}
  Dividend Yield: ${fundamentals.metrics.dividendYield || 'N/A'}%
${ftConflict?.hasConflict ? `  WARNING: Fundamental-Technical Conflict: ${ftConflict.conflictType}` : '  No fundamental-technical conflict'}`;

   // ─── Sector ───
   let sectorSection = '';
   if (sectorComparison) {
      sectorSection = `
SECTOR COMPARISON:
  Verdict: ${sectorComparison.verdict}
  Stock change: ${sectorComparison.stockChange?.toFixed(2) || 'N/A'}%
  Sector change: ${sectorComparison.sectorChange?.toFixed(2) || 'N/A'}%
  Outperformance: ${sectorComparison.outperformance?.toFixed(2) || 'N/A'}%`;
   }

   // ─── Market Regime (NEW) ───
   let regimeSection = '';
   if (input.regime) {
      regimeSection = `
MARKET REGIME: ${input.regime.regime.toUpperCase()} (${input.regime.confidence}% confidence)
  ${input.regime.description}`;
   }

   // ─── Bollinger Bands (NEW) ───
   let bollingerSection = '';
   if (input.bollingerBands) {
      const bb = input.bollingerBands;
      bollingerSection = `
  Bollinger Bands: Upper ₹${bb.upper.toFixed(2)} | Middle ₹${bb.middle.toFixed(2)} | Lower ₹${bb.lower.toFixed(2)}
  Price position: ${bb.position.replace(/_/g, ' ')} (%B: ${(bb.percentB * 100).toFixed(1)}%)`;
   }

   // ─── ATR (NEW) ───
   let atrSection = '';
   if (input.atr) {
      const atrPct = ((input.atr / quote.price) * 100).toFixed(2);
      atrSection = `
  ATR (14): ₹${input.atr.toFixed(2)} (${atrPct}% of price — ${Number(atrPct) > 3 ? 'HIGH volatility' : Number(atrPct) > 1.5 ? 'MODERATE volatility' : 'LOW volatility'})`;
   }

   // ─── Smart Money Concepts (NEW) ───
   let smcSection = '';
   if (input.smcAnalysis) {
      const smc = input.smcAnalysis;
      const unmitigatedOBs = smc.orderBlocks.filter(ob => ob.status === 'unmitigated');
      const unfilledFVGs = smc.fairValueGaps.filter(fvg => !fvg.filled);
      const recentCHoCH = smc.chochEvents.filter(e => e.confirmed);
      const recentSweeps = smc.liquiditySweeps.filter(s => s.confirmed);

      smcSection = `
SMART MONEY CONCEPTS (Institutional Flow):
  Market structure: ${smc.trendState.toUpperCase()}`;

      if (unmitigatedOBs.length > 0) {
         const nearestOB = unmitigatedOBs[unmitigatedOBs.length - 1];
         smcSection += `
  Order Blocks: ${unmitigatedOBs.length} unmitigated (nearest: ₹${nearestOB.zone.low.toFixed(2)}-₹${nearestOB.zone.high.toFixed(2)}, ${nearestOB.type})`;
      }

      if (unfilledFVGs.length > 0) {
         const nearestFVG = unfilledFVGs[unfilledFVGs.length - 1];
         smcSection += `
  Fair Value Gaps: ${unfilledFVGs.length} unfilled (nearest: ₹${nearestFVG.zone.low.toFixed(2)}-₹${nearestFVG.zone.high.toFixed(2)}, ${nearestFVG.type})`;
      }

      if (recentCHoCH.length > 0) {
         const latest = recentCHoCH[recentCHoCH.length - 1];
         smcSection += `
  Change of Character: YES — ${latest.type} at ₹${latest.priceAtEvent.toFixed(2)} (REVERSAL SIGNAL)`;
      }

      if (recentSweeps.length > 0) {
         const latest = recentSweeps[recentSweeps.length - 1];
         smcSection += `
  Liquidity Sweep: YES — ${latest.type} at ₹${latest.sweepExtreme.toFixed(2)} (REVERSAL SIGNAL)`;
      }

      if (smc.bosEvents.length > 0) {
         const latest = smc.bosEvents[smc.bosEvents.length - 1];
         smcSection += `
  Break of Structure: ${latest.type} at ₹${latest.priceAtEvent.toFixed(2)} (CONTINUATION)`;
      }
   }

   // ─── Candlestick Patterns (NEW) ───
   let candlestickSection = '';
   if (input.candlestickAnalysis) {
      const cs = input.candlestickAnalysis;
      if (cs.patterns.length > 0) {
         const topPatterns = cs.patterns.slice(0, 4).map(p =>
            `    - ${p.name} (${p.type}, ${p.strength})`
         ).join('\n');
         candlestickSection = `
CANDLESTICK PATTERNS:
${topPatterns}
  Bias: ${cs.dominantBias.toUpperCase()} | Score: ${(cs.compositeScore * 100).toFixed(0)}%`;
      }
   }

   // ─── Signal Card (NEW) ───
   let signalCardSection = '';
   if (input.signalCard && input.signalCard.status !== 'NO_SETUP') {
      const sc = input.signalCard;
      signalCardSection = `
SMART MONEY SIGNAL:
  Status: ${sc.status} | Direction: ${sc.direction.toUpperCase()} | Conviction: ${sc.convictionScore}/100
  ${sc.entryZone ? `Entry: ₹${sc.entryZone.entryZoneLow.toFixed(2)}-₹${sc.entryZone.entryZoneHigh.toFixed(2)} | SL: ₹${sc.entryZone.stopLoss.toFixed(2)} | T1: ₹${sc.entryZone.target1.toFixed(2)} | T2: ₹${sc.entryZone.target2.toFixed(2)}
  R:R = 1:${sc.entryZone.riskReward.toFixed(1)} | Trigger: ${sc.entryZone.entryTrigger}` : ''}
  Reasons: ${sc.explanation.slice(0, 3).join('; ')}`;
   }

   // ─── System pre-analysis (enhanced) ───
   let systemSection = '';
   if (input.confidenceResult) {
      const cr = input.confidenceResult;
      systemSection = `
SYSTEM PRE-ANALYSIS (quantitative model — high accuracy):
  Direction: ${cr.direction?.direction || 'N/A'} (conviction: ${cr.direction?.conviction || 'N/A'}%)
  Signal count: ${cr.direction?.bullishSignals || 0} bullish vs ${cr.direction?.bearishSignals || 0} bearish
  Confidence Score: ${cr.score}/100
  Recommendation: ${cr.recommendation}
  Key signals: ${cr.direction?.signalDetails?.slice(0, 8).join(', ') || 'N/A'}`;
   }

   const patternInfo = patterns.primary
      ? `${patterns.primary.name} (${patterns.primary.confidence}% confidence, type: ${patterns.primary.type || 'N/A'})`
      : 'No clear pattern detected';

   return `You are an expert Indian stock market analyst. Analyze ALL the data below and give a clear, actionable trading recommendation.
${langInstruction}
READ EVERY SECTION. This is a comprehensive dataset — use ALL of it.

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
${regimeSection}

DAILY TECHNICAL INDICATORS:
  RSI (14): ${rsi.value.toFixed(1)} — ${rsi.interpretation}
  MACD: ${macd.trend} (line: ${macd.macd}, signal: ${macd.signal}, histogram: ${macd.histogram})
  MA Trend: ${ma.trend}
  SMA20: ₹${ma.sma20.toFixed(2)}, SMA50: ₹${ma.sma50.toFixed(2)}, SMA200: ₹${ma.sma200.toFixed(2)}
  EMA9: ₹${ma.ema9.toFixed(2)}, EMA21: ₹${ma.ema21.toFixed(2)}
  Support: ₹${sr.support} | Resistance: ₹${sr.resistance}${bollingerSection}${atrSection}

PATTERN: ${patternInfo}
TREND: ${patterns.trend.direction} (strength: ${patterns.trend.strength}%)
${candlestickSection}
${smcSection}
${signalCardSection}
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

STEP 1 — WEIGHT THE EVIDENCE (signals are NOT equal)

Classify each signal as BULLISH, BEARISH, or NEUTRAL:

HIGH WEIGHT (these decide direction):
  - Weekly/Monthly trend (higher timeframe > daily)
  - Multi-timeframe alignment (>70 = strong)
  - Smart Money CHoCH or Liquidity Sweep (institutional signals)
  - Price vs SMA200 (long-term anchor)

MEDIUM WEIGHT (these confirm or deny):
  - MACD trend, EMA9 vs EMA21 crossover
  - ADX (>25 = trending, <20 = choppy/unreliable)
  - Volume (>1.3x = confirmed, <0.8x = weak)
  - Candlestick patterns, Bollinger position

LOW WEIGHT (context only — do NOT let these override higher tiers):
  - RSI alone (lagging indicator)
  - Single-day news (unless breaking with high impact)

RSI RULES:
  - RSI < 30 + DOWNTREND = FALLING KNIFE (BEARISH, not a bounce!)
  - RSI < 30 + UPTREND + weekly confirmation = potential bounce
  - RSI > 70 + strong UPTREND = momentum, stay BULLISH
  - RSI 40-60 = NEUTRAL, tells you nothing

STEP 2 — DETERMINE DIRECTION
  - High-weight signals decide. If they clearly lean one way → that IS the direction
  - The dominant side gets probability = 55 + (signal_advantage × 5), capped at 85
  - If ADX < 20 (ranging): cap at 65. If volume < 0.8x: cap at 70.

STEP 3 — CREATE TRADE PLAN
  Use support/resistance, order blocks, and FVG levels for realistic entries/exits.
  - Stop loss within ${TRADING.MAX_STOP_LOSS_PERCENT}% of entry
  - Risk-reward minimum ${TRADING.MIN_RISK_REWARD}:1

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
   Cite SPECIFIC data: RSI value, MACD trend, weekly bias, SMC events, candlestick patterns.
   Explain WHY these signals together point to your conclusion.

4. RISKS (bullet points):
   What could invalidate this trade?

5. TRIGGER:
   What specific price/event confirms entry?

Trading constraints: Capital ₹${TRADING.CAPITAL}, max risk ₹${TRADING.MAX_RISK}, swing trading (1-5 days).

Be DECISIVE. The market always leans one way — find that lean and commit to it.`;
};
