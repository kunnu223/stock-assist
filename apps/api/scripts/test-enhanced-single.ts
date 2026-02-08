/**
 * Enhanced Single Stock Analysis Test
 * Tests the new comprehensive /api/analyze/single endpoint
 */

import axios from 'axios';

const API_URL = 'http://localhost:4000/api/analyze/single';

async function testEnhancedAnalysis(symbol: string) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`Testing Enhanced Analysis for: ${symbol}`);
    console.log('='.repeat(60));

    try {
        const start = Date.now();
        const response = await axios.post(API_URL, { symbol }, { timeout: 30000 });
        const elapsed = ((Date.now() - start) / 1000).toFixed(2);

        if (response.data.success) {
            console.log(`\n✅ SUCCESS in ${elapsed}s (API reported: ${response.data.processingTime})`);
            console.log('\n--- RECOMMENDATION ---');
            console.log(`Symbol: ${response.data.symbol}`);
            console.log(`Price: ₹${response.data.currentPrice}`);
            console.log(`Recommendation: ${response.data.recommendation}`);
            console.log(`Confidence Score: ${response.data.confidenceScore}/100`);
            console.log(`Timeframe: ${response.data.timeframe}`);
            console.log(`Category: ${response.data.category}`);

            console.log('\n--- TECHNICAL PATTERNS ---');
            console.log(`1D: ${response.data.analysis?.technicalPatterns?.['1D']?.join(', ') || 'None'}`);
            console.log(`1W: ${response.data.analysis?.technicalPatterns?.['1W']?.join(', ') || 'None'}`);
            console.log(`1M: ${response.data.analysis?.technicalPatterns?.['1M']?.join(', ') || 'None'}`);
            console.log(`Alignment: ${response.data.analysis?.technicalPatterns?.alignment}`);

            console.log('\n--- INDICATORS ---');
            console.log(`RSI: ${response.data.analysis?.indicators?.RSI} (${response.data.analysis?.indicators?.RSIInterpretation})`);
            console.log(`MACD: ${response.data.analysis?.indicators?.MACD}`);
            console.log(`Volume Trend: ${response.data.analysis?.indicators?.volumeTrend}`);
            console.log(`Bollinger Position: ${response.data.analysis?.indicators?.bollingerPosition}`);

            console.log('\n--- NEWS SENTIMENT ---');
            console.log(`Sentiment: ${response.data.analysis?.news?.sentiment} (${response.data.analysis?.news?.sentimentScore}/100)`);
            console.log(`Impact: ${response.data.analysis?.news?.impactLevel}`);
            if (response.data.analysis?.news?.latestHeadlines?.length > 0) {
                console.log('Headlines:');
                response.data.analysis.news.latestHeadlines.forEach((h: string, i: number) => {
                    console.log(`  ${i + 1}. ${h.substring(0, 80)}...`);
                });
            }

            console.log('\n--- FUNDAMENTALS ---');
            console.log(`Valuation: ${response.data.analysis?.fundamentals?.valuation}`);
            console.log(`Growth: ${response.data.analysis?.fundamentals?.growth}`);
            console.log(`P/E Ratio: ${response.data.analysis?.fundamentals?.peRatio || 'N/A'}`);

            console.log('\n--- PRICE TARGETS ---');
            const pt = response.data.priceTargets;
            if (pt) {
                console.log(`Entry: ₹${pt.entry}`);
                console.log(`Target 1: ₹${pt.target1}`);
                console.log(`Target 2: ₹${pt.target2}`);
                console.log(`Stop Loss: ₹${pt.stopLoss}`);
                console.log(`Risk/Reward: ${pt.riskReward}`);
            }

            console.log('\n--- CONFIDENCE BREAKDOWN ---');
            const cb = response.data.confidenceBreakdown;
            if (cb) {
                console.log(`Pattern Strength: ${cb.patternStrength}/100 (25%)`);
                console.log(`News Sentiment: ${cb.newsSentiment}/100 (20%)`);
                console.log(`Technical Alignment: ${cb.technicalAlignment}/100 (25%)`);
                console.log(`Volume Confirmation: ${cb.volumeConfirmation}/100 (15%)`);
                console.log(`Fundamental Strength: ${cb.fundamentalStrength}/100 (15%)`);
            }

            console.log('\n--- RISKS ---');
            if (response.data.risks?.length > 0) {
                response.data.risks.forEach((r: string) => console.log(`• ${r}`));
            }

            console.log('\n--- REASONING ---');
            console.log(response.data.reasoning?.substring(0, 300) + '...');

            console.log('\n--- CANDLESTICK PATTERNS ---');
            console.log(response.data.analysis?.candlestickPatterns?.join(', ') || 'None detected');

            console.log('\nValid Until:', response.data.validUntil);

            return true;
        } else {
            console.log(`\n❌ FAILED: ${response.data.error}`);
            return false;
        }
    } catch (error: any) {
        console.error(`\n❌ ERROR: ${error.message}`);
        if (error.response) {
            console.error('Response:', error.response.data);
        }
        return false;
    }
}

async function runTests() {
    console.log('╔══════════════════════════════════════════════════════════╗');
    console.log('║     ENHANCED STOCK ANALYSIS API TEST SUITE               ║');
    console.log('╚══════════════════════════════════════════════════════════╝');

    const testSymbols = ['RELIANCE', 'TCS', 'HDFCBANK'];
    let passed = 0;
    let failed = 0;

    for (const symbol of testSymbols) {
        const success = await testEnhancedAnalysis(symbol);
        if (success) passed++;
        else failed++;

        // Delay between tests
        if (symbol !== testSymbols[testSymbols.length - 1]) {
            console.log('\n⏳ Waiting 2s before next test...');
            await new Promise(r => setTimeout(r, 2000));
        }
    }

    console.log('\n' + '='.repeat(60));
    console.log(`TEST SUMMARY: ${passed}/${testSymbols.length} passed, ${failed} failed`);
    console.log('='.repeat(60));

    // Performance check
    console.log('\n📊 Performance target: < 5 seconds per analysis');
}

runTests();
