/**
 * Watchlist Model
 * @module @stock-assist/api/models/Watchlist
 */

import mongoose, { Schema, Document } from 'mongoose';

export interface IWatchlist extends Document {
    userId: string;
    stocks: string[];
}

const WatchlistSchema = new Schema<IWatchlist>(
    {
        userId: { type: String, required: true, default: 'default' },
        stocks: { type: [String], default: [] },
    },
    { timestamps: true }
);

WatchlistSchema.index({ userId: 1 });

export const Watchlist = mongoose.models.Watchlist || mongoose.model<IWatchlist>('Watchlist', WatchlistSchema);
