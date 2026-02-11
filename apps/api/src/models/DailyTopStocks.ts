/**
 * Daily Top Stocks Model
 * Caches the top 10 stocks for efficient dashboard loading
 */

import mongoose, { Schema, Document } from 'mongoose';

export interface IIndicatorSignal {
    name: string;
    direction: 'bullish' | 'bearish' | 'neutral';
    strength: number;
    detail: string;
}

export interface IStockPick {
    symbol: string;
    name: string;
    price: number;
    changePercent: number;
    confidence: number;
    reason: string;
    technicalScore: number;
    direction: 'bullish' | 'bearish';
    signalClarity: number;
    signals: IIndicatorSignal[];
    updatedAt: Date;
}

export interface IDailyTopStocks extends Document {
    date: string; // YYYY-MM-DD format
    stocks: IStockPick[];
    totalAnalyzed: number; // How many stocks were analyzed
    totalScanned: number;  // Total stocks in the universe
    createdAt: Date;
}

const IndicatorSignalSchema = new Schema({
    name: { type: String, required: true },
    direction: { type: String, enum: ['bullish', 'bearish', 'neutral'], required: true },
    strength: { type: Number, required: true },
    detail: { type: String, required: true },
}, { _id: false });

const StockPickSchema = new Schema({
    symbol: { type: String, required: true },
    name: { type: String, required: true },
    price: { type: Number, required: true },
    changePercent: { type: Number, required: true },
    confidence: { type: Number, required: true, min: 0, max: 100 },
    reason: { type: String, required: true },
    technicalScore: { type: Number, required: true },
    direction: { type: String, enum: ['bullish', 'bearish'], default: 'bullish' },
    signalClarity: { type: Number, default: 0 },
    signals: { type: [IndicatorSignalSchema], default: [] },
    updatedAt: { type: Date, default: Date.now },
});

const DailyTopStocksSchema = new Schema({
    date: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    stocks: [StockPickSchema],
    totalAnalyzed: { type: Number, required: true },
    totalScanned: { type: Number, default: 0 },
    createdAt: { type: Date, default: Date.now },
});

// TTL index: auto-delete documents older than 7 days
DailyTopStocksSchema.index({ createdAt: 1 }, { expireAfterSeconds: 604800 });

export const DailyTopStocks = mongoose.model<IDailyTopStocks>('DailyTopStocks', DailyTopStocksSchema);
