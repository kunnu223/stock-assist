/**
 * BacktestResult Model — stores historical walk-forward backtest runs
 * Long-running jobs: status transitions RUNNING → COMPLETED | FAILED
 * @module @stock-assist/api/models/BacktestResult
 */

import mongoose, { Document, Schema } from 'mongoose';

export enum BacktestStatus {
    RUNNING = 'RUNNING',
    COMPLETED = 'COMPLETED',
    FAILED = 'FAILED',
}

export interface IBacktestResult extends Document {
    config: {
        startDate: string;
        endDate: string;
        symbolCount: number;
        symbols: string[];
        minConfidence: number;
        signalExpiry: number;
        partialTargetR: number;
        fullTargetR: number;
    };
    report?: Record<string, any>;       // BacktestReport object
    signals?: Record<string, any>[];    // BacktestSignal array
    topStacks?: Record<string, any>[];  // Best condition stacks
    worstStacks?: Record<string, any>[];
    status: BacktestStatus;
    progress?: string;                  // "12/50 stocks processed"
    error?: string;
    duration?: number;                  // ms
}

const BacktestResultSchema = new Schema<IBacktestResult>(
    {
        config: {
            startDate: { type: String, required: true },
            endDate: { type: String, required: true },
            symbolCount: { type: Number, required: true },
            symbols: [{ type: String }],
            minConfidence: { type: Number, required: true },
            signalExpiry: { type: Number, default: 7 },
            partialTargetR: { type: Number, default: 1.5 },
            fullTargetR: { type: Number, default: 2.5 },
        },
        report: { type: Schema.Types.Mixed },
        signals: [{ type: Schema.Types.Mixed }],
        topStacks: [{ type: Schema.Types.Mixed }],
        worstStacks: [{ type: Schema.Types.Mixed }],
        status: {
            type: String,
            enum: Object.values(BacktestStatus),
            default: BacktestStatus.RUNNING,
            index: true,
        },
        progress: { type: String },
        error: { type: String },
        duration: { type: Number },
    },
    { timestamps: true }
);

BacktestResultSchema.index({ createdAt: -1 });

export const BacktestResult = mongoose.model<IBacktestResult>('BacktestResult', BacktestResultSchema);
