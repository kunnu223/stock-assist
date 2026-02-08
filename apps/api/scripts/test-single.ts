
import axios from 'axios';

async function test() {
    console.log('Testing /api/analyze/single with symbol "TCS"...');
    try {
        const response = await axios.post('http://localhost:4000/api/analyze/single', {
            symbol: 'TCS'
        }, { timeout: 10000 }); // 10s timeout

        console.log('Response status:', response.status);
        if (response.data.success) {
            console.log('✅ Success!');
            console.log(JSON.stringify(response.data.analysis.tradeDecision, null, 2));
        } else {
            console.error('❌ Failed:', response.data);
        }
    } catch (error: any) {
        console.error('❌ Error details:');
        console.error('Message:', error.message);
        console.error('Code:', error.code);
        if (error.response) {
            console.error('Response data:', error.response.data);
            console.error('Response status:', error.response.status);
        }
    }
}

test();
