/**
 * Confidence Calibration Layer — Phase C #5
 * 
 * Maps system confidence score → actual win rate from resolved signals.
 * This is NOT the same as the AI probability calibration in backtest/calibration.ts.
 * 
 * This calibrates the SYSTEM confidence (adjustedConfidence from analyze.ts)
 * against real outcomes from the SignalRecord database.
 * 
 * After 300+ resolved signals, this builds a calibration table:
 * 
 * | Confidence Bucket | Predicted WR | Actual WR | Status         |
 * |:-----------------:|:------------:|:---------:|:--------------:|
 * | 35-45             | 40%          | TBD       | from data      |
 * | 45-55             | 50%          | TBD       | from data      |
 * | 55-65             | 60%          | TBD       | from data      |
 * | 65-75             | 70%          | TBD       | from data      |
 * | 75-85             | 80%          | TBD       | from data      |
 * | 85-95             | 90%          | TBD       | from data      |
 * 
 * This is an INTERIM fallback while condition hashing data accumulates.
 * Once per-hash empirical data has 50+ samples, condition hashing
 * takes priority over bucket-level calibration.
 * 
 * @module @stock-assist/api/services/analysis/calibration
 */

import { SignalRecord, SignalStatus } from '../../models/SignalRecord';

// ═══════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════

/** Minimum resolved signals needed for calibration to be active */
const MIN_SIGNALS_FOR_CALIBRATION = 100;

/** Minimum signals per bucket for that bucket to be considered calibrated */
const MIN_PER_BUCKET = 20;

/** Confidence score bucket boundaries */
const CONFIDENCE_BUCKETS = [
    { min: 15, max: 35, label: '15-35', predicted: 25 },
    { min: 35, max: 45, label: '35-45', predicted: 40 },
    { min: 45, max: 55, label: '45-55', predicted: 50 },
    { min: 55, max: 65, label: '55-65', predicted: 60 },
    { min: 65, max: 75, label: '65-75', predicted: 70 },
    { min: 75, max: 85, label: '75-85', predicted: 80 },
    { min: 85, max: 96, label: '85-95', predicted: 90 },
];

// ═══════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════

export interface CalibrationBucket {
    range: string;
    predicted: number;         // Expected win rate (midpoint assumption)
    actual: number;            // Actual win rate from resolved signals
    sampleSize: number;
    deviation: number;         // actual - predicted
    calibrated: boolean;       // true if sampleSize >= MIN_PER_BUCKET
    status: 'CALIBRATED' | 'OVERCONFIDENT' | 'UNDERCONFIDENT' | 'INSUFFICIENT';
}

export interface ConfidenceCalibrationResult {
    ready: boolean;                    // true when enough data for overall calibration
    totalResolved: number;
    buckets: CalibrationBucket[];
    overallAccuracy: number;           // Overall actual win rate across all signals
    calibrationQuality: 'GOOD' | 'FAIR' | 'POOR' | 'INSUFFICIENT';
    recommendations: string[];
}

export interface CalibratedConfidence {
    original: number;                  // Original adjustedConfidence (0-100)
    calibrated: number;                // Calibrated confidence (0-100)
    delta: number;                     // calibrated - original
    bucketUsed: string;                // Which calibration bucket was used
    wasCalibratable: boolean;          // true if bucket had sufficient samples
}

// ═══════════════════════════════════════════════════════════════
// CORE FUNCTIONS
// ═══════════════════════════════════════════════════════════════

/**
 * Build the full calibration table from SignalRecord data.
 * Groups resolved signals by their system confidence score at signal time,
 * and calculates actual win rate per bucket.
 */
export async function getConfidenceCalibration(): Promise<ConfidenceCalibrationResult> {
    try {
        // Aggregate: group resolved signals by confidence bucket → count wins
        const resolved = await SignalRecord.find({
            status: { $ne: SignalStatus.PENDING }
        }).select('confidence status').lean();

        const totalResolved = resolved.length;

        if (totalResolved < MIN_SIGNALS_FOR_CALIBRATION) {
            return {
                ready: false,
                totalResolved,
                buckets: [],
                overallAccuracy: 0,
                calibrationQuality: 'INSUFFICIENT',
                recommendations: [
                    `Need ${MIN_SIGNALS_FOR_CALIBRATION - totalResolved} more resolved signals for calibration (${totalResolved}/${MIN_SIGNALS_FOR_CALIBRATION})`,
                ],
            };
        }

        // Build bucket data
        const bucketData: Record<string, { wins: number; total: number }> = {};
        for (const bucket of CONFIDENCE_BUCKETS) {
            bucketData[bucket.label] = { wins: 0, total: 0 };
        }

        let totalWins = 0;

        for (const signal of resolved) {
            const score = signal.confidence || 50;
            for (const bucket of CONFIDENCE_BUCKETS) {
                if (score >= bucket.min && score < bucket.max) {
                    bucketData[bucket.label].total++;
                    if (signal.status === SignalStatus.TARGET_HIT) {
                        bucketData[bucket.label].wins++;
                        totalWins++;
                    }
                    break;
                }
            }
        }

        // Build calibration buckets
        const buckets: CalibrationBucket[] = [];
        const recommendations: string[] = [];
        let calibratedBuckets = 0;
        let overconfidentBuckets = 0;
        let totalDeviation = 0;

        for (const bucket of CONFIDENCE_BUCKETS) {
            const data = bucketData[bucket.label];
            if (data.total === 0) continue;

            const actual = Math.round((data.wins / data.total) * 100);
            const deviation = actual - bucket.predicted;
            const isCalibrated = data.total >= MIN_PER_BUCKET;

            let status: CalibrationBucket['status'];
            if (!isCalibrated) {
                status = 'INSUFFICIENT';
            } else if (Math.abs(deviation) <= 8) {
                status = 'CALIBRATED';
                calibratedBuckets++;
            } else if (deviation < 0) {
                status = 'OVERCONFIDENT';
                overconfidentBuckets++;
                recommendations.push(
                    `${bucket.label} range: System overconfident by ${Math.abs(deviation)}pp (predicted ~${bucket.predicted}%, actual ${actual}%)`
                );
            } else {
                status = 'UNDERCONFIDENT';
                recommendations.push(
                    `${bucket.label} range: System underconfident by ${deviation}pp (predicted ~${bucket.predicted}%, actual ${actual}%)`
                );
            }

            if (isCalibrated) {
                totalDeviation += Math.abs(deviation);
            }

            buckets.push({
                range: bucket.label,
                predicted: bucket.predicted,
                actual,
                sampleSize: data.total,
                deviation,
                calibrated: isCalibrated,
                status,
            });
        }

        const overallAccuracy = totalResolved > 0
            ? Math.round((totalWins / totalResolved) * 100)
            : 0;

        // Determine calibration quality
        const totalCalibratedBuckets = buckets.filter(b => b.calibrated).length;
        const avgDeviation = totalCalibratedBuckets > 0
            ? totalDeviation / totalCalibratedBuckets
            : 999;

        let calibrationQuality: ConfidenceCalibrationResult['calibrationQuality'];
        if (totalCalibratedBuckets < 3) {
            calibrationQuality = 'INSUFFICIENT';
        } else if (avgDeviation <= 5) {
            calibrationQuality = 'GOOD';
        } else if (avgDeviation <= 12) {
            calibrationQuality = 'FAIR';
        } else {
            calibrationQuality = 'POOR';
        }

        if (overconfidentBuckets >= 2) {
            recommendations.unshift(
                '🚨 System is systematically overconfident across multiple buckets. ' +
                'Consider reducing base modifier weights or tightening selectivity gates.'
            );
        }

        return {
            ready: true,
            totalResolved,
            buckets,
            overallAccuracy,
            calibrationQuality,
            recommendations,
        };
    } catch (error) {
        console.error('[Calibration] Error building calibration table:', error);
        return {
            ready: false,
            totalResolved: 0,
            buckets: [],
            overallAccuracy: 0,
            calibrationQuality: 'INSUFFICIENT',
            recommendations: [`Error: ${error}`],
        };
    }
}

/**
 * Apply calibration adjustment to a confidence score.
 * Looks up the appropriate bucket and adjusts the raw score
 * based on historical accuracy of that bucket.
 * 
 * If calibration data shows the 65-75 bucket has actual WR=58%,
 * a raw confidence of 70 would be calibrated down to ~58.
 * 
 * @param rawConfidence - The adjustedConfidence from the analysis flow (15-95)
 * @returns CalibratedConfidence with original, calibrated, and delta
 */
export async function calibrateConfidence(rawConfidence: number): Promise<CalibratedConfidence> {
    try {
        const calibration = await getConfidenceCalibration();

        if (!calibration.ready) {
            return {
                original: rawConfidence,
                calibrated: rawConfidence,
                delta: 0,
                bucketUsed: 'none',
                wasCalibratable: false,
            };
        }

        // Find the matching bucket
        const matchedBucket = calibration.buckets.find(b => {
            const bucketDef = CONFIDENCE_BUCKETS.find(def => def.label === b.range);
            return bucketDef && rawConfidence >= bucketDef.min && rawConfidence < bucketDef.max;
        });

        if (!matchedBucket || !matchedBucket.calibrated) {
            return {
                original: rawConfidence,
                calibrated: rawConfidence,
                delta: 0,
                bucketUsed: matchedBucket?.range || 'unknown',
                wasCalibratable: false,
            };
        }

        // The calibrated confidence is the ACTUAL win rate for this bucket.
        // If the system says "70% confidence" but historically that bucket
        // only wins 58%, the calibrated output is 58.
        const calibrated = Math.max(15, Math.min(95, matchedBucket.actual));
        const delta = calibrated - rawConfidence;

        return {
            original: rawConfidence,
            calibrated,
            delta,
            bucketUsed: matchedBucket.range,
            wasCalibratable: true,
        };
    } catch (error) {
        console.error('[Calibration] Error calibrating confidence:', error);
        return {
            original: rawConfidence,
            calibrated: rawConfidence,
            delta: 0,
            bucketUsed: 'error',
            wasCalibratable: false,
        };
    }
}
