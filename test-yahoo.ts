import YahooFinance from 'yahoo-finance2';
const yahooFinance = new YahooFinance();

async function test() {
    const res = await yahooFinance.quote(['GC=F', 'SI=F', 'CL=F', 'NG=F', 'HG=F']);
    console.log(res.map(r => `${r.symbol}: ${r.regularMarketPrice} ${r.currency}`));
}
test().catch(console.error);
