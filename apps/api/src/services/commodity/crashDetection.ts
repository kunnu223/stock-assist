/**
 * Market Crash Detection System
 * Monitors 4 crash signals: supply shock, demand collapse,
 * currency collapse, and geopolitical crisis
 * @module @stock-assist/api/services/commodity/crashDetection
 */

import type { OHLCData } from '@stock-assist/shared';
import type { DXYData, CommodityPriceData } from './data';

export type RiskLevel = 'EXTREME' | 'HIGH' | 'ELEVATED' | 'MODERATE' | 'LOW';

export interface CrashSignal {
    name: string;
    triggered: boolean;
    weight: number;         // Probability contribution when triggered
    severity: 'CRITICAL' | 'WARNING' | 'WATCH';
    description: string;
    data: Record<string, number | string>;
}

export interface CrashDetectionResult {
    overallRisk: RiskLevel;
    probability: number;    // 0-100
    signals: CrashSignal[];
    recommendations: string[];
    lastUpdated: string;
}

/**
 * Calculate price change over N days
 */
function priceChangeOverDays(history: OHLCData[], days: number): number {
    if (history.length < days + 1) return 0;
    const recent = history[history.length - 1].close;
    const past = history[history.length - 1 - days].close;
    return past > 0 ? ((recent - past) / past) * 100 : 0;
}

/**
 * Calculate max drawdown over history
 */
function calcMaxDrawdown(history: OHLCData[]): number {
    let peak = history[0]?.close || 0;
    let maxDD = 0;
    for (const bar of history) {
        if (bar.close > peak) peak = bar.close;
        const dd = ((peak - bar.close) / peak) * 100;
        if (dd > maxDD) maxDD = dd;
    }
    return maxDD;
}

/**
 * Detect supply shock
 * Trigger: Oil +20% in 30d OR Gas +30% in 30d
 */
function detectSupplyShock(
    commodity: CommodityPriceData,
    allCommodityHistories: Map<string, OHLCData[]>
): CrashSignal {
    // Check oil
    const oilHistory = allCommodityHistories.get('CRUDEOIL') || commodity.history;
    const oilChange30d = priceChangeOverDays(oilHistory, 30);

    // Check gas
    const gasHistory = allCommodityHistories.get('NATURALGAS') || [];
    const gasChange30d = priceChangeOverDays(gasHistory, 30);

    const oilShock = oilChange30d > 20;
    const gasShock = gasChange30d > 30;

    return {
        name: 'Supply Shock',
        triggered: oilShock || gasShock,
        weight: 30,
        severity: (oilShock && gasShock) ? 'CRITICAL' : oilShock || gasShock ? 'WARNING' : 'WATCH',
        description: oilShock
            ? `Oil surged ${oilChange30d.toFixed(1)}% in 30 days — potential supply disruption`
            : gasShock
                ? `Natural Gas surged ${gasChange30d.toFixed(1)}% in 30 days — supply concerns`
                : 'No supply shock detected',
        data: { oilChange30d: Number(oilChange30d.toFixed(1)), gasChange30d: Number(gasChange30d.toFixed(1)) },
    };
}

/**
 * Detect demand collapse
 * Trigger: Copper -10% in 30d (Dr. Copper signal)
 */
function detectDemandCollapse(
    commodity: CommodityPriceData,
    allCommodityHistories: Map<string, OHLCData[]>
): CrashSignal {
    const copperHistory = allCommodityHistories.get('COPPER') || commodity.history;
    const copperChange30d = priceChangeOverDays(copperHistory, 30);

    // Also check oil dropping alongside copper (double confirmation)
    const oilHistory = allCommodityHistories.get('CRUDEOIL') || [];
    const oilChange30d = priceChangeOverDays(oilHistory, 30);

    const copperCollapse = copperChange30d < -10;
    const doubleConfirm = copperCollapse && oilChange30d < -5;

    return {
        name: 'Demand Collapse',
        triggered: copperCollapse,
        weight: 40,
        severity: doubleConfirm ? 'CRITICAL' : copperCollapse ? 'WARNING' : 'WATCH',
        description: doubleConfirm
            ? `Dr. Copper signal: Copper ${copperChange30d.toFixed(1)}% + Oil ${oilChange30d.toFixed(1)}% — recession warning`
            : copperCollapse
                ? `Copper dropped ${copperChange30d.toFixed(1)}% — economic slowdown signal`
                : 'No demand collapse detected',
        data: { copperChange30d: Number(copperChange30d.toFixed(1)), oilChange30d: Number(oilChange30d.toFixed(1)) },
    };
}

/**
 * Detect currency collapse
 * Trigger: DXY +8% in 30 days
 */
function detectCurrencyCollapse(dxy: DXYData): CrashSignal {
    const dxyChange30d = priceChangeOverDays(dxy.history, 30);
    const triggered = dxyChange30d > 8;

    return {
        name: 'Currency (USD) Spike',
        triggered,
        weight: 20,
        severity: dxyChange30d > 12 ? 'CRITICAL' : triggered ? 'WARNING' : 'WATCH',
        description: triggered
            ? `USD surged ${dxyChange30d.toFixed(1)}% in 30 days — emerging market debt crisis risk`
            : `USD change: ${dxyChange30d >= 0 ? '+' : ''}${dxyChange30d.toFixed(1)}% (30d)`,
        data: { dxyChange30d: Number(dxyChange30d.toFixed(1)) },
    };
}

/**
 * Detect extreme volatility (proxy for geopolitical crisis)
 * Trigger: Max drawdown > 15% in last 30 days across multiple commodities
 */
function detectGeopoliticalCrisis(
    commodity: CommodityPriceData,
    allCommodityHistories: Map<string, OHLCData[]>,
    newsEventCount: number
): CrashSignal {
    const recentHistory = commodity.history.slice(-30);
    const maxDD = calcMaxDrawdown(recentHistory);

    // Check if multiple commodities are volatile
    let volatileCount = 0;
    for (const [, hist] of allCommodityHistories) {
        const recent = hist.slice(-30);
        if (recent.length > 5 && calcMaxDrawdown(recent) > 10) {
            volatileCount++;
        }
    }

    const triggered = (maxDD > 15 && volatileCount >= 2) || newsEventCount >= 3;

    return {
        name: 'Geopolitical / Volatility Crisis',
        triggered,
        weight: 15,
        severity: triggered && volatileCount >= 3 ? 'CRITICAL' : triggered ? 'WARNING' : 'WATCH',
        description: triggered
            ? `High volatility (${maxDD.toFixed(1)}% drawdown) + ${volatileCount} volatile commodities — risk-off mode`
            : `Market volatility normal (${maxDD.toFixed(1)}% max drawdown)`,
        data: { maxDrawdown: Number(maxDD.toFixed(1)), volatileCommodities: volatileCount, newsEvents: newsEventCount },
    };
}

/**
 * Run full crash detection
 */
export function detectMarketCrash(
    commodity: CommodityPriceData,
    dxy: DXYData,
    allCommodityHistories: Map<string, OHLCData[]>,
    newsHighSeverityCount: number = 0
): CrashDetectionResult {
    const signals: CrashSignal[] = [
        detectSupplyShock(commodity, allCommodityHistories),
        detectDemandCollapse(commodity, allCommodityHistories),
        detectCurrencyCollapse(dxy),
        detectGeopoliticalCrisis(commodity, allCommodityHistories, newsHighSeverityCount),
    ];

    // Calculate probability: sum of triggered signal weights
    const probability = signals
        .filter(s => s.triggered)
        .reduce((sum, s) => sum + s.weight, 0);

    // Determine risk level
    let overallRisk: RiskLevel;
    if (probability >= 60) overallRisk = 'EXTREME';
    else if (probability >= 40) overallRisk = 'HIGH';
    else if (probability >= 25) overallRisk = 'ELEVATED';
    else if (probability >= 10) overallRisk = 'MODERATE';
    else overallRisk = 'LOW';

    // Recommendations based on risk level
    const recommendations: string[] = [];
    if (overallRisk === 'EXTREME') {
        recommendations.push('🔴 REDUCE all commodity exposure immediately');
        recommendations.push('Consider hedging with options or inverse positions');
        recommendations.push('Move to cash or safe havens (Gold if not already)');
    } else if (overallRisk === 'HIGH') {
        recommendations.push('🟠 Tighten stop-losses to 50% of normal');
        recommendations.push('Reduce position sizes by 50%');
        recommendations.push('Monitor DXY and oil closely');
    } else if (overallRisk === 'ELEVATED') {
        recommendations.push('🟡 Monitor supply/demand signals closely');
        recommendations.push('Use tighter stops than normal');
    } else {
        recommendations.push('🟢 Normal risk environment — standard positioning OK');
    }

    return {
        overallRisk,
        probability: Math.min(100, probability),
        signals,
        recommendations,
        lastUpdated: new Date().toISOString(),
    };
}
