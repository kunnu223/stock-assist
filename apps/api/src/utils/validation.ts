/**
 * Data Validation Utilities
 * @module @stock-assist/api/utils/validation
 */

import type { OHLCData } from '@stock-assist/shared';

export interface ValidationResult {
    isValid: boolean;
    errors: string[];
    warnings: string[];
}

/**
 * Validate stock data quality before sending to AI
 */
export function validateStockData(data: {
    symbol: string;
    history: OHLCData[];
    avgVolume?: number;
}): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check data completeness
    if (!data.history || data.history.length < 20) {
        errors.push(`Insufficient historical data for ${data.symbol} (need 20+ days, got ${data.history?.length || 0})`);
    }

    // Check for data anomalies
    if (data.history && data.history.length > 0) {
        const priceChanges = data.history.map((d, i, arr) =>
            i > 0 ? Math.abs((d.close - arr[i - 1].close) / arr[i - 1].close) : 0
        );

        const maxChange = Math.max(...priceChanges);
        if (maxChange > 0.15) {
            warnings.push(
                `Abnormal price movement detected in ${data.symbol} (${(maxChange * 100).toFixed(1)}% single day) - possible corporate action`
            );
        }

        // Check for zero/negative prices
        const invalidPrices = data.history.filter(d => d.close <= 0 || d.open <= 0);
        if (invalidPrices.length > 0) {
            errors.push(`Invalid price data detected in ${data.symbol} (${invalidPrices.length} days with zero/negative prices)`);
        }
    }

    // Check volume
    if (data.avgVolume !== undefined && data.avgVolume < 100000) {
        warnings.push(`Low liquidity stock ${data.symbol} (avg volume ${data.avgVolume.toLocaleString()} < 100k) - patterns may be unreliable`);
    }

    // Check for split/bonus (volume spike)
    if (data.history && data.avgVolume) {
        const volumeSpike = data.history.some(d => d.volume > data.avgVolume! * 10);
        if (volumeSpike) {
            warnings.push(`Possible corporate action detected in ${data.symbol} (volume spike >10x average)`);
        }
    }

    return {
        isValid: errors.length === 0,
        errors,
        warnings
    };
}

/**
 * Validate AI response for accuracy and completeness
 */
export function validateAIResponse(response: any, symbol: string): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check required fields
    if (!response) {
        errors.push('AI response is null or undefined');
        return { isValid: false, errors, warnings };
    }

    if (!response.stock || !response.bias) {
        errors.push('Missing required fields in AI response (stock, bias)');
    }

    // Check probabilities sum to 100
    if (response.bullish && response.bearish) {
        const bullProb = response.bullish.probability || 0;
        const bearProb = response.bearish.probability || 0;
        const sum = bullProb + bearProb;

        if (Math.abs(sum - 100) > 5) {
            errors.push(`Probabilities don't sum to 100 for ${symbol} (sum: ${sum}, bullish: ${bullProb}, bearish: ${bearProb})`);
        }

        // Warn on coin-flip probabilities
        if (bullProb >= 45 && bullProb <= 55) {
            warnings.push(`Coin-flip probability detected for ${symbol} (${bullProb}% bullish) - consider marking as AVOID`);
        }
    }

    // Check pattern confidence
    if (response.pattern && response.pattern.confidence < 50) {
        warnings.push(`Low pattern confidence for ${symbol} (${response.pattern.confidence}%) - flagging as uncertain`);
    }

    // Check for realistic price targets
    if (response.currentPrice && response.bullish?.tradePlan?.targets) {
        const targets = response.bullish.tradePlan.targets;
        const maxTarget = Math.max(...targets.map((t: any) => t.price || 0));
        const percentChange = ((maxTarget - response.currentPrice) / response.currentPrice);

        if (percentChange > 0.20) {
            warnings.push(`Bullish target >20% away for ${symbol} (${(percentChange * 100).toFixed(1)}%) - may be unrealistic for swing trade`);
        }
    }

    if (response.currentPrice && response.bearish?.tradePlan?.targets) {
        const targets = response.bearish.tradePlan.targets;
        const minTarget = Math.min(...targets.map((t: any) => t.price || Infinity));
        const percentChange = Math.abs((minTarget - response.currentPrice) / response.currentPrice);

        if (percentChange > 0.20) {
            warnings.push(`Bearish target >20% away for ${symbol} (${(percentChange * 100).toFixed(1)}%) - may be unrealistic for swing trade`);
        }
    }

    // Check risk/reward ratios
    if (response.bullish?.tradePlan?.riskReward && response.bullish.tradePlan.riskReward < 1.5) {
        warnings.push(`Low bullish risk/reward for ${symbol} (${response.bullish.tradePlan.riskReward}) - below 1.5 minimum`);
    }

    if (response.bearish?.tradePlan?.riskReward && response.bearish.tradePlan.riskReward < 1.5) {
        warnings.push(`Low bearish risk/reward for ${symbol} (${response.bearish.tradePlan.riskReward}) - below 1.5 minimum`);
    }

    return {
        isValid: errors.length === 0,
        errors,
        warnings
    };
}

/**
 * Calculate average volume from history
 */
export function calculateAverageVolume(history: OHLCData[]): number {
    if (!history || history.length === 0) return 0;

    const totalVolume = history.reduce((sum, d) => sum + d.volume, 0);
    return totalVolume / history.length;
}
