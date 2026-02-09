/**
 * DailyAnalysis Model - schema for storing daily stock analysis
 * @module @stock-assist/api/models/DailyAnalysis
 */

import mongoose, { Document, Schema } from 'mongoose';

export interface IDailyAnalysis extends Document {
    symbol: string;
    date: Date;
    confidenceScore: number;
    bullishProb: number;
    bearishProb: number;
    analysis: any;
    createdAt: Date;
    updatedAt: Date;
}

const DailyAnalysisSchema = new Schema<IDailyAnalysis>({
    symbol: { type: String, required: true, index: true },
    date: {
        type: Date,
        required: true,
        index: true,
        // Ensure date is normalized to start of day (midnight)
    },
    confidenceScore: { type: Number, required: true },
    bullishProb: { type: Number, required: true },
    bearishProb: { type: Number, required: true },
    analysis: { type: Schema.Types.Mixed, required: true }
}, {
    timestamps: true
});

// Compound index for uniqueness: One analysis per stock per day
DailyAnalysisSchema.index({ symbol: 1, date: 1 }, { unique: true });

// TTL Index: Automatically delete documents older than 60 days
// 60 days * 24 hours * 60 minutes * 60 seconds = 5,184,000 seconds
DailyAnalysisSchema.index({ date: 1 }, { expireAfterSeconds: 5184000 });

export const DailyAnalysis = mongoose.model<IDailyAnalysis>('DailyAnalysis', DailyAnalysisSchema);
