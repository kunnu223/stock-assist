/**
 * Prediction Model - schema for AI prediction tracking
 * @module @stock-assist/api/models/Prediction
 */

import mongoose, { Document, Schema } from 'mongoose';

export enum PredictionStatus {
    PENDING = 'PENDING',
    TARGET_HIT = 'TARGET_HIT',
    STOP_HIT = 'STOP_HIT',
    EXPIRED = 'EXPIRED'
}

export interface IPrediction extends Document {
    symbol: string;
    date: Date;
    bias: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
    confidence: 'HIGH' | 'MEDIUM' | 'LOW';
    confidenceScore: number;
    entryPrice: number;
    targetPrice: number;
    stopLoss: number;
    timeHorizon: string;

    // Outcome tracking
    status: PredictionStatus;
    outcomeDate?: Date;
    outcomePrice?: number;
    pnlPercent?: number;
    accuracyScore?: number; // 0-100 score for this prediction
}

const PredictionSchema = new Schema<IPrediction>({
    symbol: { type: String, required: true, index: true },
    date: { type: Date, default: Date.now, index: true },
    bias: { type: String, required: true },
    confidence: { type: String, required: true },
    confidenceScore: { type: Number, default: 0 },
    entryPrice: { type: Number, required: true },
    targetPrice: { type: Number, required: true },
    stopLoss: { type: Number, required: true },
    timeHorizon: { type: String, required: true },

    // Status tracking
    status: {
        type: String,
        enum: Object.values(PredictionStatus),
        default: PredictionStatus.PENDING
    },
    outcomeDate: { type: Date },
    outcomePrice: { type: Number },
    pnlPercent: { type: Number },
    accuracyScore: { type: Number }
}, {
    timestamps: true
});

// Index for getting pending predictions
PredictionSchema.index({ status: 1, date: 1 });

export const Prediction = mongoose.model<IPrediction>('Prediction', PredictionSchema);
