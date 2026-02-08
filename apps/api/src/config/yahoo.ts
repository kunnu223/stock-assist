/**
 * Yahoo Finance Configuration
 * @module @stock-assist/api/config/yahoo
 */

import YahooFinance from 'yahoo-finance2';

// Instantiate the library
// Note: In yahoo-finance2 v3, we instantiate to get cookie/crumb management
const yahooFinance = new YahooFinance();

// Note: suppressNotices is not available in this version, 
// so we just accept the warning messages for now.

export default yahooFinance;
