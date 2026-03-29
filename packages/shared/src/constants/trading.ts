export const TRADING = {
    CAPITAL: 15000,
    MAX_RISK: 500,
    MAX_POSITION_PERCENT: 40,
    DEFAULT_STOP_LOSS_PERCENT: 1.5,
    MAX_STOP_LOSS_PERCENT: 2,
    MIN_RISK_REWARD: 1.5,
    WIN_RATE_TARGET: 70,

    /**
     * Transaction cost model for Indian markets (NSE/BSE).
     * All values are percentages of trade value PER SIDE unless noted.
     * Round-trip cost = 2 × (brokerage + stt + exchangeFees + gst + stampDuty) + slippage
     */
    COSTS: {
        /** Brokerage per side — discount brokers charge ₹20 flat or 0.03% */
        BROKERAGE_PERCENT: 0.03,
        /** STT (Securities Transaction Tax) — 0.025% on sell side for delivery, 0.0125% on sell for intraday */
        STT_PERCENT: 0.025,
        /** Exchange transaction charges — ~0.00345% */
        EXCHANGE_FEES_PERCENT: 0.00345,
        /** GST on brokerage + exchange fees — 18% of (brokerage + exchange) */
        GST_RATE: 0.18,
        /** Stamp duty — 0.015% on buy side */
        STAMP_DUTY_PERCENT: 0.015,
        /** Estimated slippage (bid-ask spread + market impact) — round trip */
        SLIPPAGE_PERCENT: 0.10,
        /** SEBI turnover fee — ~0.0001% */
        SEBI_FEE_PERCENT: 0.0001,
    },
} as const;

/**
 * Calculate total round-trip transaction cost as a percentage.
 * This includes brokerage, STT, exchange fees, GST, stamp duty, SEBI fee, and slippage.
 * @returns total cost as percentage of trade value (e.g., 0.35 means 0.35%)
 */
export function calculateRoundTripCostPercent(): number {
    const c = TRADING.COSTS;
    // Per-side costs
    const brokerageBothSides = c.BROKERAGE_PERCENT * 2;
    const stt = c.STT_PERCENT; // Only on sell side
    const exchangeBothSides = c.EXCHANGE_FEES_PERCENT * 2;
    const stampDuty = c.STAMP_DUTY_PERCENT; // Only on buy side
    const sebiFee = c.SEBI_FEE_PERCENT * 2;
    // GST is on brokerage + exchange fees
    const gst = (brokerageBothSides + exchangeBothSides) * c.GST_RATE;

    return brokerageBothSides + stt + exchangeBothSides + stampDuty + sebiFee + gst + c.SLIPPAGE_PERCENT;
}

/**
 * Calculate net R:R after transaction costs.
 * @param grossRewardPercent - Expected reward as % of entry price
 * @param grossRiskPercent - Risk (entry to stop loss) as % of entry price
 * @returns Net R:R ratio after costs. Returns 0 if net reward is negative.
 */
export function calculateNetRiskReward(grossRewardPercent: number, grossRiskPercent: number): number {
    const costPercent = calculateRoundTripCostPercent();
    const netReward = grossRewardPercent - costPercent;
    const netRisk = grossRiskPercent + costPercent; // Costs widen effective risk
    if (netReward <= 0 || netRisk <= 0) return 0;
    return Number((netReward / netRisk).toFixed(2));
}
