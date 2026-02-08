
import axios from 'axios';

const API_URL = 'http://localhost:4000/api';
const STOCK_SYMBOL = 'RELIANCE'; // Use a reliable stock

async function runTests() {
    console.log('🚀 Starting Phase 2 System Tests...\n');

    try {
        // 1. Health Check
        console.log('1️⃣  Checking API Health...');
        const health = await axios.get(`${API_URL}/../health`); // Check root health if available or just assume API is up
        if (health.data.success) {
            console.log('✅ API is Online');
        } else {
            console.error('❌ API is Offline or Unhealthy');
            process.exit(1);
        }

        // 2. Test Backtest Logic (Stats)
        console.log('\n2️⃣  Testing Backtest Stats Endpoint...');
        try {
            const stats = await axios.get(`${API_URL}/backtest/stats`);
            if (stats.data.success) {
                console.log(`✅ Success! Current Stats: Win Rate ${stats.data.stats.winRate}%`);
            } else {
                console.error('❌ Failed to fetch stats');
            }
        } catch (e) {
            console.error(`❌ Error fetching stats: ${e.message}`);
        }

        // 3. Test Calibration Logic
        console.log('\n3️⃣  Testing Calibration Endpoint...');
        try {
            const cal = await axios.get(`${API_URL}/backtest/calibration`);
            if (cal.data.success) {
                console.log(`✅ Success! Calibration Status: ${cal.data.ready ? 'Ready' : 'Not Ready (Need more data)'}`);
            } else {
                console.error('❌ Failed to fetch calibration data');
            }
        } catch (e) {
            console.error(`❌ Error fetching calibration: ${e.message}`);
        }

        // 4. Test Single Stock Analysis (Full Pipeline)
        console.log(`\n4️⃣  Running Full Analysis Pipeline on ${STOCK_SYMBOL}...`);
        console.log('   (This tests: Data Fetch -> Timeframe Alignment -> AI Analysis -> Calibration -> Auto-Save)');

        const startTime = Date.now();
        try {
            const analysis = await axios.post(`${API_URL}/analyze/single`, { symbol: STOCK_SYMBOL });
            const duration = ((Date.now() - startTime) / 1000).toFixed(1);

            if (analysis.data.success) {
                const result = analysis.data.analysis;
                console.log(`✅ Analysis Completed in ${duration}s`);

                // Verify Timeframe Alignment
                if (result.timeframeAlignment) {
                    console.log(`   🔸 Timeframe Alignment: ${result.timeframeAlignment.aligned ? '✅ Aligned' : '⚠️ Misaligned'} (Score: ${result.timeframeAlignment.score})`);
                } else {
                    console.error('   ❌ Missing Timeframe Alignment Data');
                }

                // Verify Calibration Application
                if (result.calibrated !== undefined) { // Check if property exists
                    if (result.calibrated) {
                        console.log(`   🔸 Calibration: Applied ✅ (${result.calibrationNote})`);
                    } else {
                        console.log(`   🔸 Calibration: Not Applied (Likely insufficient data)`);
                    }
                }

                // Verify Trade Decision
                console.log(`   🔸 Recommendation: ${result.recommendation}`);
                console.log(`   🔸 Decision: ${result.tradeDecision.shouldTrade ? 'BUY/SELL' : 'WAIT'} (${result.tradeDecision.reason})`);

            } else {
                console.error(`❌ Analysis Failed: ${analysis.data.error}`);
            }
        } catch (e) {
            console.error(`❌ Error running analysis: ${e.message}`);
            if (e.response) {
                console.error(`   Server responded with: ${JSON.stringify(e.response.data)}`);
            }
        }

    } catch (error) {
        console.error(`\n❌ Critical Test Error: ${error.message}`);
        console.log('Make sure the API server is running on port 4000!');
    }
}

runTests();
