/**
 * Trading Constants
 * @module @stock-assist/shared/constants/trading
 */

/** Trading configuration */
export const TRADING = {
    CAPITAL: 15000,
    MAX_RISK: 500,
    MAX_POSITION_PERCENT: 40,
    DEFAULT_STOP_LOSS_PERCENT: 1.5,
    MAX_STOP_LOSS_PERCENT: 2,
    MIN_RISK_REWARD: 1.5,
    WIN_RATE_TARGET: 70, // Upgraded to 70%+
} as const;

/** Market timing (IST) */
export const MARKET = {
    OPEN: '09:15',
    CLOSE: '15:30',
    PRE_MARKET: '09:00',
} as const;

/** Analysis configuration */
export const ANALYSIS = {
    HISTORY_DAYS: 30,
    NEWS_DAYS: 3,
    HIGH_CONFIDENCE: 75,
    MEDIUM_CONFIDENCE: 60,
    MIN_PATTERN_CONFIDENCE: 70, // Higher for 70% win rate
} as const;

/** API rate limits */
export const RATE_LIMITS = {
    MORNING_SCREENING: 5 * 60 * 1000, // 5 minutes
    SINGLE_ANALYSIS: 6 * 1000, // 6 seconds
    GEMINI_REQUESTS: 60, // per minute
} as const;
