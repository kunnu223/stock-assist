/**
 * Signal Record Model — tracks every analysis signal with full context
 * Used by the statistical engine to build condition → win-rate matrix
 * @module @stock-assist/api/models/SignalRecord
 */

import mongoose, { Document, Schema } from 'mongoose';

export enum SignalStatus {
    PENDING = 'PENDING',
    TARGET_HIT = 'TARGET_HIT',
    STOP_HIT = 'STOP_HIT',
    EXPIRED = 'EXPIRED'
}

export type AdxRegime = 'strong' | 'weak' | 'choppy';
export type MarketRegime = 'TRENDING_STRONG' | 'TRENDING_WEAK' | 'RANGE' | 'VOLATILE' | 'EVENT_DRIVEN';

export interface ISignalRecord extends Document {
    // Identity
    symbol: string;
    date: Date;

    // Signal
    direction: 'BUY' | 'SELL';
    confidence: number;          // System-adjusted confidence at signal time
    baseConfidence: number;      // Raw confidence before modifiers

    // Conditions at signal time
    adxValue: number;
    adxRegime: AdxRegime;
    volumeRatio: number;
    volumeConfirmed: boolean;
    alignmentScore: number;      // Multi-timeframe alignment (0-100)
    patternType: string | null;
    patternConfluence: number;   // Confluence score (0-100)
    sectorStrength: string;      // 'outperforming' | 'inline' | 'underperforming'
    sectorModifier: number;
    rsiValue: number;
    fundamentalConflict: boolean;
    ftModifier: number;          // Fundamental-technical conflict modifier
    regime: MarketRegime;

    // Modifiers applied
    modifiers: {
        volume: number;
        multiTF: number;
        adx: number;
        confluence: number;
        ft: number;
        sector: number;
    };

    // Condition hash for empirical probability engine (Phase A)
    conditionHash: string;         // hash(regime, alignmentBucket, adxBucket, volumeBucket)
    alignmentBucket: string;       // e.g., '80-100', '60-80', '40-60', '0-40'
    adxBucket: string;             // e.g., '25+', '20-25', '15-20', '0-15'
    volumeBucket: string;          // e.g., '2.0+', '1.5-2.0', '1.0-1.5', '0-1.0'

    // Price levels
    entryPrice: number;
    targetPrice: number;
    stopLoss: number;

    // Outcome (filled later by lazy check)
    status: SignalStatus;
    outcomeDate?: Date;
    outcomePrice?: number;
    pnlPercent?: number;
    daysToOutcome?: number;
}

const SignalRecordSchema = new Schema<ISignalRecord>({
    symbol: { type: String, required: true, index: true },
    date: { type: Date, default: Date.now, index: true },

    direction: { type: String, required: true, enum: ['BUY', 'SELL'] },
    confidence: { type: Number, required: true },
    baseConfidence: { type: Number, required: true },

    adxValue: { type: Number, required: true },
    adxRegime: { type: String, required: true, enum: ['strong', 'weak', 'choppy'] },
    volumeRatio: { type: Number, required: true },
    volumeConfirmed: { type: Boolean, required: true },
    alignmentScore: { type: Number, required: true },
    patternType: { type: String, default: null },
    patternConfluence: { type: Number, required: true },
    sectorStrength: { type: String, required: true },
    sectorModifier: { type: Number, default: 0 },
    rsiValue: { type: Number, required: true },
    fundamentalConflict: { type: Boolean, required: true },
    ftModifier: { type: Number, default: 0 },
    regime: { type: String, required: true, enum: ['TRENDING_STRONG', 'TRENDING_WEAK', 'RANGE', 'VOLATILE', 'EVENT_DRIVEN'] },

    modifiers: {
        volume: { type: Number, default: 0 },
        multiTF: { type: Number, default: 0 },
        adx: { type: Number, default: 0 },
        confluence: { type: Number, default: 0 },
        ft: { type: Number, default: 0 },
        sector: { type: Number, default: 0 },
    },

    // Condition hash for empirical probability (Phase A)
    conditionHash: { type: String, index: true },
    alignmentBucket: { type: String },
    adxBucket: { type: String },
    volumeBucket: { type: String },

    entryPrice: { type: Number, required: true },
    targetPrice: { type: Number, required: true },
    stopLoss: { type: Number, required: true },

    status: {
        type: String,
        enum: Object.values(SignalStatus),
        default: SignalStatus.PENDING,
        index: true
    },
    outcomeDate: { type: Date },
    outcomePrice: { type: Number },
    pnlPercent: { type: Number },
    daysToOutcome: { type: Number },
}, {
    timestamps: true
});

// Compound indexes for fast condition queries
SignalRecordSchema.index({ adxRegime: 1, volumeConfirmed: 1, status: 1 });
SignalRecordSchema.index({ regime: 1, status: 1 });
SignalRecordSchema.index({ symbol: 1, status: 1, date: -1 });
// Phase A: condition hash lookup for empirical probabilities
SignalRecordSchema.index({ conditionHash: 1, status: 1 });
SignalRecordSchema.index({ confidence: 1, status: 1 });

export const SignalRecord = mongoose.model<ISignalRecord>('SignalRecord', SignalRecordSchema);
