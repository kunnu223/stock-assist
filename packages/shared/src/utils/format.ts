/**
 * Formatting Utilities
 * @module @stock-assist/shared/utils/format
 */

/** Format price in INR */
export const formatPrice = (price: number | undefined | null): string => {
    if (price === undefined || price === null || isNaN(price)) return '₹0.00';
    return `₹${price.toLocaleString('en-IN', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    })}`;
};

/** Format percentage with sign */
export const formatPercent = (value: number): string => {
    const sign = value >= 0 ? '+' : '';
    return `${sign}${value.toFixed(2)}%`;
};

/** Format large numbers (lakhs, crores) */
export const formatNumber = (num: number): string => {
    if (num >= 10000000) return `${(num / 10000000).toFixed(2)} Cr`;
    if (num >= 100000) return `${(num / 100000).toFixed(2)} L`;
    if (num >= 1000) return `${(num / 1000).toFixed(2)} K`;
    return num.toString();
};

/** Format date to YYYY-MM-DD */
export const formatDate = (date: Date): string => {
    return date.toISOString().split('T')[0];
};

/** Format date readable */
export const formatDateReadable = (date: Date | string): string => {
    return new Date(date).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
    });
};
