/**
 * Commodity AI Prompt Builder
 * Generates a multi-horizon prompt for commodity analysis
 * @module @stock-assist/api/services/commodity/prompt
 */

import type { TechnicalIndicators } from '@stock-assist/shared';
import type { CommodityPriceData, DXYData } from './data';
import type { SeasonalityResult } from './seasonality';
import type { MacroContext } from './macroContext';
import type { PriceVolumeSignal, CommodityConfidenceResult } from './indicators';
import type { CrashDetectionResult } from './crashDetection';

export interface CommodityPromptInput {
  commodity: CommodityPriceData;
  dxy: DXYData;
  indicators: TechnicalIndicators;
  weeklyIndicators?: TechnicalIndicators;
  seasonality: SeasonalityResult;
  macro: MacroContext;
  priceVolume: PriceVolumeSignal;
  confidence: CommodityConfidenceResult;
  crash: CrashDetectionResult;
  newsHeadlines: string[];
  language?: string;
  exchange?: string;
  exchangePricing?: {
    currencySymbol: string;
    currency: string;
    unit: string;
    price: number;
    dayHigh: number;
    dayLow: number;
    support: number;
    resistance: number;
    atr: number;
  };
}

/**
 * Build the commodity analysis prompt
 */
export function buildCommodityPrompt(input: CommodityPromptInput): string {
  const { commodity, dxy, indicators, weeklyIndicators, seasonality, macro, priceVolume, confidence, crash, newsHeadlines, language, exchange, exchangePricing } = input;

  const langInstruction = language === 'hi'
    ? 'IMPORTANT: Provide the response in HINDI language (Devanagari script) for all text fields (summary, reasoning, action, etc). Keep JSON keys in English.'
    : '';

  // Determine currency context based on exchange
  const isINR = exchange === 'MCX' || exchange === 'SPOT';
  const cs = isINR && exchangePricing ? exchangePricing.currencySymbol : '$';
  const price = isINR && exchangePricing ? exchangePricing.price : commodity.currentPrice;
  const dayLow = isINR && exchangePricing ? exchangePricing.dayLow : commodity.dayLow;
  const dayHigh = isINR && exchangePricing ? exchangePricing.dayHigh : commodity.dayHigh;
  const support = isINR && exchangePricing ? exchangePricing.support : indicators.sr.support;
  const resistance = isINR && exchangePricing ? exchangePricing.resistance : indicators.sr.resistance;
  const atr = isINR && exchangePricing ? exchangePricing.atr : indicators.atr;
  const unit = isINR && exchangePricing ? exchangePricing.unit : '';
  const fmtPrice = (v: number) => isINR ? Math.round(v).toLocaleString('en-IN') : v.toFixed(2);

  const exchangeInstruction = isINR
    ? `\nIMPORTANT CURRENCY INSTRUCTION: The user is viewing this on ${exchange} (India). ALL price values in your response MUST be in INR (₹). Do NOT use dollar ($) amounts anywhere — not in text, not in price fields, not in reasoning. Use ₹ symbol for all prices. Unit: ${unit}.`
    : '';

  return `You are an expert commodity futures analyst. Analyze ${commodity.name} (${commodity.symbol}) and provide a structured multi-horizon trading plan.

${langInstruction}
${exchangeInstruction}

## CURRENT MARKET DATA (${exchange || 'COMEX'})
- **Price**: ${cs}${fmtPrice(price)} (${commodity.changePercent >= 0 ? '+' : ''}${commodity.changePercent.toFixed(2)}%)
- **Day Range**: ${cs}${fmtPrice(dayLow)} - ${cs}${fmtPrice(dayHigh)}
- **Volume**: ${commodity.volume.toLocaleString()} contracts

## USD INDEX (DXY)
- **Current**: ${dxy.currentValue.toFixed(2)} (${dxy.changePercent >= 0 ? '+' : ''}${dxy.changePercent.toFixed(2)}%)
- **30-day Trend**: ${dxy.trend30d}
- **Impact**: ${macro.usdCorrelation.impact}

## TECHNICAL INDICATORS (Daily)
- **RSI(14)**: ${indicators.rsi.value.toFixed(1)} — ${indicators.rsi.interpretation}
- **MACD**: ${indicators.macd.macd.toFixed(3)} / Signal: ${indicators.macd.signal.toFixed(3)} / Histogram: ${indicators.macd.histogram.toFixed(3)} — ${indicators.macd.trend}
- **MA Trend**: ${indicators.ma.trend} (SMA20: ${indicators.ma.sma20.toFixed(2)}, SMA50: ${indicators.ma.sma50.toFixed(2)})
- **S/R**: Support ${cs}${fmtPrice(support)} | Resistance ${cs}${fmtPrice(resistance)} | Pivot ${cs}${fmtPrice(indicators.sr.pivot)}
- **ATR**: ${fmtPrice(atr)}
- **Volume Trend**: ${indicators.volume.trend} (ratio: ${indicators.volume.ratio.toFixed(2)}x)
${weeklyIndicators ? `
## WEEKLY INDICATORS
- **RSI(14)**: ${weeklyIndicators.rsi.value.toFixed(1)} — ${weeklyIndicators.rsi.interpretation}
- **MACD Trend**: ${weeklyIndicators.macd.trend}
- **MA Trend**: ${weeklyIndicators.ma.trend}
` : ''}

## PRICE-VOLUME ANALYSIS
- **Signal**: ${priceVolume.signal}
- **Detail**: ${priceVolume.description}

## SEASONALITY
- **Current Month**: ${seasonality.currentMonth.monthName} — **${seasonality.currentMonth.bias}** (${seasonality.currentMonth.winRate}% historical win rate)
- **Reason**: ${seasonality.currentMonth.explanation}
- **Next Month**: ${seasonality.nextMonth.monthName} — ${seasonality.nextMonth.bias}
- **Quarter Outlook**: ${seasonality.quarterOutlook}

## MACRO CONTEXT
- **Overall Macro Bias**: ${macro.overallBias}
- **USD Correlation**: ${macro.usdCorrelation.direction} (strength: ${macro.usdCorrelation.strength}%)
${macro.ratios.map(r => `- **${r.name}**: ${r.ratio} — ${r.interpretation}`).join('\n')}

## CRASH DETECTION
- **Risk Level**: ${crash.overallRisk} (probability: ${crash.probability}%)
${crash.signals.filter(s => s.triggered).map(s => `- ⚠️ ${s.name}: ${s.description}`).join('\n') || '- All clear, no major crash signals'}

## SYSTEM CONFIDENCE
- **Score**: ${confidence.score}% (${confidence.direction})
- **Recommendation**: ${confidence.recommendation}
- **Breakdown**: Tech ${confidence.breakdown.technical}% | Season ${confidence.breakdown.seasonality}% | Macro ${confidence.breakdown.macro}% | PV ${confidence.breakdown.priceVolume}% | CrashRisk ${confidence.breakdown.crashRisk}%

## RECENT NEWS
${newsHeadlines.length > 0 ? newsHeadlines.slice(0, 5).map((h, i) => `${i + 1}. ${h}`).join('\n') : 'No significant news'}

---

## YOUR TASK
Provide a multi-horizon analysis in **strict JSON** format. No markdown, no code blocks, just pure JSON.

CRITICAL RULES:
1. Today action is about CURRENT CONDITIONS — what to do RIGHT NOW
2. Tomorrow plan must include CONDITIONAL TRIGGERS (if X then Y)
3. Next week must describe the most likely SCENARIO with probability
4. All price levels MUST be realistic (within ATR range of current price)
5. Confidence between 20-95 only; higher = more conviction
6. If system confidence is ${confidence.score}%, your confidence should be within ±15 of it
7. Stop losses MUST always be tighter than targets (risk/reward > 1.5)

PLAN B RULES (MANDATORY — Loss Prevention):
8. Every horizon MUST include a "planB" — what to do if the trade goes AGAINST you
9. Plan B must define a step-by-step recovery strategy with exact price levels
10. Include max acceptable loss amount and recovery timeline
11. Plan B steps should escalate: first HOLD (if small dip), then AVERAGE (if moderate dip), then EXIT (if large dip)
12. Reference ATR (${indicators.atr?.toFixed(2) || 'N/A'}) for realistic loss thresholds

INDIA MARKET CONTEXT:
- This commodity trades on Indian MCX (9:00 AM – 11:30 PM IST)
- Indian traders care about gold/silver for festivals (Dhanteras, Diwali, Akshaya Tritiya)
- MCX lot sizes matter for risk calculation
- Consider USD/INR movement impact on Indian prices

CONFIDENCE CALIBRATION:
- If multiple indicators conflict, reduce confidence by 10-15%
- If crash risk is HIGH/CRITICAL, max confidence should be 50%
- If seasonality and technicals align, boost confidence by 5-10%
- Never be more than 80% confident unless 4+ indicators agree

Respond with this EXACT JSON structure:
{
  "overallBias": "BULLISH" | "BEARISH" | "NEUTRAL",
  "confidenceScore": <number 20-95>,
  "summary": "<1-2 sentence executive summary>",
  "today": {
    "action": "BUY" | "SELL" | "HOLD" | "WAIT",
    "reasoning": "<2-3 sentences explaining today's outlook>",
    "confidence": <number 20-95>,
    "urgency": "ACT_NOW" | "MONITOR" | "WAIT",
    "entry": [<low>, <high>],
    "stopLoss": <number>,
    "target": <number>,
    "risks": ["<risk1>", "<risk2>"],
    "validity": "<time validity>",
    "planB": {
      "scenario": "<what happens if price moves against you, e.g. 'Price drops 3% after buying'>",
      "action": "HOLD" | "AVERAGE_DOWN" | "EXIT" | "HEDGE",
      "reasoning": "<why this Plan B is the right response>",
      "recoveryTarget": <price at which you recover losses>,
      "maxLoss": "<max acceptable loss, e.g. '2-3% of position'>",
      "timeline": "<how long to wait for recovery>",
      "steps": [
        "<Step 1: what to do if drops 1-2%, e.g. 'Hold — normal volatility within ATR range'>",
        "<Step 2: what to do if drops 3-5%, e.g. 'Add 25% more at $X to average down'>",
        "<Step 3: what to do if drops 5%+, e.g. 'Exit at $X — max loss $Y'>"
      ]
    }
  },
  "tomorrow": {
    "action": "<conditional action>",
    "confidence": <number 20-95>,
    "conditions": [
      {
        "trigger": "<exact condition>",
        "action": "<what to do>",
        "entry": [<low>, <high>],
        "stopLoss": <number>,
        "target": <number>
      }
    ],
    "watchLevels": [<level1>, <level2>, <level3>],
    "newsToWatch": ["<event1>", "<event2>"],
    "planB": {
      "scenario": "<what if yesterday's trade went wrong>",
      "action": "HOLD" | "AVERAGE_DOWN" | "EXIT" | "REVERSE",
      "reasoning": "<recovery logic for next day>",
      "recoveryTarget": <number>,
      "maxLoss": "<max loss tolerance>",
      "timeline": "<recovery window>",
      "steps": ["<step1>", "<step2>", "<step3>"]
    }
  },
  "nextWeek": {
    "scenario": "BULLISH" | "BEARISH" | "RANGE_BOUND",
    "probability": <number 50-90>,
    "reasoning": "<2-3 sentences>",
    "targetRange": [<low>, <high>],
    "strategy": "<swing trade approach>",
    "keyEvents": [
      {"date": "<date>", "event": "<name>", "impact": "HIGH" | "MEDIUM" | "LOW"}
    ],
    "planB": {
      "scenario": "<what if weekly thesis breaks down>",
      "action": "HOLD" | "REDUCE" | "EXIT" | "REVERSE",
      "reasoning": "<strategic recovery for week-long position>",
      "recoveryTarget": <number>,
      "maxLoss": "<max weekly loss tolerance>",
      "timeline": "<1-2 weeks>",
      "steps": ["<step1>", "<step2>", "<step3>"]
    }
  },
  "newsSentiment": "positive" | "negative" | "neutral"
}`;
}

/**
 * Build a user-friendly commodity prompt for copying to other AI tools (ChatGPT, Claude, etc.)
 * Same data as the internal prompt but asks for clear, actionable, human-readable output
 */
export function buildUserFriendlyCommodityPrompt(input: CommodityPromptInput): string {
  const { commodity, dxy, indicators, weeklyIndicators, seasonality, macro, priceVolume, confidence, crash, newsHeadlines, language, exchange, exchangePricing } = input;

  const isINR = exchange === 'MCX' || exchange === 'SPOT';
  const cs = isINR && exchangePricing ? exchangePricing.currencySymbol : '$';
  const price = isINR && exchangePricing ? exchangePricing.price : commodity.currentPrice;
  const dayLow = isINR && exchangePricing ? exchangePricing.dayLow : commodity.dayLow;
  const dayHigh = isINR && exchangePricing ? exchangePricing.dayHigh : commodity.dayHigh;
  const support = isINR && exchangePricing ? exchangePricing.support : indicators.sr.support;
  const resistance = isINR && exchangePricing ? exchangePricing.resistance : indicators.sr.resistance;
  const atr = isINR && exchangePricing ? exchangePricing.atr : indicators.atr;
  const fmtPrice = (v: number) => isINR ? Math.round(v).toLocaleString('en-IN') : v.toFixed(2);

  const langInstruction = language === 'hi'
    ? '\n\n🗣️ IMPORTANT: Provide your ENTIRE response in HINDI (हिन्दी / Devanagari script). All analysis, reasoning, risks, and trade plan must be in Hindi. Only keep numbers, commodity symbols, and price values in English.\n'
    : '';

  return `You are an expert commodity futures analyst. Analyze the following data for ${commodity.name} (${commodity.symbol}) and give me a clear, actionable trading recommendation.${langInstruction}

📊 COMMODITY: ${commodity.name} (${commodity.symbol})
💰 CURRENT PRICE: ${cs}${fmtPrice(price)} (${commodity.changePercent >= 0 ? '+' : ''}${commodity.changePercent.toFixed(2)}%)
📈 Day Range: ${cs}${fmtPrice(dayLow)} - ${cs}${fmtPrice(dayHigh)}
📊 Volume: ${commodity.volume.toLocaleString()} contracts
💱 Exchange: ${exchange || 'COMEX'}

═══════════════════════════════════════
USD INDEX (DXY)
═══════════════════════════════════════
• Current: ${dxy.currentValue.toFixed(2)} (${dxy.changePercent >= 0 ? '+' : ''}${dxy.changePercent.toFixed(2)}%)
• 30-day Trend: ${dxy.trend30d}
• Impact on ${commodity.name}: ${macro.usdCorrelation.impact}

═══════════════════════════════════════
TECHNICAL INDICATORS
═══════════════════════════════════════

DAILY:
• RSI (14): ${indicators.rsi.value.toFixed(1)} (${indicators.rsi.interpretation})
• MACD: ${indicators.macd.trend} (MACD: ${indicators.macd.macd.toFixed(3)}, Signal: ${indicators.macd.signal.toFixed(3)})
• Moving Averages: ${indicators.ma.trend} (SMA20: ${indicators.ma.sma20.toFixed(2)}, SMA50: ${indicators.ma.sma50.toFixed(2)})
• Support: ${cs}${fmtPrice(support)} | Resistance: ${cs}${fmtPrice(resistance)}
• ATR: ${cs}${fmtPrice(atr)}
• Volume Trend: ${indicators.volume.trend} (${indicators.volume.ratio.toFixed(2)}x avg)

${weeklyIndicators ? `WEEKLY:
• RSI: ${weeklyIndicators.rsi.value.toFixed(1)} (${weeklyIndicators.rsi.interpretation})
• MACD: ${weeklyIndicators.macd.trend}
• MA Trend: ${weeklyIndicators.ma.trend}` : ''}

═══════════════════════════════════════
COMMODITY-SPECIFIC ANALYSIS
═══════════════════════════════════════

PRICE-VOLUME: ${priceVolume.signal} — ${priceVolume.description}

SEASONALITY:
• ${seasonality.currentMonth.monthName}: ${seasonality.currentMonth.bias} (${seasonality.currentMonth.winRate}% historical win rate)
• Reason: ${seasonality.currentMonth.explanation}
• Next Month: ${seasonality.nextMonth.monthName} — ${seasonality.nextMonth.bias}
• Quarter: ${seasonality.quarterOutlook}

MACRO CONTEXT:
• Overall Bias: ${macro.overallBias}
• USD Correlation: ${macro.usdCorrelation.direction} (strength: ${macro.usdCorrelation.strength}%)
${macro.ratios.map(r => `• ${r.name}: ${r.ratio} — ${r.interpretation}`).join('\n')}

CRASH DETECTION:
• Risk Level: ${crash.overallRisk} (${crash.probability}% probability)
${crash.signals.filter(s => s.triggered).map(s => `• ⚠️ ${s.name}: ${s.description}`).join('\n') || '• All clear — no crash signals'}

SYSTEM CONFIDENCE: ${confidence.score}% (${confidence.direction})
Breakdown: Tech ${confidence.breakdown.technical}% | Season ${confidence.breakdown.seasonality}% | Macro ${confidence.breakdown.macro}% | PV ${confidence.breakdown.priceVolume}% | CrashRisk ${confidence.breakdown.crashRisk}%

NEWS:
${newsHeadlines.length > 0 ? newsHeadlines.slice(0, 5).map((h, i) => `${i + 1}. ${h}`).join('\n') : 'No significant news'}

═══════════════════════════════════════
WHAT I NEED FROM YOU
═══════════════════════════════════════

Based on the above data, give me a CLEAR and CONCISE analysis:

1. 🎯 VERDICT: Is ${commodity.name} BULLISH or BEARISH right now? (One word + confidence %)

2. 📋 TRADE PLAN — 3 Horizons:

   TODAY:
   • Action: BUY / SELL / HOLD / WAIT
   • Entry: ${cs}___
   • Stop Loss: ${cs}___ (with % risk)
   • Target: ${cs}___

   TOMORROW (conditional):
   • If [trigger condition], then [action] at ${cs}___
   • Watch levels: ${cs}___, ${cs}___

   NEXT WEEK:
   • Scenario: Bullish / Bearish / Range-bound
   • Target Range: ${cs}___ to ${cs}___
   • Strategy: [brief approach]

3. 📝 KEY REASONING (2-3 lines max):
   Why this direction? What are the strongest signals?

4. ⚠️ RISKS (bullet points):
   What could go wrong?

5. 🛡️ PLAN B (if trade goes against you):
   • What to do if price drops/rises against position
   • Max acceptable loss
   • Recovery strategy

Keep the response SHORT and ACTIONABLE. No fluff. I need to make a trading decision based on this.`;
}
