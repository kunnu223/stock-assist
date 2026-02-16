import mongoose, { Document, Schema } from 'mongoose';

export enum CommodityPredictionStatus {
    PENDING = 'PENDING',
    TARGET_HIT = 'TARGET_HIT',
    STOP_HIT = 'STOP_HIT',
    EXPIRED = 'EXPIRED'
}

export interface ICommodityPrediction extends Document {
    symbol: string;
    exchange: string;
    date: Date;

    // Analysis
    direction: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
    recommendation: 'BUY' | 'SELL' | 'HOLD' | 'WAIT';
    confidence: number;
    signalStars: number;

    // Price Levels
    entryPrice: number;
    targetPrice: number;
    stopLoss: number;

    // Outcome tracking
    status: CommodityPredictionStatus;
    outcomeDate?: Date;
    outcomePrice?: number;
    pnlPercent?: number;
    accuracyScore?: number;
}

const CommodityPredictionSchema = new Schema<ICommodityPrediction>({
    symbol: { type: String, required: true, index: true },
    exchange: { type: String, required: true, index: true },
    date: { type: Date, default: Date.now, index: true },

    direction: { type: String, required: true },
    recommendation: { type: String, required: true },
    confidence: { type: Number, required: true },
    signalStars: { type: Number, required: true },

    entryPrice: { type: Number, required: true },
    targetPrice: { type: Number, required: true },
    stopLoss: { type: Number, required: true },

    status: {
        type: String,
        enum: Object.values(CommodityPredictionStatus),
        default: CommodityPredictionStatus.PENDING,
        index: true
    },
    outcomeDate: { type: Date },
    outcomePrice: { type: Number },
    pnlPercent: { type: Number },
    accuracyScore: { type: Number }
}, {
    timestamps: true
});

// Compound index for finding pending predictions by exchange
CommodityPredictionSchema.index({ status: 1, exchange: 1 });

export const CommodityPrediction = mongoose.model<ICommodityPrediction>('CommodityPrediction', CommodityPredictionSchema);
