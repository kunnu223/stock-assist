import mongoose, { Document, Schema } from 'mongoose';

export interface IJournal extends Document {
    content: string;
    tags: string[];
    sentiment: 'bullish' | 'bearish' | 'neutral';
    isPinned: boolean;
    type: 'note' | 'trade';
    tradeDetails?: {
        symbol: string;
        exchange: string;
        entryPrice: number;
        exitPrice?: number;
        quantity: number;
        direction: 'LONG' | 'SHORT';
        pnl?: number;
        status: 'OPEN' | 'CLOSED';
        exitDate?: Date;
    };
    createdAt: Date;
    updatedAt: Date;
}

const JournalSchema = new Schema<IJournal>({
    content: {
        type: String,
        required: true
    },
    tags: [String],
    sentiment: {
        type: String,
        enum: ['bullish', 'bearish', 'neutral'],
        default: 'neutral'
    },
    isPinned: {
        type: Boolean,
        default: false
    },
    type: {
        type: String,
        enum: ['note', 'trade'],
        default: 'note',
        index: true
    },
    tradeDetails: {
        symbol: String,
        exchange: String,
        entryPrice: Number,
        exitPrice: Number,
        quantity: Number,
        direction: { type: String, enum: ['LONG', 'SHORT'] },
        pnl: Number,
        status: { type: String, enum: ['OPEN', 'CLOSED'], default: 'OPEN' },
        exitDate: Date
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
}, { timestamps: true });

export const Journal = mongoose.model<IJournal>('Journal', JournalSchema);
