import { fetchQuote } from '../src/services/data/yahooQuote';
import * as dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env') });

async function testIndices() {
    const indices = ['NIFTY50', 'BANKNIFTY', 'NIFTYIT', 'NIFTYAUTO'];
    console.log('🚀 Testing Index Fetching...');

    for (const symbol of indices) {
        try {
            const quote = await fetchQuote(symbol);
            if (quote.name.includes('(Demo)')) {
                console.error(`❌ Failed to fetch ${symbol}: Fallback mock data returned`);
            } else {
                console.log(`✅ Successfully fetched ${symbol}: ${quote.name} - Price: ${quote.price}, Change: ${quote.changePercent}%`);
            }
        } catch (error) {
            console.error(`❌ Error fetching ${symbol}:`, error);
        }
    }
}

testIndices().catch(console.error);
