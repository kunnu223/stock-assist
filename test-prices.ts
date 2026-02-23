import { fetchHistory } from './apps/api/src/services/data/yahooHistory';
import { buildExchangePricing } from './apps/api/src/services/commodity/exchange';

async function test() {
    console.log("Starting test...");
    const symbols = {
        GOLD: 'GC=F',
        SILVER: 'SI=F',
        CRUDEOIL: 'CL=F',
        NATURALGAS: 'NG=F',
        COPPER: 'HG=F'
    };

    for (const [commodity, symbol] of Object.entries(symbols)) {
        try {
            console.log(`Fetching history for ${commodity} (${symbol})...`);
            const hist = await fetchHistory(symbol as string, '5d', '1d');
            if (hist.length) {
                const p = hist[hist.length - 1];
                const data = {
                    currentPrice: p.close,
                    change: 0,
                    changePercent: 0,
                    dayHigh: p.high,
                    dayLow: p.low
                };
                const tech = { support: p.close, resistance: p.close, atr: 1 };
                const m = await buildExchangePricing(commodity, 'MCX', data, tech);
                const s = await buildExchangePricing(commodity, 'SPOT', data, tech);
                console.log(commodity, 'COMEX:', p.close, 'MCX:', m.price, 'SPOT:', s.price);
            }
        } catch (e) {
            console.error(`Error with ${commodity}:`, e);
        }
    }
}
test().catch(console.error);
