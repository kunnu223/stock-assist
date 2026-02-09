import mongoose, { Schema, Document } from 'mongoose';

export interface IWatchlist extends Document {
    symbol: string;
    addedAt: Date;
    notes?: string;
}

const WatchlistSchema: Schema = new Schema({
    symbol: {
        type: String,
        required: true,
        unique: true,
        uppercase: true,
        trim: true
    },
    addedAt: {
        type: Date,
        default: Date.now
    },
    notes: {
        type: String
    }
});

// Index symbol for fast lookups
WatchlistSchema.index({ symbol: 1 });

export const Watchlist = mongoose.model<IWatchlist>('Watchlist', WatchlistSchema);
