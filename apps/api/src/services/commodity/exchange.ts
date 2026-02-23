/**
 * Exchange Conversion Engine
 * Converts COMEX USD prices to MCX (INR) and Spot/Hazar prices
 * @module @stock-assist/api/services/commodity/exchange
 */

import { fetchHistory } from '../data/yahooHistory';

// ── Exchange Types ──

export type Exchange = 'COMEX' | 'MCX' | 'SPOT';

export interface ExchangeInfo {
    exchange: Exchange;
    label: string;
    flag: string;
    currency: string;
    currencySymbol: string;
    unit: string;
}

export interface ExchangePricing {
    exchange: Exchange;
    label: string;
    currency: string;
    currencySymbol: string;
    unit: string;
    price: number;
    change: number;
    changePercent: number;
    dayHigh: number;
    dayLow: number;
    support: number;
    resistance: number;
    atr: number;
    usdInr: number;
    conversionNote: string;
}

// ── Exchange configs per commodity ──

interface MCXConversionConfig {
    /** MCX unit display name */
    unit: string;
    /** Conversion factor from COMEX unit to MCX unit (before INR conversion) */
    conversionFactor: number;
    /** Import duty + GST combined multiplier (e.g., 1.18 = 15% duty + 3% GST) */
    dutyMultiplier: number;
    /** Spot discount from MCX (negative = premium) */
    spotDiscountPercent: number;
}

/** 
 * MCX conversion formulas:
 * - Gold: COMEX $/troy oz → MCX ₹/10g
 *   1 troy oz = 31.1035g, so $/oz × USDINR / 31.1035 × 10 × duty
 * - Silver: COMEX $/troy oz → MCX ₹/kg
 *   $/oz × USDINR / 31.1035 × 1000 × duty
 * - Crude Oil: COMEX $/barrel → MCX ₹/barrel
 *   $/barrel × USDINR × duty
 * - Natural Gas: COMEX $/MMBtu → MCX ₹/MMBtu
 *   $/MMBtu × USDINR × duty
 * - Copper: COMEX $/lb → MCX ₹/kg
 *   $/lb × 2.20462 × USDINR × duty
 */
const MCX_CONFIGS: Record<string, MCXConversionConfig> = {
    GOLD: {
        unit: '₹/10g',
        conversionFactor: 10 / 31.1035,  // troy oz → 10 grams
        dutyMultiplier: 1.035,            // ~5% duty & local discount (post Feb 2026 budget cut)
        spotDiscountPercent: -0.3,        // Spot usually at slight premium in India
    },
    SILVER: {
        unit: '₹/kg',
        conversionFactor: 1000 / 31.1035, // troy oz → kg
        dutyMultiplier: 1.034,            // effective premium matching current MCX parity (~265k) vs COMEX
        spotDiscountPercent: -0.5,
    },
    CRUDEOIL: {
        unit: '₹/bbl',
        conversionFactor: 1,              // barrel to barrel
        dutyMultiplier: 1.05,             // Minimal duty on crude
        spotDiscountPercent: 1.0,         // Spot slightly below futures
    },
    NATURALGAS: {
        unit: '₹/MMBtu',
        conversionFactor: 1,
        dutyMultiplier: 1.05,
        spotDiscountPercent: 1.5,
    },
    COPPER: {
        unit: '₹/kg',
        conversionFactor: 2.20462,        // lb → kg
        dutyMultiplier: 1.06,             // Lower duty on base metals (post 2024)
        spotDiscountPercent: 0.5,
    },
};

// ── COMEX exchange info per commodity ──

const COMEX_UNITS: Record<string, string> = {
    GOLD: '$/oz',
    SILVER: '$/oz',
    CRUDEOIL: '$/bbl',
    NATURALGAS: '$/MMBtu',
    COPPER: '$/lb',
};

// ── USDINR Rate ──

const USDINR_SYMBOL = 'USDINR=X';
let cachedUSDINR: { rate: number; timestamp: number } | null = null;
const USDINR_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Fetch live USD/INR exchange rate
 */
export async function fetchUSDINR(): Promise<number> {
    // Check cache
    if (cachedUSDINR && Date.now() - cachedUSDINR.timestamp < USDINR_CACHE_TTL) {
        return cachedUSDINR.rate;
    }

    try {
        const history = await fetchHistory(USDINR_SYMBOL, '5d', '1d');
        if (history.length > 0) {
            const rate = history[history.length - 1].close;
            cachedUSDINR = { rate, timestamp: Date.now() };
            console.log(`[Exchange] 💱 USD/INR rate: ₹${rate.toFixed(2)}`);
            return rate;
        }
    } catch (err) {
        console.warn(`[Exchange] ⚠️ Failed to fetch USDINR:`, (err as Error).message);
    }

    // Fallback rate
    const fallback = cachedUSDINR?.rate || 86.5;
    console.log(`[Exchange] Using fallback USD/INR: ₹${fallback}`);
    return fallback;
}

/**
 * Get exchange info for display
 */
export function getExchangeInfo(exchange: Exchange, commodity: string): ExchangeInfo {
    const mcxConfig = MCX_CONFIGS[commodity];

    switch (exchange) {
        case 'MCX':
            return {
                exchange: 'MCX',
                label: 'MCX (India)',
                flag: '🇮🇳',
                currency: 'INR',
                currencySymbol: '₹',
                unit: mcxConfig?.unit || '₹',
            };
        case 'SPOT':
            return {
                exchange: 'SPOT',
                label: 'Spot / Hazar',
                flag: '🏪',
                currency: 'INR',
                currencySymbol: '₹',
                unit: mcxConfig?.unit || '₹',
            };
        default:
            return {
                exchange: 'COMEX',
                label: 'COMEX (US)',
                flag: '🇺🇸',
                currency: 'USD',
                currencySymbol: '$',
                unit: COMEX_UNITS[commodity] || '$/unit',
            };
    }
}

/**
 * Convert a single COMEX USD price to the target exchange price
 */
function convertPrice(comexPrice: number, commodity: string, exchange: Exchange, usdInr: number): number {
    if (exchange === 'COMEX') return comexPrice;

    const config = MCX_CONFIGS[commodity];
    if (!config) return comexPrice * usdInr; // simple conversion

    // MCX price = COMEX × conversionFactor × USDINR × dutyMultiplier
    const mcxPrice = comexPrice * config.conversionFactor * usdInr * config.dutyMultiplier;

    if (exchange === 'SPOT') {
        // Spot = MCX adjusted by spot discount/premium
        return mcxPrice * (1 - config.spotDiscountPercent / 100);
    }

    return mcxPrice;
}

/**
 * Build full exchange pricing for a commodity
 */
export async function buildExchangePricing(
    commodity: string,
    exchange: Exchange,
    comexData: {
        currentPrice: number;
        change: number;
        changePercent: number;
        dayHigh: number;
        dayLow: number;
    },
    technicals: {
        support: number;
        resistance: number;
        atr: number;
    }
): Promise<ExchangePricing> {
    const info = getExchangeInfo(exchange, commodity);

    if (exchange === 'COMEX') {
        return {
            exchange: 'COMEX',
            label: info.label,
            currency: 'USD',
            currencySymbol: '$',
            unit: info.unit,
            price: comexData.currentPrice,
            change: comexData.change,
            changePercent: comexData.changePercent,
            dayHigh: comexData.dayHigh,
            dayLow: comexData.dayLow,
            support: technicals.support,
            resistance: technicals.resistance,
            atr: technicals.atr,
            usdInr: 0,
            conversionNote: 'Direct COMEX futures prices',
        };
    }

    const usdInr = await fetchUSDINR();
    const config = MCX_CONFIGS[commodity];

    const price = convertPrice(comexData.currentPrice, commodity, exchange, usdInr);
    const prevPrice = convertPrice(comexData.currentPrice - comexData.change, commodity, exchange, usdInr);
    const change = price - prevPrice;

    return {
        exchange,
        label: info.label,
        currency: 'INR',
        currencySymbol: '₹',
        unit: info.unit,
        price: Math.round(price * 100) / 100,
        change: Math.round(change * 100) / 100,
        changePercent: comexData.changePercent, // % change is same across exchanges
        dayHigh: Math.round(convertPrice(comexData.dayHigh, commodity, exchange, usdInr) * 100) / 100,
        dayLow: Math.round(convertPrice(comexData.dayLow, commodity, exchange, usdInr) * 100) / 100,
        support: Math.round(convertPrice(technicals.support, commodity, exchange, usdInr) * 100) / 100,
        resistance: Math.round(convertPrice(technicals.resistance, commodity, exchange, usdInr) * 100) / 100,
        atr: Math.round(convertPrice(technicals.atr, commodity, exchange, usdInr) * 100) / 100,
        usdInr,
        conversionNote: exchange === 'MCX'
            ? `Converted from COMEX at ₹${usdInr.toFixed(2)}/USD including ~${(((config?.dutyMultiplier || 1) - 1) * 100).toFixed(1)}% local market premium/duty. Unit: ${info.unit}`
            : `Spot/Hazar estimate based on MCX with ${Math.abs(config?.spotDiscountPercent || 0)}% ${(config?.spotDiscountPercent || 0) < 0 ? 'premium' : 'discount'}. Unit: ${info.unit}`,
    };
}

/**
 * Convert multi-horizon plan price levels to target exchange
 */
export async function convertPlanPrices(
    plan: any,
    commodity: string,
    exchange: Exchange
): Promise<any> {
    if (!plan || exchange === 'COMEX') return plan;

    const usdInr = await fetchUSDINR();
    const conv = (p: number) => Math.round(convertPrice(p, commodity, exchange, usdInr) * 100) / 100;

    // Deep clone to avoid mutating original
    const converted = JSON.parse(JSON.stringify(plan));

    // Convert today
    if (converted.today) {
        if (Array.isArray(converted.today.entry)) {
            converted.today.entry = converted.today.entry.map(conv);
        }
        if (typeof converted.today.stopLoss === 'number') converted.today.stopLoss = conv(converted.today.stopLoss);
        if (typeof converted.today.target === 'number') converted.today.target = conv(converted.today.target);
        if (converted.today.planB && typeof converted.today.planB.recoveryTarget === 'number') {
            converted.today.planB.recoveryTarget = conv(converted.today.planB.recoveryTarget);
        }
    }

    // Convert tomorrow
    if (converted.tomorrow?.conditions) {
        for (const cond of converted.tomorrow.conditions) {
            if (Array.isArray(cond.entry)) cond.entry = cond.entry.map(conv);
            if (typeof cond.stopLoss === 'number') cond.stopLoss = conv(cond.stopLoss);
            if (typeof cond.target === 'number') cond.target = conv(cond.target);
        }
        if (Array.isArray(converted.tomorrow.watchLevels)) {
            converted.tomorrow.watchLevels = converted.tomorrow.watchLevels.map(conv);
        }
    }
    if (converted.tomorrow?.planB && typeof converted.tomorrow.planB.recoveryTarget === 'number') {
        converted.tomorrow.planB.recoveryTarget = conv(converted.tomorrow.planB.recoveryTarget);
    }

    // Convert next week
    if (converted.nextWeek?.targetRange && Array.isArray(converted.nextWeek.targetRange)) {
        converted.nextWeek.targetRange = converted.nextWeek.targetRange.map(conv);
    }
    if (converted.nextWeek?.planB && typeof converted.nextWeek.planB.recoveryTarget === 'number') {
        converted.nextWeek.planB.recoveryTarget = conv(converted.nextWeek.planB.recoveryTarget);
    }

    return converted;
}

// ── Exports ──

export function getSupportedExchanges(commodity: string): ExchangeInfo[] {
    return [
        getExchangeInfo('COMEX', commodity),
        getExchangeInfo('MCX', commodity),
        getExchangeInfo('SPOT', commodity),
    ];
}
