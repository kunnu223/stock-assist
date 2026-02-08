/**
 * Backtesting Service
 * @module @stock-assist/api/services/backtest
 */

import mongoose from 'mongoose';
import { Prediction, PredictionStatus, type IPrediction } from '../../models';
import { getStockData } from '../data';

// Re-export calibration functions
export {
    getCalibrationData,
    applyCalibration,
    getPromptAdjustments,
    getCalibrationSummary
} from './calibration';

/**
 * Helper to check DB connection
 */
const isConnected = () => mongoose.connection.readyState === 1;

/**
 * Save a new prediction for tracking
 */
export const savePrediction = async (analysis: any): Promise<IPrediction | null> => {
    try {
        if (!isConnected()) {
            // console.warn('Database not connected. Skipping prediction save.');
            return null;
        }

        if (!analysis || !analysis.stock) return null;

        // Only track if there's a clear bias
        if (analysis.bias === 'NEUTRAL' && analysis.category !== 'STRONG_SETUP') return null;

        // Determine active side (Bullish/Bearish)
        const isBullish = analysis.bias === 'BULLISH';
        const plan = isBullish ? analysis.bullish : analysis.bearish;

        if (!plan || !plan.tradePlan) return null;

        const { tradePlan } = plan;

        // Extract price levels
        const entryPrice = (tradePlan.entry[0] + tradePlan.entry[1]) / 2;
        const targetPrice = tradePlan.targets?.[0]?.price || 0;
        const stopLoss = tradePlan.stopLoss || 0;

        // Skip invalid plans
        if (!targetPrice || !stopLoss) return null;

        const prediction = new Prediction({
            symbol: analysis.stock,
            bias: analysis.bias,
            confidence: analysis.confidence,
            confidenceScore: analysis.confidenceScore || 0,
            entryPrice,
            targetPrice,
            stopLoss,
            timeHorizon: plan.timeHorizon || 'Unknown'
        });

        return await prediction.save();
    } catch (error) {
        console.error('Error saving prediction:', error);
        return null;
    }
};

/**
 * Check all pending predictions against current market data
 */
export const checkPredictions = async (): Promise<{ updated: number, total: number }> => {
    if (!isConnected()) return { updated: 0, total: 0 };

    const pending = await Prediction.find({ status: PredictionStatus.PENDING });
    let updatedCount = 0;

    for (const pred of pending) {
        try {
            // Check if expired (older than 7 days)
            const daysSince = (Date.now() - pred.date.getTime()) / (1000 * 60 * 60 * 24);
            if (daysSince > 10) { // 10 days max for swing
                pred.status = PredictionStatus.EXPIRED;
                pred.outcomeDate = new Date();
                pred.outcomePrice = pred.entryPrice; // Neutral exit
                pred.pnlPercent = 0;
                pred.accuracyScore = 0;
                await pred.save();
                updatedCount++;
                continue;
            }

            // Fetch current data
            const stock = await getStockData(pred.symbol);
            const currentPrice = stock.quote.price;
            const dayHigh = stock.quote.dayHigh;
            const dayLow = stock.quote.dayLow;

            // Check outcomes
            let status = PredictionStatus.PENDING;
            let outcomePrice = 0;

            if (pred.bias === 'BULLISH') {
                if (dayHigh >= pred.targetPrice) {
                    status = PredictionStatus.TARGET_HIT;
                    outcomePrice = pred.targetPrice;
                } else if (dayLow <= pred.stopLoss) {
                    status = PredictionStatus.STOP_HIT;
                    outcomePrice = pred.stopLoss;
                }
            } else if (pred.bias === 'BEARISH') {
                if (dayLow <= pred.targetPrice) {
                    status = PredictionStatus.TARGET_HIT;
                    outcomePrice = pred.targetPrice;
                } else if (dayHigh >= pred.stopLoss) {
                    status = PredictionStatus.STOP_HIT;
                    outcomePrice = pred.stopLoss;
                }
            }

            // Update if outcome reached
            if (status !== PredictionStatus.PENDING) {
                pred.status = status;
                pred.outcomeDate = new Date();
                pred.outcomePrice = outcomePrice;

                // Calculate PnL %
                if (pred.bias === 'BULLISH') {
                    pred.pnlPercent = ((outcomePrice - pred.entryPrice) / pred.entryPrice) * 100;
                } else {
                    pred.pnlPercent = ((pred.entryPrice - outcomePrice) / pred.entryPrice) * 100;
                }

                // Calculate Accuracy Score (Simple: Hit=100, Stop=0)
                // Can be refined later based on risk/reward
                pred.accuracyScore = status === PredictionStatus.TARGET_HIT ? 100 : 0;

                await pred.save();
                updatedCount++;
            }
        } catch (err) {
            console.error(`Failed to check prediction for ${pred.symbol}:`, err);
        }
    }

    return { updated: updatedCount, total: pending.length };
};

/**
 * Get accuracy statistics
 */
export const getAccuracyStats = async () => {
    if (!isConnected()) {
        return {
            totalClosed: 0,
            targetHits: 0,
            stopHits: 0,
            winRate: 0,
            netPnL: 0
        };
    }

    const total = await Prediction.countDocuments({ status: { $ne: PredictionStatus.PENDING } });
    const hits = await Prediction.countDocuments({ status: PredictionStatus.TARGET_HIT });
    const stops = await Prediction.countDocuments({ status: PredictionStatus.STOP_HIT });
    const totalPnL = await Prediction.aggregate([
        { $match: { pnlPercent: { $exists: true } } },
        { $group: { _id: null, total: { $sum: "$pnlPercent" } } }
    ]);

    return {
        totalClosed: total,
        targetHits: hits,
        stopHits: stops,
        winRate: total > 0 ? (hits / total) * 100 : 0,
        netPnL: totalPnL[0]?.total || 0
    };
};
