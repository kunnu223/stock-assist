import type { StockData, TechnicalIndicators, PatternAnalysis, NewsAnalysis, SMCAnalysis, SignalCard, CandlestickAnalysis, BollingerBandsResult } from '@stock-assist/shared';
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
  // v6: new data fields
  smcAnalysis?: SMCAnalysis;
  signalCard?: SignalCard;
  candlestickAnalysis?: CandlestickAnalysis;
  bollingerBands?: BollingerBandsResult;
  regime?: { regime: string; confidence: number; description: string };
  atr?: number;
}

export const buildPrompt = (input: PromptInput): string => {
  const { stock, indicators, patterns, news, language } = input;
  const { quote } = stock;
  const { rsi, ma, sr, volume, macd } = indicators;

  const langInstruction = language === 'hi'
    ? '\n\nIMPORTANT: Write ALL text fields (reasoning, risks, trigger, confirmation, factors) in HINDI (Devanagari script). Keep JSON keys, numbers, prices, and stock symbols in English.\n'
    : '';

  // ─── Weekly / Monthly ───
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

  // ─── Confluence ───
  let confluenceSection = '';
  if (input.patternConfluence) {
    const pc = input.patternConfluence;
    confluenceSection = `
TIMEFRAME CONFLUENCE:
  Bullish timeframes: ${pc.bullishTimeframes?.join(', ') || 'None'}
  Bearish timeframes: ${pc.bearishTimeframes?.join(', ') || 'None'}
  Agreement score: ${pc.score}/100 (${pc.agreement})`;
  }

  // ─── Multi-timeframe bias ───
  let biasSection = '';
  if (input.multiTimeframe) {
    const mt = input.multiTimeframe;
    biasSection = `
TIMEFRAME BIASES:
  Daily:   ${mt.timeframes['1D']?.trend?.toUpperCase() || 'N/A'}
  Weekly:  ${mt.timeframes['1W']?.trend?.toUpperCase() || 'N/A'}
  Monthly: ${mt.timeframes['1M']?.trend?.toUpperCase() || 'N/A'}
  Overall alignment: ${mt.alignment || 'N/A'} (score: ${mt.alignmentScore ?? 'N/A'}/100)`;
  }

  // ─── Fundamentals ───
  let fundSection = '';
  if (input.fundamentals) {
    const f = input.fundamentals;
    fundSection = `
FUNDAMENTALS:
  Valuation: ${f.valuation} (PE: ${f.metrics?.peRatio || 'N/A'}, PB: ${f.metrics?.pbRatio || 'N/A'})
  Growth: ${f.growth}
  Dividend Yield: ${f.metrics?.dividendYield || 'N/A'}%`;
  }

  // ─── Sector ───
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

  // ─── ADX ───
  let adxSection = '';
  if (input.adx) {
    adxSection = `
  ADX: ${input.adx.adx?.toFixed(1) || 'N/A'} (${input.adx.trendStrength || 'N/A'}) — direction: ${input.adx.trendDirection || 'N/A'}`;
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

  // ─── Market Regime (NEW) ───
  let regimeSection = '';
  if (input.regime) {
    regimeSection = `
MARKET REGIME: ${input.regime.regime.toUpperCase()} (${input.regime.confidence}% confidence)
  ${input.regime.description}`;
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
SMART MONEY CONCEPTS (Institutional Flow Analysis):
  Market structure: ${smc.trendState.toUpperCase()}`;

    if (unmitigatedOBs.length > 0) {
      const nearestOB = unmitigatedOBs[unmitigatedOBs.length - 1];
      smcSection += `
  Order Blocks: ${unmitigatedOBs.length} unmitigated (nearest: ₹${nearestOB.zone.low.toFixed(2)}-₹${nearestOB.zone.high.toFixed(2)}, ${nearestOB.type})`;
    } else {
      smcSection += `
  Order Blocks: None unmitigated`;
    }

    if (unfilledFVGs.length > 0) {
      const nearestFVG = unfilledFVGs[unfilledFVGs.length - 1];
      smcSection += `
  Fair Value Gaps: ${unfilledFVGs.length} unfilled (nearest: ₹${nearestFVG.zone.low.toFixed(2)}-₹${nearestFVG.zone.high.toFixed(2)}, ${nearestFVG.type})`;
    } else {
      smcSection += `
  Fair Value Gaps: None unfilled`;
    }

    if (recentCHoCH.length > 0) {
      const latest = recentCHoCH[recentCHoCH.length - 1];
      smcSection += `
  Change of Character (CHoCH): YES — ${latest.type} at ₹${latest.priceAtEvent.toFixed(2)} (REVERSAL SIGNAL)`;
    }

    if (recentSweeps.length > 0) {
      const latest = recentSweeps[recentSweeps.length - 1];
      smcSection += `
  Liquidity Sweep: YES — ${latest.type} sweep at ₹${latest.sweepExtreme.toFixed(2)}, closed at ₹${latest.closePrice.toFixed(2)} (REVERSAL SIGNAL)`;
    }

    if (smc.bosEvents.length > 0) {
      const latest = smc.bosEvents[smc.bosEvents.length - 1];
      smcSection += `
  Break of Structure: ${latest.type} at ₹${latest.priceAtEvent.toFixed(2)} (CONTINUATION SIGNAL)`;
    }
  }

  // ─── Candlestick Patterns (NEW) ───
  let candlestickSection = '';
  if (input.candlestickAnalysis) {
    const cs = input.candlestickAnalysis;
    if (cs.patterns.length > 0) {
      const topPatterns = cs.patterns.slice(0, 4).map(p =>
        `    - ${p.name} (${p.type}, ${p.strength} strength)`
      ).join('\n');
      candlestickSection = `
CANDLESTICK PATTERNS (last 5 candles):
${topPatterns}
  Dominant bias: ${cs.dominantBias.toUpperCase()} (${cs.bullishCount} bullish, ${cs.bearishCount} bearish)
  Composite score: ${(cs.compositeScore * 100).toFixed(0)}% (positive = bullish, negative = bearish)`;
    }
  }

  // ─── Signal Card (NEW) ───
  let signalCardSection = '';
  if (input.signalCard && input.signalCard.status !== 'NO_SETUP') {
    const sc = input.signalCard;
    signalCardSection = `
PRE-MOVE DETECTION (Smart Money Signal):
  Status: ${sc.status}
  Direction: ${sc.direction.toUpperCase()}
  Conviction: ${sc.convictionScore}/100
  ${sc.entryZone ? `Entry zone: ₹${sc.entryZone.entryZoneLow.toFixed(2)} - ₹${sc.entryZone.entryZoneHigh.toFixed(2)}
  Stop loss: ₹${sc.entryZone.stopLoss.toFixed(2)} | Target 1: ₹${sc.entryZone.target1.toFixed(2)} | Target 2: ₹${sc.entryZone.target2.toFixed(2)}
  Risk:Reward = 1:${sc.entryZone.riskReward.toFixed(1)} | Entry trigger: ${sc.entryZone.entryTrigger}` : ''}
  Why: ${sc.explanation.slice(0, 3).join('; ')}`;
  }

  // ─── System Direction (enhanced) ───
  let directionHint = '';
  if (input.systemDirection) {
    const sd = input.systemDirection;
    directionHint = `
SYSTEM PRE-ANALYSIS (our quantitative model already computed this):
  Direction: ${sd.direction} (conviction: ${sd.conviction}%)
  Signal count: ${sd.bullishSignals} bullish vs ${sd.bearishSignals} bearish
  Key signals: ${sd.signalDetails?.slice(0, 8).join(', ') || 'N/A'}
  NOTE: Your analysis SHOULD align with this direction unless you find a clear error in the data.
  If you disagree, explain specifically which data point the system missed.`;
  }

  const patternInfo = patterns.primary
    ? `${patterns.primary.name} (${patterns.primary.confidence}% confidence, type: ${patterns.primary.type || 'N/A'})`
    : 'No clear pattern detected';

  const newsItems = news.items?.slice(0, 3).map((n: any) => `  - [${n.sentiment}] ${n.title}`).join('\n') || '';

  return `You are an expert Indian stock market analyst with deep knowledge of technical analysis, Smart Money Concepts (SMC), and price action. Your job is to analyze the comprehensive data below and output a JSON trading recommendation.
${langInstruction}
READ ALL DATA CAREFULLY. Every section matters. Do not skip anything.

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
  Support: ₹${sr.support} | Resistance: ₹${sr.resistance}${adxSection}${bollingerSection}${atrSection}

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

NEWS (last 72 hours):
  Overall sentiment: ${news.overallSentiment}
${newsItems || '  No significant news'}
${directionHint}

=====================================
ANALYSIS METHODOLOGY — FOLLOW THIS EXACTLY
=====================================

You have been given an unusually rich dataset. Most analysts only see price + RSI + MACD.
You have: price action, 3 timeframes, Smart Money Concepts, candlestick patterns, regime classification, fundamentals, news, sector data, and a pre-computed system direction. USE ALL OF IT.

STEP 1 — WEIGHT THE EVIDENCE (not all signals are equal)

Classify each signal as BULLISH, BEARISH, or NEUTRAL. Assign weight by importance:

TIER 1 — HIGH WEIGHT (these decide direction):
  • Weekly/Monthly trend direction (higher timeframe = higher weight)
  • Multi-timeframe alignment score (>70 = strong agreement)
  • Smart Money CHoCH or Liquidity Sweep (institutional reversal signals)
  • Price vs SMA200 (long-term trend anchor)

TIER 2 — MEDIUM WEIGHT (these confirm or deny):
  • Daily MACD trend
  • EMA9 vs EMA21 crossover
  • ADX trend strength (>25 = trending, <20 = choppy/unreliable)
  • Volume confirmation (>1.3x average = confirmed, <0.8x = unconfirmed)
  • Candlestick patterns (composite score)
  • Bollinger Band position

TIER 3 — LOW WEIGHT (context only, do NOT let these override Tier 1-2):
  • RSI alone (RSI is a lagging indicator — do NOT base your entire thesis on RSI)
  • News sentiment (unless breaking news with high impact)
  • Single-day price change

CRITICAL RULES FOR RSI:
  • RSI < 30 in a DOWNTREND = falling knife = BEARISH (not a bounce opportunity)
  • RSI < 30 in an UPTREND with weekly confirmation = potential bounce = mildly BULLISH
  • RSI > 70 in a strong UPTREND = momentum continuation = keep BULLISH
  • RSI > 70 with weakening MACD + high volume = exhaustion = BEARISH
  • RSI 40-60 = tells you NOTHING — ignore it

REGIME-SPECIFIC RULES:
  • TRENDING regime: Trust MACD, ADX, and MAs. Patterns work well. Follow the trend.
  • RANGING regime: ADX < 20 means indicators are UNRELIABLE. Reduce confidence. Prefer mean-reversion.
  • VOLATILE regime: Widen stops, reduce position size. Only take trades with strong SMC confirmation.
  • EVENT-DRIVEN regime: News dominates. Technical levels may not hold.

STEP 2 — DETERMINE DIRECTION

Count your weighted signals:
  - If Tier 1 signals clearly lean one way → that IS the direction (regardless of Tier 3)
  - If Tier 1 is mixed → use Tier 2 as tiebreaker
  - If everything is mixed → direction is NEUTRAL → recommend HOLD

Probability rules:
  - The dominant side gets: 55 + (weighted_signal_advantage × 5), capped at 85
  - The other side gets: 100 minus dominant
  - If ADX < 20 (ranging): cap max probability at 65 (signals are unreliable)
  - If volume < 0.8x average: cap max probability at 70 (move is unconfirmed)

STEP 3 — SET TRADE LEVELS

Use the support/resistance, order blocks, and FVG levels from the data:
  For BULLISH:
  - Entry: near current price or nearest bullish order block
  - Stop loss: below nearest support or order block low (must be within ${TRADING.MAX_STOP_LOSS_PERCENT}% of entry)
  - Target 1: nearest resistance or bearish order block
  - Target 2: next resistance level beyond Target 1
  For BEARISH:
  - Entry: near current price or nearest bearish order block
  - Stop loss: above nearest resistance (must be within ${TRADING.MAX_STOP_LOSS_PERCENT}% of entry)
  - Target 1: nearest support or bullish order block
  - Target 2: next support level beyond Target 1
  - Risk-reward MUST be at least ${TRADING.MIN_RISK_REWARD}:1

STEP 4 — RECOMMENDATION

Based on your analysis:
  - "BUY" = clear bullish direction with probability >= 60% AND risk-reward >= ${TRADING.MIN_RISK_REWARD}:1
  - "SELL" = clear bearish direction with probability >= 60% AND risk-reward >= ${TRADING.MIN_RISK_REWARD}:1
  - "HOLD" = mixed signals, no clear edge, OR regime is ranging with ADX < 20
  - Output EXACTLY one word: "BUY", "SELL", or "HOLD"

=====================================
OUTPUT FORMAT — VALID JSON ONLY
=====================================

Return ONLY this JSON. No markdown, no code blocks, no text before or after.

{
  "stock": "${quote.symbol}",
  "currentPrice": ${quote.price},
  "bias": "BULLISH or BEARISH or NEUTRAL",
  "confidence": "HIGH or MEDIUM or LOW",
  "confidenceScore": <number 0-100>,
  "category": "STRONG_SETUP or NEUTRAL or AVOID",
  "recommendation": "BUY or SELL or HOLD",
  "reasoning": "<2-3 sentences. Cite specific numbers from the data: RSI value, MACD trend, weekly bias, SMC events, candlestick patterns. Explain WHY these signals together point to your conclusion.>",
  "risks": ["<risk 1>", "<risk 2>", "<risk 3>"],
  "timeframe": "swing",

  "bullish": {
    "probability": <number 0-100>,
    "score": <number 0-100>,
    "trigger": "<specific price level or event that activates the bullish trade>",
    "confirmation": "<what needs to happen AFTER trigger to confirm entry>",
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
    "factors": ["<bullish factor 1 with specific data point>", "<bullish factor 2>"],
    "timeHorizon": "3-7 days"
  },

  "bearish": {
    "probability": <number 0-100>,
    "score": <number 0-100>,
    "trigger": "<specific price level or event that activates the bearish trade>",
    "confirmation": "<what needs to happen AFTER trigger to confirm entry>",
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
    "factors": ["<bearish factor 1 with specific data point>", "<bearish factor 2>"],
    "timeHorizon": "3-7 days"
  }
}

HARD RULES (violation = invalid output):
1. bullish.probability + bearish.probability MUST equal 100
2. The side with more WEIGHTED evidence MUST have higher probability
3. If 3+ Tier-1 indicators agree → that side MUST have probability >= 65
4. Weekly/Monthly trend OVERRIDES daily signals for direction
5. "recommendation" = exactly "BUY", "SELL", or "HOLD" — one word, no sentences
6. All prices must be realistic (based on support/resistance/order block levels given)
7. If the system pre-analysis says BEARISH but you output BULLISH (or vice versa), you MUST explain why in reasoning
8. Trading constraints: Max capital ₹${TRADING.CAPITAL}, max risk ₹${TRADING.MAX_RISK}, max stop loss ${TRADING.MAX_STOP_LOSS_PERCENT}%, holding 1-5 days

Return ONLY valid JSON.`;
};
