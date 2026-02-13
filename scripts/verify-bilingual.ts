
async function testBilingualSupport() {
    const baseUrl = 'http://localhost:3000/api';

    console.log('🧪 Testing Bilingual Support (English vs Hindi)');

    // Test 1: Stock Analysis (English)
    console.log('\n1️⃣ Testing Stock Analysis (EN)...');
    try {
        const start = Date.now();
        const resEn = await fetch(`${baseUrl}/analyze/single`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ symbol: 'RELIANCE', language: 'en' })
        });
        const dataEn = await resEn.json();
        console.log(`Status: ${resEn.status}`);
        if (dataEn.success) {
            console.log(`Summary start (EN): ${dataEn.analysis.reasoning.substring(0, 50)}...`);
            console.log(`Time: ${(Date.now() - start) / 1000}s`);
        } else {
            console.error('Failed:', dataEn.error);
        }
    } catch (e) { console.error(e); }

    // Test 2: Stock Analysis (Hindi)
    console.log('\n2️⃣ Testing Stock Analysis (HI)...');
    try {
        const start = Date.now();
        const resHi = await fetch(`${baseUrl}/analyze/single`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ symbol: 'TATASTEEL', language: 'hi' })
        });
        const dataHi = await resHi.json();
        console.log(`Status: ${resHi.status}`);
        if (dataHi.success) {
            const reasoning = dataHi.analysis.reasoning || '';
            // Check for Devanagari characters
            const hasHindi = /[\u0900-\u097F]/.test(reasoning);
            console.log(`Reasoning contains Hindi? ${hasHindi ? '✅ YES' : '❌ NO'}`);
            console.log(`Summary start (HI): ${reasoning.substring(0, 50)}...`);
            console.log(`Time: ${(Date.now() - start) / 1000}s`);
        } else {
            console.error('Failed:', dataHi.error);
        }
    } catch (e) { console.error(e); }

    // Test 3: Commodity Analysis (Hindi)
    console.log('\n3️⃣ Testing Commodity Analysis (HI)...');
    try {
        const start = Date.now();
        const resCom = await fetch(`${baseUrl}/analyze/commodity`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ symbol: 'GOLD', exchange: 'MCX', language: 'hi' })
        });
        const dataCom = await resCom.json();
        console.log(`Status: ${resCom.status}`);
        if (dataCom.success) {
            const summary = dataCom.data.summary || '';
            const hasHindi = /[\u0900-\u097F]/.test(summary);
            console.log(`Summary contains Hindi? ${hasHindi ? '✅ YES' : '❌ NO'}`);
            console.log(`Summary start (HI): ${summary.substring(0, 50)}...`);
            console.log(`Time: ${(Date.now() - start) / 1000}s`);
        } else {
            console.error('Failed:', dataCom.error);
        }
    } catch (e) { console.error(e); }
}

testBilingualSupport();
