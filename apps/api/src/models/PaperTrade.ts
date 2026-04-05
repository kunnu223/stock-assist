/**
 * Paper Trade Model — auto-created from every qualifying signal
 * Tracks virtual portfolio P&L to prove system accuracy before real money
 * @module @stock-assist/api/models/PaperTrade
 */

import mongoose, { Document, Schema } from 'mongoose';

export enum PaperTradeStatus {
    OPEN = 'OPEN',
    CLOSED_TARGET = 'CLOSED_TARGET',
    CLOSED_STOP = 'CLOSED_STOP',
    CLOSED_PARTIAL = 'CLOSED_PARTIAL',
    CLOSED_EXPIRED = 'CLOSED_EXPIRED',
}

export interface IPaperTrade extends Document {
    // Link to original signal
    signalId: mongoose.Types.ObjectId;
    symbol: string;

    // Trade details
    direction: 'BUY' | 'SELL';
    confidence: number;
    regime: string;

    // Prices
    entryPrice: number;
    targetPrice: number;
    stopLoss: number;
    currentPrice?: number;

    // Virtual position (fixed ₹100,000 per trade for normalization)
    capitalAllocated: number;
    quantity: number;

    // P&L
    unrealizedPnl?: number;
    unrealizedPnlPercent?: number;
    realizedPnl?: number;
    realizedPnlPercent?: number;

    // Outcome
    status: PaperTradeStatus;
    exitPrice?: number;
    exitDate?: Date;
    exitReason?: string;
    daysHeld?: number;
}

const PaperTradeSchema = new Schema<IPaperTrade>(
    {
        signalId: { type: Schema.Types.ObjectId, ref: 'SignalRecord', required: true, index: true },
        symbol: { type: String, required: true, index: true },

        direction: { type: String, enum: ['BUY', 'SELL'], required: true },
        confidence: { type: Number, required: true },
        regime: { type: String, required: true },

        entryPrice: { type: Number, required: true },
        targetPrice: { type: Number, required: true },
        stopLoss: { type: Number, required: true },
        currentPrice: { type: Number },

        capitalAllocated: { type: Number, required: true },
        quantity: { type: Number, required: true },

        unrealizedPnl: { type: Number },
        unrealizedPnlPercent: { type: Number },
        realizedPnl: { type: Number },
        realizedPnlPercent: { type: Number },

        status: {
            type: String,
            enum: Object.values(PaperTradeStatus),
            default: PaperTradeStatus.OPEN,
            index: true,
        },
        exitPrice: { type: Number },
        exitDate: { type: Date },
        exitReason: { type: String },
        daysHeld: { type: Number },
    },
    { timestamps: true }
);

PaperTradeSchema.index({ status: 1, symbol: 1 });
PaperTradeSchema.index({ createdAt: -1 });

export const PaperTrade = mongoose.model<IPaperTrade>('PaperTrade', PaperTradeSchema);
