/**
 * Trade Model
 * @module @stock-assist/api/models/Trade
 */

import mongoose, { Schema, Document } from 'mongoose';

export interface ITrade extends Document {
    stock: string;
    direction: 'LONG' | 'SHORT';
    quantity: number;
    entryPrice: number;
    entryDate: Date;
    entryReason: string;
    exitPrice?: number;
    exitDate?: Date;
    exitReason?: string;
    profitLoss?: number;
    profitLossPercent?: number;
    pattern?: string;
    scenario: 'bullish' | 'bearish';
    aiScore?: number;
    status: 'OPEN' | 'CLOSED' | 'CANCELLED';
    notes?: string;
}

const TradeSchema = new Schema<ITrade>(
    {
        stock: { type: String, required: true, uppercase: true },
        direction: { type: String, enum: ['LONG', 'SHORT'], required: true },
        quantity: { type: Number, required: true, min: 1 },
        entryPrice: { type: Number, required: true },
        entryDate: { type: Date, required: true },
        entryReason: { type: String, default: '' },
        exitPrice: Number,
        exitDate: Date,
        exitReason: String,
        profitLoss: Number,
        profitLossPercent: Number,
        pattern: String,
        scenario: { type: String, enum: ['bullish', 'bearish'], required: true },
        aiScore: Number,
        status: { type: String, enum: ['OPEN', 'CLOSED', 'CANCELLED'], default: 'OPEN' },
        notes: String,
    },
    { timestamps: true }
);

TradeSchema.index({ status: 1 });
TradeSchema.index({ entryDate: -1 });
TradeSchema.index({ pattern: 1 });

export const Trade = mongoose.models.Trade || mongoose.model<ITrade>('Trade', TradeSchema);
