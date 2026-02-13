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
}

/**
 * Build the commodity analysis prompt
 */
export function buildCommodityPrompt(input: CommodityPromptInput): string {
    const { commodity, dxy, indicators, weeklyIndicators, seasonality, macro, priceVolume, confidence, crash, newsHeadlines, language } = input;

    const langInstruction = language === 'hi'
        ? 'IMPORTANT: Provide the response in HINDI language (Devanagari script) for all text fields (summary, reasoning, action, etc). Keep JSON keys in English.'
        : '';

    return `You are an expert commodity futures analyst. Analyze ${commodity.name} (${commodity.symbol}) and provide a structured multi-horizon trading plan.

${langInstruction}

## CURRENT MARKET DATA
- **Price**: $${commodity.currentPrice.toFixed(2)} (${commodity.changePercent >= 0 ? '+' : ''}${commodity.changePercent.toFixed(2)}%)
- **Day Range**: $${commodity.dayLow.toFixed(2)} - $${commodity.dayHigh.toFixed(2)}
- **Volume**: ${commodity.volume.toLocaleString()} contracts
- **Volume**: ${commodity.volume.toLocaleString()} contracts

## USD INDEX (DXY)
- **Current**: ${dxy.currentValue.toFixed(2)} (${dxy.changePercent >= 0 ? '+' : ''}${dxy.changePercent.toFixed(2)}%)
- **30-day Trend**: ${dxy.trend30d}
- **Impact**: ${macro.usdCorrelation.impact}

## TECHNICAL INDICATORS (Daily)
- **RSI(14)**: ${indicators.rsi.value.toFixed(1)} — ${indicators.rsi.interpretation}
- **MACD**: ${indicators.macd.macd.toFixed(3)} / Signal: ${indicators.macd.signal.toFixed(3)} / Histogram: ${indicators.macd.histogram.toFixed(3)} — ${indicators.macd.trend}
- **MA Trend**: ${indicators.ma.trend} (SMA20: ${indicators.ma.sma20.toFixed(2)}, SMA50: ${indicators.ma.sma50.toFixed(2)})
- **S/R**: Support $${indicators.sr.support.toFixed(2)} | Resistance $${indicators.sr.resistance.toFixed(2)} | Pivot $${indicators.sr.pivot.toFixed(2)}
- **ATR**: ${indicators.atr?.toFixed(2) || 'N/A'}
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
    "validity": "<time validity>"
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
    "newsToWatch": ["<event1>", "<event2>"]
  },
  "nextWeek": {
    "scenario": "BULLISH" | "BEARISH" | "RANGE_BOUND",
    "probability": <number 50-90>,
    "reasoning": "<2-3 sentences>",
    "targetRange": [<low>, <high>],
    "strategy": "<swing trade approach>",
    "keyEvents": [
      {"date": "<date>", "event": "<name>", "impact": "HIGH" | "MEDIUM" | "LOW"}
    ]
  },
  "newsSentiment": "positive" | "negative" | "neutral"
}`;
}
