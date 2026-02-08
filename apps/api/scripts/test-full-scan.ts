
import axios from 'axios';

async function testScan() {
    console.log('Testing /api/analyze/stocks (Morning Screening)...');
    const start = Date.now();
    try {
        const response = await axios.get('http://localhost:4000/api/analyze/stocks', {
            timeout: 120000 // 2 minutes timeout
        });

        const duration = ((Date.now() - start) / 1000).toFixed(1);
        console.log(`✅ Scan successful in ${duration}s`);
        console.log(`Processed ${response.data.totalStocks} stocks`);
        console.log(`Strong Setups: ${response.data.strongSetups.length}`);
        console.log(`Neutrals: ${response.data.neutral.length}`);
        console.log(`Avoids: ${response.data.avoid.length}`);

    } catch (error: any) {
        const duration = ((Date.now() - start) / 1000).toFixed(1);
        console.error(`❌ Scan failed after ${duration}s`);
        if (axios.isAxiosError(error)) {
            console.error('Message:', error.message);
            if (error.response) {
                console.error('Status:', error.response.status);
                console.error('Data:', error.response.data);
            }
        } else {
            console.error('Error:', error);
        }
    }
}

testScan();
