# CLAUDE.md — Project Context for Claude Code

## What this project is
Indian-equities trading research system. TypeScript monorepo: `apps/api` (Express + Pino + MongoDB) and `apps/web` (Next.js + Tailwind). Yahoo Finance is the data source. User is a trader, not a developer — Claude does all implementation, user directs strategy and judges results.

## User preferences
- Run backtests from terminal via `curl http://localhost:3000/api/backtest/historical` — don't ask user to click buttons
- Frame results in real-money terms (e.g. "Rs 10L -> Rs 1.4Cr in 10 years at 30%/yr")
- When something isn't working after 3 variants, say so and propose a structural pivot — don't keep tweaking parameters
- Be direct and honest. User appreciates being told "this doesn't work" over false optimism
- User wants a big, serious system — don't default to small/safe approaches (e.g. NIFTY 500 not NIFTY 100)

## What we tried and FAILED — do NOT re-suggest these

### 1. Legacy SMC pipeline (`services/backtest/historicalBacktester.ts`)
Order Blocks, CHoCH, Liquidity Sweeps, FVGs + confidence scoring. Tested 6+ variants. Win rate stuck 18-32%. Per-condition edge audit showed multi-comparison illusion. **The SMC inputs have no predictive power on NSE.**

### 2. Cross-sectional momentum + Donchian (`services/backtest/momentumStrategy.ts`)
Top 30% by 6mo return, above 200-SMA, 20-day Donchian breakout, volume >= 1.5x, ATR stops at 2.5R.

| Year     | Win Rate | Profit Factor | Total PnL |
|----------|----------|---------------|-----------|
| 2022-23  | 25.9%    | 0.70          | -134%     |
| 2023-24  | 45.6%    | 2.04          | +481%     |
| 2024-25  | 27.3%    | 0.86          | -54%      |

Only 1 of 3 years profitable. Root cause: pure technical analysis with no fundamentals filter — every stock looks identical. Breakouts in weak companies are false breakouts.

### 3. Confidence scoring approach
Scoring 25 conditions, taking signals above threshold X. Tested exhaustively. Scores correlate poorly with outcomes. Don't propose another scoring scheme.

## THE CURRENT PLAN — Quality Momentum (approved by user)

### Strategy design (agreed on 2026-04-09)
- **Universe:** NIFTY 500 (NOT 100 — need mid-caps for real momentum winners)
- **Fundamentals filter (monthly):** ROE > 15%, profit margin > 8%, quarterly EPS YoY growth > 15%, D/E < 1.0 (waived for financials/banks)
- **Setup filter:** within 5% of 52-week high, above 50-day SMA, 6-month return in top 30% of quality universe
- **Position sizing:** top 5 stocks by relative strength, equal weight (20% each)
- **Hold period:** 21 trading days (~1 month), then rotate
- **Stop loss:** 8% below entry (hard stop, not ATR-based)
- **No target:** hold for full 21 days unless stopped out, then rotate
- **Monthly rotation:** sell anything not in new top 5, buy new entries, hold overlaps
- **Capital:** Rs 1-5 lakh range (no liquidity filter needed)

### Known limitation: lookahead bias on fundamentals
Yahoo's `quoteSummary` only returns CURRENT fundamentals, not historical. Backtest will use today's fundamentals to define the quality universe, then test the technical strategy on that fixed universe over past 3 years. This means backtest results are optimistic by ~3-5%. Accepted as realistic trade-off since no free historical fundamentals source exists for Indian stocks.

### Target returns (realistic, not fantasy)
- 30-50%/year sustained is the real goal
- 200%/year is what gets you wiped out chasing it
- At 35%/yr compounded: Rs 10L -> Rs 1.4Cr in 10 years

## EXACTLY where to pick up (next session)

### Build order (none of these are done yet):
1. **Source NIFTY 500 list** — add as `NIFTY_500` constant in `@stock-assist/shared` alongside existing `NIFTY_100`
2. **Build quality screener** — `services/screener/qualityScreener.ts` — takes universe + raw fundamentals -> returns filtered quality survivors
3. **Build `qualityMomentumStrategy.ts`** — pre-screen universe, rank survivors by 6-mo return every 21 days, return top 5 picks with 8% hard stop
4. **Wire into walkForwardEngine** — add `'qualityMomentum'` to the existing strategy switch (currently has `'legacy'` and `'momentum'`)
5. **Add to frontend toggle** — third button on backtest page config panel
6. **Run 3-year backtest from terminal** — 2022-23, 2023-24, 2024-25 via curl
7. **Report honest verdict**

### What's already built (today's work):
- `services/data/rawFundamentals.ts` — fetches ROE, D/E, margins, EPS growth, 52w high, sector from Yahoo. Auto-computes ROE from primitives when Yahoo doesn't return it directly. Banks correctly identified via sector. 95% data completeness on NIFTY 100.
- `fetchManyRawFundamentals()` — concurrent fetcher with rate limiting
- Diagnostic endpoints: `GET /api/backtest/fundamentals-smoke?limit=N` and `GET /api/backtest/fundamentals-raw/:symbol`
- Walk-forward engine supports strategy switching, NIFTY 200-SMA regime gate, limit-fill check
- Yahoo history supports 5y range and ^NSEI index symbols
- Frontend has Momentum/Legacy toggle with date/expiry/target-R sliders

## Key files
- `apps/api/src/services/backtest/walkForwardEngine.ts` — main simulation engine
- `apps/api/src/services/backtest/momentumStrategy.ts` — momentum (proven underperformer, kept for reference)
- `apps/api/src/services/backtest/historicalBacktester.ts` — legacy SMC (proven no edge)
- `apps/api/src/services/backtest/outcomeChecker.ts` — outcome simulation (correct, don't touch)
- `apps/api/src/services/data/rawFundamentals.ts` — fundamentals fetcher (just built)
- `apps/api/src/services/data/yahooHistory.ts` — OHLC fetcher
- `apps/api/src/routes/backtest.ts` — API routes including strategy param + diagnostic endpoints
- `apps/web/src/app/backtest/page.tsx` — backtest UI page
- `packages/shared/src/index.ts` — contains NIFTY_100 list (NIFTY_500 needs to be added here)
