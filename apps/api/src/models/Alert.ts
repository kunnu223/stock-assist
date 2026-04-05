/**
 * Alert Model — tracks all notifications sent via Telegram
 * @module @stock-assist/api/models/Alert
 */

import mongoose, { Document, Schema } from 'mongoose';

export enum AlertType {
    HIGH_CONFIDENCE_SIGNAL = 'HIGH_CONFIDENCE_SIGNAL',
    STOP_LOSS_APPROACHING = 'STOP_LOSS_APPROACHING',
    TARGET_APPROACHING = 'TARGET_APPROACHING',
    MORNING_TOP_10 = 'MORNING_TOP_10',
    SIGNAL_RESOLVED = 'SIGNAL_RESOLVED',
}

export interface IAlert extends Document {
    type: AlertType;
    symbol?: string;
    message: string;
    confidence?: number;
    direction?: 'BUY' | 'SELL';
    entryPrice?: number;
    targetPrice?: number;
    stopLoss?: number;
    telegramMessageId?: number;
    delivered: boolean;
    error?: string;
    metadata?: Record<string, any>;
}

const AlertSchema = new Schema<IAlert>(
    {
        type: { type: String, enum: Object.values(AlertType), required: true, index: true },
        symbol: { type: String, index: true },
        message: { type: String, required: true },
        confidence: { type: Number },
        direction: { type: String, enum: ['BUY', 'SELL'] },
        entryPrice: { type: Number },
        targetPrice: { type: Number },
        stopLoss: { type: Number },
        telegramMessageId: { type: Number },
        delivered: { type: Boolean, default: false, index: true },
        error: { type: String },
        metadata: { type: Schema.Types.Mixed },
    },
    { timestamps: true }
);

AlertSchema.index({ createdAt: -1 });
AlertSchema.index({ symbol: 1, type: 1, createdAt: -1 });

export const Alert = mongoose.model<IAlert>('Alert', AlertSchema);
