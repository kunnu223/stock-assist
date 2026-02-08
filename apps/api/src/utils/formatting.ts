/**
 * Formatting Utilities
 * @module @stock-assist/api/utils/formatting
 */

/**
 * Format currency amount to 2 decimal places
 * Returns string representation to avoid floating point issues
 */
export const formatAmount = (value: number | undefined | null): number => {
    if (value === undefined || value === null || isNaN(value)) return 0;
    return parseFloat(value.toFixed(2));
};

/**
 * Format currency string (e.g. "₹123.45")
 */
export const formatCurrency = (value: number | undefined | null): string => {
    if (value === undefined || value === null || isNaN(value)) return '₹0.00';
    return `₹${value.toFixed(2)}`;
};

/**
 * Format percentage to 2 decimal places
 */
export const formatPercent = (value: number | undefined | null): number => {
    if (value === undefined || value === null || isNaN(value)) return 0;
    return parseFloat(value.toFixed(2));
};

/**
 * Safe number parser (handles strings and undefined)
 */
export const safeNumber = (val: any): number => {
    if (typeof val === 'number') return val;
    if (typeof val === 'string') return parseFloat(val) || 0;
    return 0;
};
