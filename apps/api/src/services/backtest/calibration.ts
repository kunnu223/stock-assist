/**
 * Probability Calibration Service
 * @module @stock-assist/api/services/backtest/calibration
 * 
 * Tracks AI prediction accuracy and provides calibration adjustments.
 * After 30+ predictions, this service can:
 * - Calculate actual win rates by predicted probability range
 * - Suggest calibration adjustments
 * - Apply adjustments to new AI predictions
 */


import mongoose from 'mongoose';
import { Prediction, PredictionStatus } from '../../models';

// ═══════════════════════════════════════════════════════════════
// CALIBRATION CONFIGURATION
// ═══════════════════════════════════════════════════════════════

/** Minimum predictions needed for calibration */
const MIN_PREDICTIONS_FOR_CALIBRATION = 30;

/** Maximum deviation before flagging as miscalibrated */
const MAX_ACCEPTABLE_DEVIATION = 10; // percentage points

/** Probability ranges for grouping */
const PROBABILITY_RANGES = [
    { min: 50, max: 60, label: '50-60' },
    { min: 60, max: 70, label: '60-70' },
    { min: 70, max: 80, label: '70-80' },
    { min: 80, max: 90, label: '80-90' },
    { min: 90, max: 100, label: '90-100' }
];

// ═══════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════

export interface CalibrationData {
    range: string;
    predicted: number;     // Midpoint of range (expected win rate)
    actual: number;        // Actual win rate
    sampleSize: number;    // Number of predictions in this range
    deviation: number;     // actual - predicted
    adjustmentFactor: number; // Multiplier to apply (0.9 = reduce by 10%)
    status: 'CALIBRATED' | 'OVERCONFIDENT' | 'UNDERCONFIDENT';
}

export interface CalibrationResult {
    ready: boolean;
    totalSamples: number;
    calibrationData: CalibrationData[];
    overallAccuracy: number;
    recommendations: string[];
    adjustmentMap: Record<string, number>;
}

// ═══════════════════════════════════════════════════════════════
// CORE FUNCTIONS
// ═══════════════════════════════════════════════════════════════

/**
 * Get calibration data from historical predictions
 */
export const getCalibrationData = async (): Promise<CalibrationResult> => {
    // Check DB connection
    if (mongoose.connection.readyState !== 1) {
        return {
            ready: false,
            totalSamples: 0,
            calibrationData: [],
            overallAccuracy: 0,
            recommendations: ['Database not connected (Demo Mode)'],
            adjustmentMap: {}
        };
    }

    // Get all closed predictions
    const closed = await Prediction.find({
        status: { $ne: PredictionStatus.PENDING }
    }).lean();

    // Not enough data
    if (closed.length < MIN_PREDICTIONS_FOR_CALIBRATION) {
        return {
            ready: false,
            totalSamples: closed.length,
            calibrationData: [],
            overallAccuracy: 0,
            recommendations: [
                `Need ${MIN_PREDICTIONS_FOR_CALIBRATION - closed.length} more closed predictions for calibration`
            ],
            adjustmentMap: {}
        };
    }

    // Group predictions by confidence score range
    const rangeData: Record<string, { wins: number; total: number }> = {};

    for (const range of PROBABILITY_RANGES) {
        rangeData[range.label] = { wins: 0, total: 0 };
    }

    let totalWins = 0;
    let totalPredictions = 0;

    for (const pred of closed) {
        const score = pred.confidenceScore || 50;

        // Find matching range
        for (const range of PROBABILITY_RANGES) {
            if (score >= range.min && score < range.max) {
                rangeData[range.label].total++;
                totalPredictions++;

                if (pred.status === PredictionStatus.TARGET_HIT) {
                    rangeData[range.label].wins++;
                    totalWins++;
                }
                break;
            }
        }
    }

    // Calculate calibration for each range
    const calibrationData: CalibrationData[] = [];
    const adjustmentMap: Record<string, number> = {};
    const recommendations: string[] = [];

    for (const range of PROBABILITY_RANGES) {
        const data = rangeData[range.label];
        if (data.total === 0) continue;

        const predicted = (range.min + range.max) / 2;
        const actual = (data.wins / data.total) * 100;
        const deviation = actual - predicted;

        // Calculate adjustment factor
        // If AI says 75% but actual is 60%, factor = 60/75 = 0.8 (reduce by 20%)
        const adjustmentFactor = predicted > 0 ? actual / predicted : 1;

        let status: CalibrationData['status'];
        if (Math.abs(deviation) <= MAX_ACCEPTABLE_DEVIATION) {
            status = 'CALIBRATED';
        } else if (deviation < 0) {
            status = 'OVERCONFIDENT';
            recommendations.push(
                `Reduce ${range.label}% predictions by ${Math.abs(Math.round(deviation))}% (actual: ${actual.toFixed(1)}%)`
            );
        } else {
            status = 'UNDERCONFIDENT';
            recommendations.push(
                `Increase ${range.label}% predictions by ${Math.round(deviation)}% (actual: ${actual.toFixed(1)}%)`
            );
        }

        const calData: CalibrationData = {
            range: range.label,
            predicted: Math.round(predicted),
            actual: Math.round(actual * 10) / 10,
            sampleSize: data.total,
            deviation: Math.round(deviation * 10) / 10,
            adjustmentFactor: Math.round(adjustmentFactor * 100) / 100,
            status
        };

        calibrationData.push(calData);
        adjustmentMap[range.label] = adjustmentFactor;
    }

    // Overall accuracy
    const overallAccuracy = totalPredictions > 0
        ? (totalWins / totalPredictions) * 100
        : 0;

    // Add overall recommendations
    if (overallAccuracy >= 55) {
        recommendations.unshift(`✅ Overall accuracy ${overallAccuracy.toFixed(1)}% exceeds 55% target`);
    } else if (overallAccuracy >= 45) {
        recommendations.unshift(`⚠️ Overall accuracy ${overallAccuracy.toFixed(1)}% - close to target, keep monitoring`);
    } else {
        recommendations.unshift(`❌ Overall accuracy ${overallAccuracy.toFixed(1)}% below 55% - review AI prompts`);
    }

    return {
        ready: true,
        totalSamples: closed.length,
        calibrationData,
        overallAccuracy: Math.round(overallAccuracy * 10) / 10,
        recommendations,
        adjustmentMap
    };
};

/**
 * Apply calibration adjustments to AI analysis
 * @param analysis - Raw AI analysis response
 * @returns Calibrated analysis with adjusted probabilities
 */
export const applyCalibration = async (analysis: any): Promise<any> => {
    if (!analysis || !analysis.bullish || !analysis.bearish) {
        return analysis;
    }

    const calibration = await getCalibrationData();

    // If not ready, return original analysis
    if (!calibration.ready || Object.keys(calibration.adjustmentMap).length === 0) {
        return {
            ...analysis,
            calibrated: false,
            calibrationNote: 'Not enough data for calibration'
        };
    }

    // Get the confidence score and find matching range
    const confidenceScore = analysis.confidenceScore || 50;
    let adjustmentFactor = 1;
    let matchedRange = '';

    for (const range of PROBABILITY_RANGES) {
        if (confidenceScore >= range.min && confidenceScore < range.max) {
            adjustmentFactor = calibration.adjustmentMap[range.label] || 1;
            matchedRange = range.label;
            break;
        }
    }

    // Apply adjustment to probabilities
    const originalBullProb = analysis.bullish.probability;
    const originalBearProb = analysis.bearish.probability;

    // Adjust the dominant probability
    let adjustedBullProb: number;
    let adjustedBearProb: number;

    if (originalBullProb > originalBearProb) {
        // Bullish dominant - adjust bullish probability
        adjustedBullProb = Math.round(originalBullProb * adjustmentFactor);
        adjustedBullProb = Math.max(30, Math.min(95, adjustedBullProb)); // Clamp
        adjustedBearProb = 100 - adjustedBullProb;
    } else {
        // Bearish dominant - adjust bearish probability
        adjustedBearProb = Math.round(originalBearProb * adjustmentFactor);
        adjustedBearProb = Math.max(30, Math.min(95, adjustedBearProb)); // Clamp
        adjustedBullProb = 100 - adjustedBearProb;
    }

    // Create calibrated analysis
    const calibratedAnalysis = {
        ...analysis,
        bullish: {
            ...analysis.bullish,
            probability: adjustedBullProb,
            originalProbability: originalBullProb
        },
        bearish: {
            ...analysis.bearish,
            probability: adjustedBearProb,
            originalProbability: originalBearProb
        },
        calibrated: true,
        calibrationNote: `Adjusted using ${matchedRange}% range (factor: ${adjustmentFactor.toFixed(2)})`,
        calibrationFactor: adjustmentFactor
    };

    // Recalculate bias if probabilities shifted significantly
    if (adjustedBullProb > 55 && adjustedBearProb <= 45) {
        calibratedAnalysis.bias = 'BULLISH';
    } else if (adjustedBearProb > 55 && adjustedBullProb <= 45) {
        calibratedAnalysis.bias = 'BEARISH';
    } else {
        calibratedAnalysis.bias = 'NEUTRAL';
    }

    // Adjust category if needed
    if (calibratedAnalysis.bias === 'NEUTRAL' && analysis.category === 'STRONG_SETUP') {
        calibratedAnalysis.category = 'NEUTRAL';
        calibratedAnalysis.calibrationNote += ' - Downgraded from STRONG_SETUP due to calibration';
    }

    return calibratedAnalysis;
};

/**
 * Get recommended prompt adjustments based on calibration
 */
export const getPromptAdjustments = async (): Promise<{
    needed: boolean;
    adjustments: string[];
    severity: 'LOW' | 'MEDIUM' | 'HIGH';
}> => {
    const calibration = await getCalibrationData();

    if (!calibration.ready) {
        return {
            needed: false,
            adjustments: ['Not enough data to determine prompt adjustments'],
            severity: 'LOW'
        };
    }

    const adjustments: string[] = [];
    let overconfidentCount = 0;
    let underconfidentCount = 0;

    for (const cal of calibration.calibrationData) {
        if (cal.status === 'OVERCONFIDENT' && cal.sampleSize >= 5) {
            overconfidentCount++;
            if (Math.abs(cal.deviation) > 15) {
                adjustments.push(
                    `CRITICAL: ${cal.range}% range is severely overconfident (actual: ${cal.actual}%). ` +
                    `Add instruction: "When confidence is ${cal.range}%, reduce to ${Math.round(cal.actual)}%"`
                );
            }
        } else if (cal.status === 'UNDERCONFIDENT' && cal.sampleSize >= 5) {
            underconfidentCount++;
            if (cal.deviation > 15) {
                adjustments.push(
                    `NOTE: ${cal.range}% range is underconfident (actual: ${cal.actual}%). ` +
                    `AI can be more confident in this range.`
                );
            }
        }
    }

    // Determine severity
    let severity: 'LOW' | 'MEDIUM' | 'HIGH' = 'LOW';
    if (overconfidentCount >= 2 || calibration.overallAccuracy < 45) {
        severity = 'HIGH';
        adjustments.unshift(
            '🚨 HIGH PRIORITY: AI is systematically overconfident. ' +
            'Consider adding stricter uncertainty acknowledgment to prompts.'
        );
    } else if (overconfidentCount >= 1 || calibration.overallAccuracy < 55) {
        severity = 'MEDIUM';
    }

    // Add pattern-specific adjustments if available
    // This would require tracking by pattern type - future enhancement

    return {
        needed: adjustments.length > 0,
        adjustments,
        severity
    };
};

/**
 * Get a summary of calibration status for logging
 */
export const getCalibrationSummary = async (): Promise<string> => {
    const calibration = await getCalibrationData();

    if (!calibration.ready) {
        return `Calibration: Not ready (${calibration.totalSamples}/${MIN_PREDICTIONS_FOR_CALIBRATION} predictions)`;
    }

    const wellCalibrated = calibration.calibrationData.filter(c => c.status === 'CALIBRATED').length;
    const total = calibration.calibrationData.length;

    return `Calibration: ${wellCalibrated}/${total} ranges calibrated | ` +
        `Overall: ${calibration.overallAccuracy}% accuracy | ` +
        `Samples: ${calibration.totalSamples}`;
};
