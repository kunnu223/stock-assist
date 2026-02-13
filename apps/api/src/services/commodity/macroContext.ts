/**
 * Macro Context Analyzer
 * USD correlation, inter-commodity ratios, macro scoring
 * @module @stock-assist/api/services/commodity/macroContext
 */

import type { OHLCData } from '@stock-assist/shared';
import type { DXYData, CommodityPriceData } from './data';

export interface USDCorrelation {
    direction: 'INVERSE' | 'POSITIVE' | 'NONE';
    strength: number;              // 0-100
    impact: string;                // Human-readable
    modifier: number;              // -10 to +10 confidence adjustment
    isConfirming: boolean;         // Does current USD move support commodity direction?
}

export interface InterCommodityRatio {
    ratio: number;
    name: string;
    interpretation: string;
    signal: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
}

export interface MacroContext {
    usdCorrelation: USDCorrelation;
    ratios: InterCommodityRatio[];
    overallBias: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
    modifier: number;              // Total macro modifier (-15 to +15)
}

/** Known correlation strengths: -1 (strong inverse) to +1 */
const USD_CORRELATIONS: Record<string, number> = {
    GOLD: -0.85,   // Strong inverse
    SILVER: -0.80,   // Strong inverse
    CRUDEOIL: -0.55,   // Moderate inverse
    NATURALGAS: -0.20,   // Weak
    COPPER: -0.45,   // Moderate inverse
};

/**
 * Analyze USD impact on commodity
 */
function analyzeUSDCorrelation(
    symbol: string,
    dxy: DXYData,
    commodityChangePercent: number
): USDCorrelation {
    const corrStrength = Math.abs(USD_CORRELATIONS[symbol] || 0);
    const corrDirection = (USD_CORRELATIONS[symbol] || 0) < 0 ? 'INVERSE' : 'POSITIVE';

    // Is current movement confirming the correlation?
    const usdUp = dxy.changePercent > 0;
    const commodityUp = commodityChangePercent > 0;

    let isConfirming: boolean;
    if (corrDirection === 'INVERSE') {
        isConfirming = (usdUp && !commodityUp) || (!usdUp && commodityUp);
    } else {
        isConfirming = (usdUp && commodityUp) || (!usdUp && !commodityUp);
    }

    // If fighting correlation, it's a warning signal
    const isFighting = !isConfirming && Math.abs(dxy.changePercent) > 0.3;

    let impact: string;
    let modifier: number;

    if (corrStrength < 0.3) {
        impact = 'USD has minimal impact on this commodity';
        modifier = 0;
    } else if (isConfirming) {
        if (dxy.trend30d === 'weakening') {
            impact = `USD weakening (${dxy.trend30d}) supports ${symbol} upside`;
            modifier = Math.round(corrStrength * 10);
        } else if (dxy.trend30d === 'strengthening') {
            impact = `USD strengthening pressures ${symbol} lower`;
            modifier = -Math.round(corrStrength * 10);
        } else {
            impact = 'USD stable — neutral macro backdrop';
            modifier = 0;
        }
    } else if (isFighting) {
        impact = `WARNING: ${symbol} moving against USD correlation — potential reversal`;
        modifier = -5;
    } else {
        impact = 'Mixed USD signals';
        modifier = 0;
    }

    return {
        direction: corrStrength < 0.3 ? 'NONE' : corrDirection,
        strength: Math.round(corrStrength * 100),
        impact,
        modifier,
        isConfirming,
    };
}

/**
 * Calculate inter-commodity ratios
 */
function analyzeRatios(
    symbol: string,
    currentPrice: number,
    correlatedPrices: Record<string, { price: number; change: number; changePercent: number }>
): InterCommodityRatio[] {
    const ratios: InterCommodityRatio[] = [];

    // Gold/Silver ratio
    if (symbol === 'GOLD' && correlatedPrices.SILVER) {
        const ratio = currentPrice / correlatedPrices.SILVER.price;
        ratios.push({
            ratio: Number(ratio.toFixed(2)),
            name: 'Gold/Silver Ratio',
            interpretation: ratio > 85 ? 'Silver extremely undervalued — favor silver'
                : ratio > 80 ? 'Silver undervalued relative to gold'
                    : ratio > 70 ? 'Normal range'
                        : 'Silver overvalued — favor gold',
            signal: ratio > 80 ? 'BEARISH' : ratio < 65 ? 'BULLISH' : 'NEUTRAL', // For gold specifically
        });
    }

    if (symbol === 'SILVER' && correlatedPrices.GOLD) {
        const ratio = correlatedPrices.GOLD.price / currentPrice;
        ratios.push({
            ratio: Number(ratio.toFixed(2)),
            name: 'Gold/Silver Ratio',
            interpretation: ratio > 85 ? 'Silver extremely cheap → STRONG BUY signal'
                : ratio > 80 ? 'Silver undervalued → BULLISH'
                    : ratio > 70 ? 'Normal range'
                        : 'Silver overvalued → cautious',
            signal: ratio > 80 ? 'BULLISH' : ratio < 65 ? 'BEARISH' : 'NEUTRAL',
        });
    }

    // Oil/Gas ratio
    if (symbol === 'CRUDEOIL' && correlatedPrices.NATURALGAS) {
        const ratio = currentPrice / correlatedPrices.NATURALGAS.price;
        ratios.push({
            ratio: Number(ratio.toFixed(1)),
            name: 'Oil/Gas Ratio',
            interpretation: ratio > 30 ? 'Gas undervalued vs oil — potential rebalancing'
                : ratio > 15 ? 'Normal ratio range'
                    : 'Gas overvalued vs oil',
            signal: 'NEUTRAL', // This ratio is more informational
        });
    }

    if (symbol === 'NATURALGAS' && correlatedPrices.CRUDEOIL) {
        const ratio = correlatedPrices.CRUDEOIL.price / currentPrice;
        ratios.push({
            ratio: Number(ratio.toFixed(1)),
            name: 'Oil/Gas Ratio',
            interpretation: ratio > 30 ? 'Gas relatively cheap → bullish mean-reversion potential'
                : ratio > 15 ? 'Normal'
                    : 'Gas comparatively expensive',
            signal: ratio > 30 ? 'BULLISH' : ratio < 15 ? 'BEARISH' : 'NEUTRAL',
        });
    }

    // Copper/Oil relationship (economic health)
    if (symbol === 'COPPER' && correlatedPrices.CRUDEOIL) {
        const oilChange = correlatedPrices.CRUDEOIL.changePercent;
        const signal = oilChange > 1 ? 'BULLISH' : oilChange < -1 ? 'BEARISH' : 'NEUTRAL';
        ratios.push({
            ratio: Number((currentPrice / correlatedPrices.CRUDEOIL.price).toFixed(3)),
            name: 'Copper/Oil Ratio',
            interpretation: signal === 'BULLISH'
                ? 'Rising oil = economic expansion → copper demand up'
                : signal === 'BEARISH'
                    ? 'Falling oil may signal economic slowdown → copper risk'
                    : 'Stable energy markets',
            signal,
        });
    }

    return ratios;
}

/**
 * Full macro context analysis
 */
export function analyzeMacroContext(
    commodity: CommodityPriceData,
    dxy: DXYData,
    correlatedPrices: Record<string, { price: number; change: number; changePercent: number }>
): MacroContext {
    const usdCorrelation = analyzeUSDCorrelation(commodity.symbol, dxy, commodity.changePercent);
    const ratios = analyzeRatios(commodity.symbol, commodity.currentPrice, correlatedPrices);

    // Overall macro bias: combine USD + ratios
    const ratioBias = ratios.filter(r => r.signal === 'BULLISH').length - ratios.filter(r => r.signal === 'BEARISH').length;
    const usdBias = usdCorrelation.modifier > 0 ? 1 : usdCorrelation.modifier < 0 ? -1 : 0;
    const totalBias = usdBias + ratioBias;

    const overallBias = totalBias >= 1 ? 'BULLISH' : totalBias <= -1 ? 'BEARISH' : 'NEUTRAL';

    // Combined modifier (cap at ±15)
    const ratioModifier = ratioBias * 3; // ±3 per ratio signal
    const totalModifier = Math.max(-15, Math.min(15, usdCorrelation.modifier + ratioModifier));

    return {
        usdCorrelation,
        ratios,
        overallBias,
        modifier: totalModifier,
    };
}
