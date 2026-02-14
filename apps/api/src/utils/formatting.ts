/**
 * Formatting Utilities
 * @module @stock-assist/api/utils/formatting
 */

/**
 * Format currency amount to 2 decimal places
 * Returns number to avoid floating point issues
 */
export const formatAmount = (value: number | string | undefined | null): number => {
    if (value === undefined || value === null) return 0;

    const num = typeof value === 'string' ? parseFloat(value) : value;
    if (isNaN(num)) return 0;

    return parseFloat(num.toFixed(2));
};

/**
 * Format currency string (e.g. "₹123.45")
 */
export const formatCurrency = (value: number | string | undefined | null): string => {
    const num = formatAmount(value);
    return `₹${num.toFixed(2)}`;
};

/**
 * Format percentage to 2 decimal places
 */
export const formatPercent = (value: number | string | undefined | null): number => {
    if (value === undefined || value === null) return 0;

    const num = typeof value === 'string' ? parseFloat(value) : value;
    if (isNaN(num)) return 0;

    return parseFloat(num.toFixed(2));
};

/**
 * Safe number parser (handles strings and undefined)
 */
export const safeNumber = (val: any): number => {
    if (typeof val === 'number') return val;
    if (typeof val === 'string') return parseFloat(val) || 0;
    return 0;
};
