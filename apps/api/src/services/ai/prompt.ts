import type { StockData, TechnicalIndicators, PatternAnalysis, NewsAnalysis } from '@stock-assist/shared';
import { TRADING } from '@stock-assist/shared';

export interface PromptInput {
  stock: StockData;
  indicators: TechnicalIndicators;
  patterns: PatternAnalysis;
  news: NewsAnalysis;
  weeklyIndicators?: TechnicalIndicators;
  monthlyIndicators?: TechnicalIndicators;
  language?: string;
  patternConfluence?: any;
  fundamentals?: any;
  sectorComparison?: any;
  multiTimeframe?: any;
  adx?: any;
  systemDirection?: any;
}

export const buildPrompt = (input: PromptInput): string => {
  const { stock, indicators, patterns, news, language } = input;
  const { quote } = stock;
  const { rsi, ma, sr, volume, macd } = indicators;

  const langInstruction = language === 'hi'
    ? '\n\nIMPORTANT: Write ALL text fields (reasoning, risks, trigger, confirmation, factors) in HINDI (Devanagari script). Keep JSON keys, numbers, prices, and stock symbols in English.\n'
    : '';

  // Build multi-timeframe section
  let mtfSection = '';
  if (input.weeklyIndicators) {
    const w = input.weeklyIndicators;
    mtfSection += `
WEEKLY TIMEFRAME:
  RSI: ${w.rsi.value.toFixed(1)} (${w.rsi.interpretation})
  MACD: ${w.macd.trend}
  MA Trend: ${w.ma.trend}
  SMA20: ₹${w.ma.sma20.toFixed(2)}, SMA50: ₹${w.ma.sma50.toFixed(2)}`;
  }
  if (input.monthlyIndicators) {
    const m = input.monthlyIndicators;
    mtfSection += `
MONTHLY TIMEFRAME:
  RSI: ${m.rsi.value.toFixed(1)} (${m.rsi.interpretation})
  MACD: ${m.macd.trend}
  MA Trend: ${m.ma.trend}`;
  }

  // Confluence section
  let confluenceSection = '';
  if (input.patternConfluence) {
    const pc = input.patternConfluence;
    confluenceSection = `
TIMEFRAME CONFLUENCE:
  Bullish timeframes: ${pc.bullishTimeframes?.join(', ') || 'None'}
  Bearish timeframes: ${pc.bearishTimeframes?.join(', ') || 'None'}
  Agreement score: ${pc.score}/100 (${pc.agreement})`;
  }

  // Multi-timeframe bias
  let biasSection = '';
  if (input.multiTimeframe) {
    const mt = input.multiTimeframe;
    biasSection = `
TIMEFRAME BIASES:
  Daily:   ${mt.timeframes['1D']?.trend?.toUpperCase() || 'N/A'}
  Weekly:  ${mt.timeframes['1W']?.trend?.toUpperCase() || 'N/A'}
  Monthly: ${mt.timeframes['1M']?.trend?.toUpperCase() || 'N/A'}
  Overall alignment: ${mt.alignment || 'N/A'}`;
  }

  // Fundamentals
  let fundSection = '';
  if (input.fundamentals) {
    const f = input.fundamentals;
    fundSection = `
FUNDAMENTALS:
  Valuation: ${f.valuation} (PE: ${f.metrics?.peRatio || 'N/A'}, PB: ${f.metrics?.pbRatio || 'N/A'})
  Growth: ${f.growth}
  Dividend Yield: ${f.metrics?.dividendYield || 'N/A'}%`;
  }

  // Sector comparison
  let sectorSection = '';
  if (input.sectorComparison) {
    const sc = input.sectorComparison;
    sectorSection = `
SECTOR COMPARISON:
  Verdict: ${sc.verdict}
  Stock change: ${sc.stockChange?.toFixed(2) || 'N/A'}%
  Sector change: ${sc.sectorChange?.toFixed(2) || 'N/A'}%
  Outperformance: ${sc.outperformance?.toFixed(2) || 'N/A'}%`;
  }

  // ADX trend strength
  let adxSection = '';
  if (input.adx) {
    adxSection = `
  ADX: ${input.adx.adx?.toFixed(1) || 'N/A'} (${input.adx.trendStrength || 'N/A'})`;
  }

  // System direction hint
  let directionHint = '';
  if (input.systemDirection) {
    const sd = input.systemDirection;
    directionHint = `
SYSTEM PRE-ANALYSIS (for reference — you may agree or disagree):
  Direction: ${sd.direction}
  Conviction: ${sd.conviction}%
  Bullish signals: ${sd.bullishSignals}, Bearish signals: ${sd.bearishSignals}
  Key signals: ${sd.signalDetails?.slice(0, 6).join(', ') || 'N/A'}`;
  }

  const patternInfo = patterns.primary
    ? `${patterns.primary.name} (${patterns.primary.confidence}% confidence, type: ${patterns.primary.type || 'N/A'})`
    : 'No clear pattern detected';

  const newsItems = news.items?.slice(0, 3).map((n: any) => `  - [${n.sentiment}] ${n.title}`).join('\n') || '';

  return `You are a stock analyst. Your job is to analyze the data below and output a JSON trading recommendation.
${langInstruction}
READ ALL DATA CAREFULLY before deciding. Do not skip any section.

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
  Support: ₹${sr.support} | Resistance: ₹${sr.resistance}${adxSection}

PATTERN: ${patternInfo}
TREND: ${patterns.trend.direction} (strength: ${patterns.trend.strength}%)
${mtfSection}
${biasSection}
${confluenceSection}
${fundSection}
${sectorSection}

NEWS (last 72 hours):
  Overall sentiment: ${news.overallSentiment}
${newsItems || '  No significant news'}
${directionHint}

=====================================
YOUR TASK
=====================================

Analyze ALL the data above. Follow these steps IN ORDER:

STEP 1 — COUNT THE EVIDENCE
  Look at EVERY indicator and classify it as bullish, bearish, or neutral:
  - RSI: Is it oversold (<30 = bullish bounce potential), overbought (>70 = bearish), or mid-range?
    BUT: RSI oversold in a DOWNTREND = falling knife (BEARISH), not a bounce
  - MACD: Is trend bullish, bearish, or neutral?
  - MA Trend: Is price above or below key MAs?
  - EMA9 vs EMA21: Bullish crossover (EMA9 > EMA21) or bearish?
  - Pattern: Is the detected pattern bullish or bearish?
  - Volume: High volume confirms the current move. Low volume = weak signal.
  - Weekly/Monthly: Do higher timeframes confirm or contradict daily?
  - ADX: Above 25 = strong trend. Below 20 = weak/ranging.
  Write down: X bullish signals, Y bearish signals.

STEP 2 — DETERMINE DIRECTION
  - If bearish signals > bullish signals → stock is BEARISH
  - If bullish signals > bearish signals → stock is BULLISH
  - The side with more signals gets probability = 55 + (signal_difference × 5), capped at 85
  - The other side gets 100 minus that
  - CRITICAL: Do NOT call a stock BULLISH just because RSI is oversold if everything else is bearish.
    Oversold + downtrend = MORE SELLING likely, not a bounce.

STEP 3 — SET TRADE LEVELS
  For the DOMINANT direction:
  - Entry: realistic price range near current price or key level
  - Stop loss: beyond nearest support (if bullish) or resistance (if bearish)
  - Target 1: next support/resistance level (higher probability, 60-70%)
  - Target 2: further level (lower probability, 30-50%)
  - Risk-reward: must be at least 1:1.5
  For the MINORITY direction:
  - Same structure but inverted levels

STEP 4 — WRITE YOUR RECOMMENDATION
  - "recommendation" must be ONE of: "BUY", "SELL", "HOLD"
  - BUY = strong bullish evidence (probability >= 60%)
  - SELL = strong bearish evidence (probability >= 60%)
  - HOLD = mixed signals, no clear edge
  - NEVER write sentences like "Wait for clarity" or "Buy on dip to ₹X"
  - Just write the single word: BUY, SELL, or HOLD

=====================================
OUTPUT FORMAT — VALID JSON ONLY
=====================================

Return ONLY this JSON. No markdown, no code blocks, no explanation outside JSON.

{
  "stock": "${quote.symbol}",
  "currentPrice": ${quote.price},
  "bias": "BULLISH or BEARISH or NEUTRAL",
  "confidence": "HIGH or MEDIUM or LOW",
  "confidenceScore": <number 0-100>,
  "category": "STRONG_SETUP or NEUTRAL or AVOID",
  "recommendation": "BUY or SELL or HOLD",
  "reasoning": "<2-3 sentences explaining your logic with specific data points>",
  "risks": ["<risk 1>", "<risk 2>", "<risk 3>"],
  "timeframe": "swing",

  "bullish": {
    "probability": <number 0-100>,
    "score": <number 0-100>,
    "trigger": "<specific price or event>",
    "confirmation": "<what confirms the bullish move>",
    "tradePlan": {
      "action": "BUY",
      "entry": ["<lower entry ₹>", "<upper entry ₹>"],
      "stopLoss": "<₹ amount>",
      "stopLossPercent": "<percent as string>",
      "targets": [
        {"price": <number>, "probability": <number>},
        {"price": <number>, "probability": <number>}
      ],
      "riskReward": <number>,
      "potentialProfit": [<min>, <max>]
    },
    "factors": ["<bullish factor 1 with data>", "<bullish factor 2>"],
    "timeHorizon": "3-7 days"
  },

  "bearish": {
    "probability": <number 0-100>,
    "score": <number 0-100>,
    "trigger": "<specific price or event>",
    "confirmation": "<what confirms the bearish move>",
    "tradePlan": {
      "action": "SELL",
      "entry": ["<lower entry ₹>", "<upper entry ₹>"],
      "stopLoss": "<₹ amount>",
      "stopLossPercent": "<percent as string>",
      "targets": [
        {"price": <number>, "probability": <number>},
        {"price": <number>, "probability": <number>}
      ],
      "riskReward": <number>,
      "potentialProfit": [<min>, <max>]
    },
    "factors": ["<bearish factor 1 with data>", "<bearish factor 2>"],
    "timeHorizon": "3-7 days"
  }
}

RULES:
1. bullish.probability + bearish.probability MUST equal 100
2. The side with more technical evidence MUST have higher probability
3. If 4+ indicators agree on one direction, that side must have probability >= 65
4. Do NOT ignore the weekly/monthly timeframes — they matter MORE than daily for direction
5. "recommendation" must be exactly "BUY", "SELL", or "HOLD" — one word only
6. All prices must be realistic numbers based on the support/resistance levels given
7. Trading constraints: Max capital ₹${TRADING.CAPITAL}, max risk ₹${TRADING.MAX_RISK}, holding 1-5 days

Return ONLY valid JSON. No text before or after.`;
};
