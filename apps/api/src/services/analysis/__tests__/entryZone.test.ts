import { describe, it, expect } from 'vitest';
import { calculateEntryZone } from '../entryZone';
import type { SMCAnalysis } from '@stock-assist/shared';

/** Build an empty SMC analysis */
function emptySMC(): SMCAnalysis {
    return {
        orderBlocks: [],
        fairValueGaps: [],
        bosEvents: [],
        chochEvents: [],
        liquiditySweeps: [],
        swingPoints: [],
        trendState: 'ranging',
    };
}

/** Build SMC with a bullish unmitigated OB */
function smcWithBullishOB(): SMCAnalysis {
    return {
        ...emptySMC(),
        trendState: 'uptrend',
        orderBlocks: [{
            zone: { high: 105, low: 100 },
            type: 'bullish',
            status: 'unmitigated',
            age: 5,
            strengthBoost: 0,
            formationIndex: 10,
        }],
        swingPoints: [
            { index: 5, price: 110, type: 'high' },
            { index: 8, price: 98, type: 'low' },
        ],
    };
}

/** Build SMC with a bullish OB + unfilled FVG as target */
function smcWithOBAndFVG(): SMCAnalysis {
    return {
        ...smcWithBullishOB(),
        fairValueGaps: [{
            zone: { high: 118, low: 115 },
            type: 'bullish',
            filled: false,
            createdAtIndex: 12,
        }],
    };
}

/** Build SMC with confirmed liquidity sweep */
function smcWithSweep(): SMCAnalysis {
    return {
        ...emptySMC(),
        trendState: 'uptrend',
        liquiditySweeps: [{
            type: 'bullish',
            sweepExtreme: 95,
            closePrice: 103,
            confirmed: true,
            convictionBoost: 0,
            index: 15,
        }],
        orderBlocks: [{
            zone: { high: 105, low: 100 },
            type: 'bullish',
            status: 'unmitigated',
            age: 5,
            strengthBoost: 0,
            formationIndex: 10,
        }],
        swingPoints: [
            { index: 5, price: 110, type: 'high' },
        ],
    };
}

describe('calculateEntryZone', () => {
    it('returns null when no SMC signals exist', () => {
        const result = calculateEntryZone(emptySMC(), 100, 3, 'bullish');
        expect(result).toBeNull();
    });

    it('returns null with zero ATR', () => {
        const result = calculateEntryZone(smcWithBullishOB(), 100, 0, 'bullish');
        expect(result).toBeNull();
    });

    it('returns null with zero price', () => {
        const result = calculateEntryZone(smcWithBullishOB(), 0, 3, 'bullish');
        expect(result).toBeNull();
    });

    it('uses Order Block as entry zone when present', () => {
        const result = calculateEntryZone(smcWithBullishOB(), 103, 3, 'bullish');
        expect(result).not.toBeNull();
        if (result) {
            expect(result.entryTrigger).toBe('OrderBlock');
            expect(result.entryZoneLow).toBe(100);
            expect(result.entryZoneHigh).toBe(105);
        }
    });

    it('sets stop loss below OB low with ATR buffer', () => {
        const result = calculateEntryZone(smcWithBullishOB(), 103, 3, 'bullish');
        expect(result).not.toBeNull();
        if (result) {
            // SL = OB low (100) - 0.5 * ATR (3) = 98.5
            expect(result.stopLoss).toBe(98.5);
        }
    });

    it('prefers liquidity sweep over order block', () => {
        const result = calculateEntryZone(smcWithSweep(), 100, 3, 'bullish');
        expect(result).not.toBeNull();
        if (result) {
            expect(result.entryTrigger).toBe('LiquiditySweep');
        }
    });

    it('calculates target1 from unfilled FVG when available', () => {
        const result = calculateEntryZone(smcWithOBAndFVG(), 103, 3, 'bullish');
        expect(result).not.toBeNull();
        if (result) {
            // Nearest unfilled FVG low above entry (115) should be target1
            expect(result.target1).toBe(115);
        }
    });

    it('marks isValid = false when R:R < 1:2', () => {
        // Set up OB where entry is very close to target and far from SL
        const smc: SMCAnalysis = {
            ...emptySMC(),
            orderBlocks: [{
                zone: { high: 101, low: 100 },
                type: 'bullish',
                status: 'unmitigated',
                age: 3,
                strengthBoost: 0,
                formationIndex: 5,
            }],
            swingPoints: [
                { index: 3, price: 101.5, type: 'high' }, // Very close target
            ],
        };
        const result = calculateEntryZone(smc, 100.5, 10, 'bullish');
        // With ATR=10, SL would be 100 - 5 = 95, entry mid ~100.5, target ~101.5
        // R:R = 1/5.5 ≈ 0.18 → should be invalid
        if (result) {
            expect(result.isValid).toBe(false);
            expect(result.riskReward).toBeLessThan(2);
        }
    });

    it('calculates target2 as 2x ATR extension', () => {
        const result = calculateEntryZone(smcWithBullishOB(), 103, 3, 'bullish');
        expect(result).not.toBeNull();
        if (result) {
            const entryMid = (result.entryZoneLow + result.entryZoneHigh) / 2;
            expect(result.target2).toBeCloseTo(entryMid + 6, 1); // 2 * ATR(3) = 6
        }
    });
});
