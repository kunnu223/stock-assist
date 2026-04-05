# STOCK-ASSIST: Complete System Documentation

> AI-powered trading assistant for the Indian stock market (NSE)
> Intelligent stock screening, multi-indicator analysis, paper trading & portfolio risk management
> Targeting 70%+ win rate through signal clarity, statistical learning & confidence calibration

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Architecture & Tech Stack](#2-architecture--tech-stack)
3. [Monorepo Structure](#3-monorepo-structure)
4. [Backend API](#4-backend-api)
   - [Entry Point & Middleware](#41-entry-point--middleware)
   - [Configuration](#42-configuration)
   - [Database Models](#43-database-models)
   - [API Routes & Endpoints](#44-api-routes--endpoints)
   - [Services — Analysis Engine](#45-services--analysis-engine)
   - [Services — Technical Indicators](#46-services--technical-indicators)
   - [Services — AI Integration](#47-services--ai-integration)
   - [Services — Data Sources](#48-services--data-sources)
   - [Services — Screening Pipeline](#49-services--screening-pipeline)
   - [Services — Signal Tracking & Backtest](#410-services--signal-tracking--backtest)
   - [Services — Paper Trading](#411-services--paper-trading)
   - [Services — Notifications (Telegram)](#412-services--notifications-telegram)
5. [Frontend Web App](#5-frontend-web-app)
   - [Pages & Routing](#51-pages--routing)
   - [Components](#52-components)
   - [Hooks & Services](#53-hooks--services)
   - [Context & State Management](#54-context--state-management)
6. [Shared Package](#6-shared-package)
   - [Types](#61-types)
   - [Constants](#62-constants)
7. [Data Flow Diagrams](#7-data-flow-diagrams)
8. [Key Algorithms & Research](#8-key-algorithms--research)
9. [Environment Setup](#9-environment-setup)
10. [API Reference (All Endpoints)](#10-api-reference-all-endpoints)

---

## 1. Project Overview

**Stock-Assist** is a full-stack, AI-powered trading assistant purpose-built for the Indian stock market (NSE/BSE). It combines:

- **Multi-indicator technical analysis** (RSI, MACD, ADX, Bollinger Bands, VWAP, ATR, Support/Resistance)
- **Smart Money Concepts (SMC)** (Order Blocks, Fair Value Gaps, Change of Character, Liquidity Sweeps)
- **AI-powered sentiment analysis** (Google Gemini + Groq ensemble)
- **Statistical signal tracking** with empirical probability calibration
- **Auto paper trading** for system validation without real money
- **Telegram alerts** for real-time notifications
- **Risk management dashboard** with portfolio-level risk monitoring

The system screens ~200 liquid NSE stocks daily, applies 15+ quality gates, and surfaces the top 10 highest-conviction signals each morning.

### Key Design Principles

| Principle | Implementation |
|-----------|---------------|
| **Signal > Noise** | Multi-gate filtering: only signals passing clarity, volume, regime, and confidence thresholds surface |
| **Research-Backed** | NSE-calibrated pattern weights from 16-year study (17 NIFTY 50 stocks), sector-optimized MACD/RSI periods (Inumula 2019) |
| **Self-Improving** | Every signal is tracked; condition-hash → win-rate matrix continuously calibrates confidence |
| **Demo-Friendly** | Works without MongoDB (in-memory fallback), without AI keys (fallback analysis), without Telegram |
| **Profit Factor Math** | 57.5% win rate x 2.5R reward = PF 3.4 |

---

## 2. Architecture & Tech Stack

```
┌──────────────────────────────────────────────────────────────┐
│                        FRONTEND                              │
│  Next.js 14 · React 18 · TailwindCSS · React Query          │
│  PWA · Dark Mode · Hindi/English · Lightweight Charts        │
├──────────────────────────────────────────────────────────────┤
│                         API                                  │
│  Express.js · TypeScript · Pino Logger · Helmet · Zod        │
│  Rate Limiting · Request Tracing · Gzip Compression          │
├──────────────────────────────────────────────────────────────┤
│                       SERVICES                               │
│  ┌─────────┐ ┌──────────┐ ┌─────────┐ ┌──────────────────┐  │
│  │Analysis │ │Indicators│ │   AI    │ │  Data Sources    │  │
│  │Engine   │ │(RSI,MACD │ │(Gemini, │ │(Yahoo Finance,   │  │
│  │(20+     │ │ADX,BB,   │ │ Groq,   │ │ News, Sector,    │  │
│  │modules) │ │VWAP,ATR) │ │Ensemble)│ │ Fundamentals)    │  │
│  └─────────┘ └──────────┘ └─────────┘ └──────────────────┘  │
│  ┌─────────┐ ┌──────────┐ ┌─────────┐ ┌──────────────────┐  │
│  │Screening│ │Backtest  │ │  Paper  │ │   Notifications  │  │
│  │Pipeline │ │& Signal  │ │ Trading │ │   (Telegram)     │  │
│  │(Top 10) │ │Tracker   │ │ Engine  │ │                  │  │
│  └─────────┘ └──────────┘ └─────────┘ └──────────────────┘  │
├──────────────────────────────────────────────────────────────┤
│                      DATABASE                                │
│  MongoDB (Mongoose) · 11 Collections · TTL Indexes           │
│  Demo Mode: In-memory fallback when DB unavailable           │
└──────────────────────────────────────────────────────────────┘
```

### Dependencies

| Layer | Key Libraries |
|-------|---------------|
| **API** | express 4.18, mongoose 8.1, pino 10.3, helmet 8.1, zod 4.3, express-rate-limit 8.2 |
| **AI** | @google/generative-ai 0.24, groq-sdk 0.37 |
| **Data** | yahoo-finance2 3.13, axios 1.6, cheerio 1.0 |
| **Web** | next 14, react 18, tailwindcss, @tanstack/react-query, lightweight-charts |
| **Shared** | TypeScript types and constants shared across all packages |

---

## 3. Monorepo Structure

```
Stock-Assist/
├── package.json                    # Root — npm workspaces, concurrently
├── tsconfig.json                   # Base TypeScript config
├── .env.example                    # Environment variables template
│
├── apps/
│   ├── api/                        # Backend Express API
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── src/
│   │       ├── index.ts            # Entry point
│   │       ├── config/             # env, db, logger, yahoo
│   │       ├── middleware/          # errors, validation, rate limiting
│   │       ├── models/             # 11 Mongoose models
│   │       ├── routes/             # 12 route modules
│   │       ├── services/           # Core business logic
│   │       │   ├── analysis/       # 20+ analysis modules
│   │       │   ├── indicators/     # Technical indicators
│   │       │   ├── ai/            # AI providers (Gemini, Groq)
│   │       │   ├── data/          # Yahoo Finance, fundamentals
│   │       │   ├── screening/     # Top stock screening pipeline
│   │       │   ├── backtest/      # Signal tracking & calibration
│   │       │   ├── paperTrading/  # Auto paper trading
│   │       │   ├── notifications/ # Telegram alerts
│   │       │   ├── commodity/     # Commodity analysis
│   │       │   ├── news/          # Enhanced news analysis
│   │       │   ├── patterns/      # Pattern detection
│   │       │   └── cache.ts       # In-memory cache (node-cache)
│   │       └── utils/             # Formatting, helpers
│   │
│   └── web/                        # Frontend Next.js App
│       ├── package.json
│       ├── tsconfig.json
│       ├── next.config.js
│       ├── tailwind.config.ts
│       └── src/
│           ├── app/               # Next.js App Router pages
│           ├── components/        # React components
│           ├── hooks/             # Custom React hooks
│           ├── services/          # API client
│           ├── context/           # React Context providers
│           ├── constants/         # Frontend constants
│           └── types/             # Frontend types
│
└── packages/
    └── shared/                     # Shared types & constants
        ├── package.json
        ├── tsconfig.json
        └── src/
            ├── types/             # TypeScript interfaces
            └── constants/         # Stock lists, trading rules
```

### Scripts

```bash
# Development (runs API + Web concurrently)
npm run dev

# Build all packages in order (shared → api → web)
npm run build

# Individual
npm run dev:api          # API on port 4000
npm run dev:web          # Web on port 3000

# Testing & Linting
npm test
npm run lint
```

---

## 4. Backend API

### 4.1 Entry Point & Middleware

**File:** `apps/api/src/index.ts`

The Express server initializes with this middleware stack (in order):

| Order | Middleware | Purpose |
|-------|-----------|---------|
| 1 | `helmet()` | Security headers (CSP, HSTS, etc.) |
| 2 | `requestIdMiddleware` | Adds UUID `requestId` to every request for tracing |
| 3 | `compression()` | Gzip response compression |
| 4 | `responseTimeMiddleware` | Logs response time per request |
| 5 | `cors()` | Configurable CORS (localhost:3000 + FRONTEND_URL) |
| 6 | `express.json()` | Body parsing (1MB limit) |
| 7 | `generalLimiter` | Rate limiting: 100 req/min per IP |
| 8 | Request logger | Logs method + URL + requestId via Pino |
| 9 | Route handlers | All `/api/*` routes |
| 10 | `errorHandler` | Global error handler (MUST be last) |

**Registered Routes:**

| Path | Router | Description |
|------|--------|-------------|
| `/api/analyze` | analyzeRouter | Stock analysis |
| `/api/trade` | tradeRouter | Trade management |
| `/api/watchlist` | watchlistRouter | Watchlist CRUD |
| `/api/analytics` | analyticsRouter | Historical analytics |
| `/api/backtest` | backtestRouter | Prediction tracking, post-mortem |
| `/api/stocks` | stocksRouter | Top 10, chart data |
| `/api/analyze/commodity` | commodityRouter | Commodity analysis |
| `/api/journal` | journalRouter | Trading journal |
| `/api/alerts` | alertsRouter | Telegram alerts |
| `/api/paper-trade` | paperTradeRouter | Paper trading portfolio |
| `/api/risk` | riskRouter | Risk dashboard |
| `/metrics` | metricsRouter | Performance metrics |
| `/health` | inline | Health check with memory/uptime/cache stats |

**Graceful Shutdown:** Handles SIGTERM/SIGINT with 10s forced exit timeout.

### Rate Limiting

| Limiter | Limit | Window | Applied To |
|---------|-------|--------|------------|
| `generalLimiter` | 100 requests | 1 minute | All routes |
| `analysisLimiter` | 10 requests | 1 minute | `/api/analyze/*` (AI calls are expensive) |
| `screeningLimiter` | 5 requests | 1 minute | `/api/stocks/top-10/refresh` |

### Error Handling

Custom error classes with proper HTTP status codes:

| Class | Status | Use Case |
|-------|--------|----------|
| `ValidationError` | 400 | Invalid input (Zod failures) |
| `NotFoundError` | 404 | Resource not found |
| `RateLimitError` | 429 | Rate limit exceeded |
| `UpstreamError` | 502 | Yahoo Finance / AI provider failure |
| `AppError` | varies | Generic application error |

### Request Validation (Zod Schemas)

All input is validated via Zod schemas in `middleware/schemas.ts`:

- `analyzeSingleBody` — `{ symbol: string, language?: string }`
- `analyzeHistoryQuery` — date range, confidence filters
- `tradeCreateBody` — symbol, direction, entry price, quantity, SL/target
- `tradeUpdateBody` — exit price, status, notes
- `watchlistAddBody` — symbol, notes
- `journalCreateBody` — content, sentiment, type, trade details
- `backtestPredictionBody` — analysis passthrough

---

### 4.2 Configuration

**File:** `apps/api/src/config/env.ts`

| Variable | Default | Required | Description |
|----------|---------|----------|-------------|
| `NODE_ENV` | development | No | development / production / test |
| `PORT` | 4000 | No | API server port |
| `MONGODB_URI` | *(empty)* | No | MongoDB connection string (demo mode if missing) |
| `AI_PROVIDER` | gemini | No | AI provider: gemini or groq |
| `GEMINI_API_KEY` | *(empty)* | No | Google Gemini API key |
| `GROQ_API_KEY` | *(empty)* | No | Groq API key |
| `FRONTEND_URL` | *(empty)* | No | Allowed CORS origin |
| `ADMIN_KEY` | *(empty)* | No | Admin key for /metrics |
| `TELEGRAM_BOT_TOKEN` | *(empty)* | No | Telegram Bot API token |
| `TELEGRAM_CHAT_ID` | *(empty)* | No | Telegram chat/group ID |
| `LOG_LEVEL` | debug (dev) / info (prod) | No | Pino log level |

**Database:** `config/db.ts` — MongoDB connection with pool: min 2, max 10 connections.

**Logger:** `config/logger.ts` — Pino with pretty-printing in dev, JSON in production.

---

### 4.3 Database Models

Stock-Assist uses **11 MongoDB collections** with Mongoose schemas:

#### SignalRecord (Core Statistical Engine)

The heart of the system. Every BUY/SELL signal is recorded with full context for building a condition → win-rate matrix.

```
SignalRecord
├── Identity: symbol, date
├── Signal: direction (BUY/SELL), confidence, baseConfidence
├── Conditions at Signal Time:
│   ├── adxValue, adxRegime (strong/weak/choppy)
│   ├── volumeRatio, volumeConfirmed
│   ├── alignmentScore (0-100, multi-timeframe)
│   ├── patternType, patternConfluence (0-100)
│   ├── sectorStrength, sectorModifier
│   ├── rsiValue, fundamentalConflict, ftModifier
│   └── regime (TRENDING_STRONG/WEAK, RANGE, VOLATILE, EVENT_DRIVEN, TRANSITION)
├── Modifiers: volume, multiTF, adx, confluence, ft, sector
├── Condition Hash: hash(regime + alignmentBucket + adxBucket + volumeBucket)
├── Prices: entryPrice, targetPrice, stopLoss
├── Outcome: status (PENDING/TARGET_HIT/STOP_HIT/EXPIRED/PARTIAL_PROFIT)
│   ├── outcomeDate, outcomePrice, pnlPercent, daysToOutcome
│   └── exitReason (target_full/target_partial_trail/stop_initial/stop_trailing/stop_breakeven/rsi_exhaustion/time_expiry)
├── Partial Profit: partialExitPrice, partialExitPnl, partialExitDate, trailingStop
├── Attribution (Phase 3): sub-scores, indicator values, SMC state, Phase 2 signals
└── MFE/MAE: Maximum Favorable/Adverse Excursion
```

**Key Indexes:**
- `{ symbol, status, date }` — Per-stock signal lookup
- `{ conditionHash, status }` — Empirical probability queries
- `{ regime, status }` — Regime-based analysis
- `{ confidence, status }` — Confidence calibration

#### PaperTrade (Virtual Portfolio)

Auto-created from every signal with confidence >= 60. Normalized at Rs.1,00,000 per trade.

```
PaperTrade
├── signalId (ref: SignalRecord)
├── symbol, direction, confidence, regime
├── entryPrice, targetPrice, stopLoss, currentPrice
├── capitalAllocated, quantity
├── unrealizedPnl, unrealizedPnlPercent
├── realizedPnl, realizedPnlPercent
├── status (OPEN/CLOSED_TARGET/CLOSED_STOP/CLOSED_PARTIAL/CLOSED_EXPIRED)
└── exitPrice, exitDate, exitReason, daysHeld
```

#### Alert (Telegram Notification Log)

```
Alert
├── type (HIGH_CONFIDENCE_SIGNAL/STOP_LOSS_APPROACHING/TARGET_APPROACHING/MORNING_TOP_10/SIGNAL_RESOLVED)
├── symbol, message, confidence, direction
├── entryPrice, targetPrice, stopLoss
├── telegramMessageId, delivered, error
└── metadata (flexible JSON)
```

#### DailyTopStocks (Cached Morning Screener)

```
DailyTopStocks
├── date, stocks[] (top 10 picks)
│   └── IStockPick: signals, volumeConfirmed, indicatorVotes, signalAge, signalStrength
├── Scan Metrics: totalAnalyzed, totalScanned, passedPreFilter, passedClarity, passedQualityGates
├── avgConfidence, scanDuration, signalPersistence
└── TTL: 7 days auto-delete
```

#### Other Models

| Model | Purpose | TTL |
|-------|---------|-----|
| `DailyAnalysis` | Stores individual stock analysis results | 60 days |
| `Trade` | Manual trade tracking (LONG/SHORT, P&L) | None |
| `Journal` | Trading journal entries (notes, reflections) | None |
| `Watchlist` | User's stock watchlist | None |
| `Prediction` | AI prediction tracking for calibration | 90 days |
| `CommodityPrediction` | Commodity prediction tracking | 90 days |

---

### 4.4 API Routes & Endpoints

*(See Section 10 for complete API reference)*

---

### 4.5 Services — Analysis Engine

The analysis engine is the core of Stock-Assist. Located in `apps/api/src/services/analysis/`, it contains 20+ specialized modules:

#### Single Analysis Orchestrator (`singleAnalysisOrchestrator.ts`)

**The main pipeline.** Coordinates all sub-services for a single stock analysis:

```
1. Fetch OHLC data (daily + weekly) from Yahoo Finance
2. Calculate all technical indicators
3. Detect candlestick patterns (NSE-calibrated weights)
4. Run SMC analysis (Order Blocks, CHoCH, Liquidity Sweeps)
5. Compute multi-timeframe alignment score
6. Classify market regime (TRENDING/RANGE/VOLATILE/TRANSITION)
7. Calculate ADX slope + Bollinger bandwidth for regime detection
8. Compute MACD histogram momentum, volume trend, RSI divergence
9. Build AI prompt with full technical context
10. Call AI (Gemini/Groq ensemble) for analysis
11. Apply confidence modifiers (volume, MTF, ADX, confluence, FT, sector)
12. Compose final signal (BUY/SELL/HOLD)
13. Calculate risk metrics (entry, target, stop loss)
14. Save SignalRecord (with attribution data)
15. Update signal outcomes (lazy check on prior signals)
16. Create PaperTrade (if confidence >= 60)
17. Send Telegram alert (if confidence >= 70)
18. Return full response to API
```

#### Confidence Scoring (`confidenceScoring.ts`)

Dynamic confidence calculation with research-backed modifiers:

| Modifier | Effect | Condition |
|----------|--------|-----------|
| Volume penalty | -15 to 0 | Low volume = weak conviction |
| Multi-TF alignment | -12 to 0 | Weak daily/weekly alignment |
| ADX penalty | -10 to 0 | Choppy market (ADX < 15) |
| Pattern confluence | -8 to +8 | Isolated vs confluent patterns |
| FT conflict | -12 to 0 | Fundamentals contradict technicals |
| Sector modifier | -5 to +5 | Sector over/underperformance |
| MACD deceleration | -8 | Histogram momentum decelerating |
| Volume decreasing | -10 | Volume trend is decreasing |
| Volume increasing | +5 | Volume trend is increasing |
| RSI bearish divergence | -15 | Price higher high, RSI lower high |
| RSI bullish divergence | +12 | Price lower low, RSI higher low |

**Hard Filters:**
- Weekly trend bearish → BUY blocked (forced HOLD)
- Weekly trend bullish → SELL blocked (forced HOLD)

**Score Inflation Reduction:**
- Signal amplification: 1.15x (reduced from 1.25x)
- Sigmoid steepness: 1.2 (reduced from 1.6)
- BUY/SELL threshold: 65 (raised from 60)
- Floor: 20 (raised from 15)

#### Signal Composer (`signalComposer.ts`)

Composes the final signal from conviction components:

| Component | Weight | Notes |
|-----------|--------|-------|
| Multi-TF Alignment | 35 | Most important factor |
| Unmitigated Order Block | 20 | SMC structure |
| Liquidity Sweep | 15 | Smart money indicator |
| CHoCH Daily | 10 | Change of character |
| Volume Spike | 10 | Confirmation |
| Candlestick Pattern | 10 | NSE-calibrated |
| FVG Target | 0 | Removed — unreliable on NSE |

**Minimum conviction: 65** (raised from 55)

#### Regime Classifier (`regimeClassifier.ts`)

Classifies market into 6 regimes with different scoring weights:

| Regime | Detection | Weight Distribution |
|--------|-----------|-------------------|
| **TRENDING_STRONG** | ADX > 25, clear MA slope | Tech 40%, Pattern 15%, Vol 20%, News 10%, Fund 15% |
| **TRENDING_WEAK** | ADX 15-25, moderate slope | Tech 30%, Pattern 20%, Vol 15%, News 15%, Fund 20% |
| **RANGE** | ADX < 15, flat MAs | Tech 20%, Pattern 25%, Vol 15%, News 20%, Fund 20% |
| **VOLATILE** | High ATR, wide Bollinger | Tech 30%, Pattern 10%, Vol 25%, News 20%, Fund 15% |
| **EVENT_DRIVEN** | High news impact | Tech 15%, Pattern 10%, Vol 15%, News 40%, Fund 20% |
| **TRANSITION** | ADX < 20 + rising slope + BB squeeze | Tech 35%, Pattern 15%, Vol 25%, News 10%, Fund 15% |

**TRANSITION Detection:** ADX < 20 AND ADX slope > 1.0 AND Bollinger bandwidth < 50% of 120-bar average AND rising ADX.

#### Candlestick Patterns (`candlestick.ts`)

NSE-calibrated weights from a 16-year study across 17 NIFTY 50 stocks:

| Pattern | Weight | Strength |
|---------|--------|----------|
| Plain Doji | 0.00 | none (removed) |
| Spinning Top | 0.00 | none (removed) |
| Hammer | 0.57 | moderate |
| Bullish/Bearish Marubozu | 0.62 | moderate |
| Bullish/Bearish Engulfing | 0.58 | moderate |
| Bullish/Bearish Harami | 0.60 | moderate |
| Morning/Evening Star | 0.62 | strong |
| Three White Soldiers/Black Crows | 0.60 | strong |
| Three Inside Up/Down | 0.61 | strong |

#### Smart Money Concepts (`smc.ts`)

| Parameter | Value | Notes |
|-----------|-------|-------|
| MAX_OB_AGE | 20 bars | Tightened from 50 (stale OBs removed) |
| OB_IMPULSE_ATR_MULTIPLIER | 2.0 | Raised from 1.5 (stronger OBs only) |
| CHOCH_CONFIRM_ATR_MULTIPLIER | 0.7 | Raised from 0.3 (more confirmed CHoCH) |

#### Entry Zone (`entryZone.ts`)

- **SL_ATR_BUFFER:** 1.2 ATR (fixed from 0.5 — was too tight, causing premature stop-outs)
- **Entry Priority:** Liquidity Sweep > Order Block (FVG removed — unreliable on NSE)

#### Other Analysis Modules

| Module | Purpose |
|--------|---------|
| `technicalAnalysis.ts` | Multi-timeframe technical analysis coordinator |
| `calibration.ts` | Confidence calibration using resolved signal history |
| `dataDerivedModifiers.ts` | Empirical modifiers from condition → win-rate matrix |
| `signalClarity.ts` | Signal quality scoring (MIN_CLARITY_THRESHOLD = 71) |
| `breadth.ts` | Market breadth indicator |
| `patternConfluence.ts` | Pattern confluence scoring |
| `fundamentalTechnical.ts` | Fundamental-technical conflict detection |
| `riskMetrics.ts` | Risk/reward ratio calculations |
| `expectancy.ts` | Trading expectancy computation |
| `tradeSelectivity.ts` | Trade selectivity metrics |
| `responseBuilder.ts` | AI response formatting |

---

### 4.6 Services — Technical Indicators

Located in `apps/api/src/services/indicators/`:

#### RSI (`rsi.ts`)

**Sector-optimized RSI periods** (Inumula 2019 research):

| Sector | RSI Period |
|--------|-----------|
| IT | 10 |
| Banking/Finance | 12 |
| Pharma | 16 |
| Auto | 13 |
| FMCG | 18 |
| Metal/Energy | 9 |
| Default | 14 |

**RSI Divergence Detection** (`detectRSIDivergence()`):
- **Bearish:** Price makes higher high, RSI makes lower high
- **Bullish:** Price makes lower low, RSI makes higher low
- Lookback: 20 bars

#### MACD (`volume.ts`)

**Sector-optimized MACD parameters:**

| Sector | Fast | Slow | Signal |
|--------|------|------|--------|
| IT | 8 | 21 | 7 |
| Banking/Finance | 10 | 22 | 8 |
| Pharma | 14 | 30 | 10 |
| Auto | 11 | 24 | 8 |
| FMCG | 16 | 32 | 11 |
| Metal/Energy | 7 | 19 | 6 |
| Default | 12 | 26 | 9 |

**MACD Histogram Momentum** (`macdHistogramMomentum()`):
- **Accelerating:** Last 3 histogram values all increasing in absolute magnitude
- **Decelerating:** Last 3 histogram values all decreasing
- **Stable:** Otherwise

#### Volume (`volume.ts`)

- `analyzeVolume()` — Volume analysis with ratio, trend, confirmation
- `calcVWAP()` — Volume Weighted Average Price
- `calcATR()` — Average True Range
- `volumeTrend()` — 5-bar volume trend (increasing/decreasing/flat)

#### Moving Averages (`ma.ts`)

- `calcSMA()` — Simple Moving Average
- `calcEMA()` — Exponential Moving Average
- `calcMA()` — Combined MA analysis (EMA9, EMA21, SMA50, SMA200 with trend detection)

#### Other Indicators

| File | Indicators |
|------|-----------|
| `adx.ts` | ADX (Average Directional Index) — trend strength |
| `bollinger.ts` | Bollinger Bands (%B, bandwidth), Fibonacci retracement levels |
| `sr.ts` | Support/Resistance level detection |

---

### 4.7 Services — AI Integration

Located in `apps/api/src/services/ai/`:

| File | Purpose |
|------|---------|
| `gemini.ts` | Google Gemini API integration (primary provider) |
| `groq.ts` | Groq API integration (faster inference, secondary) |
| `ensembleAI.ts` | Ensemble approach — calls multiple models for robustness |
| `prompt.ts` | Base analysis prompt template |
| `enhancedPrompt.ts` | Enhanced prompt with multi-timeframe context, indicator data, SMC analysis |

The prompt includes:
- All technical indicator values (RSI, MACD, MA trends, ADX, Bollinger)
- Candlestick patterns detected with confidence weights
- SMC analysis (Order Blocks, CHoCH, sweeps)
- Multi-timeframe alignment score
- Volume confirmation status
- Sector comparison data
- Fundamental metrics (P/E, P/B)
- News sentiment analysis

---

### 4.8 Services — Data Sources

Located in `apps/api/src/services/data/`:

| File | Source | Data |
|------|--------|------|
| `yahooHistory.ts` | Yahoo Finance | OHLC historical data (daily, weekly, monthly) |
| `yahooQuote.ts` | Yahoo Finance | Real-time quote data |
| `fundamentals.ts` | Yahoo Finance | P/E, P/B, market cap, dividend yield |
| `sectorComparison.ts` | Computed | Stock vs sector performance comparison |

**Caching:** `services/cache.ts` uses `node-cache` with configurable TTL:
- Analysis results: 1 hour
- Signal stats: 5 minutes
- Chart data: 15 minutes

---

### 4.9 Services — Screening Pipeline

Located in `apps/api/src/services/screening/`:

```
SCREENING_UNIVERSE (~200 stocks: NIFTY 100 + Midcap 100)
       │
       ▼
[Pre-Filter] qualityGates.ts
  • Minimum volume threshold
  • Minimum price movement
  • Data availability check
       │
       ▼
[Analysis] batchAnalysisOrchestrator.ts
  • Run full analysis pipeline per stock
  • Calculate indicators, patterns, AI analysis
       │
       ▼
[Signal Clarity] signalClarity.ts
  • MIN_CLARITY_THRESHOLD = 71
  • Multi-indicator agreement scoring
  • Noise filtering
       │
       ▼
[Quality Gates]
  • Confidence >= 65
  • Volume confirmed
  • Multi-TF alignment
       │
       ▼
[Top 10] topStocks.ts
  • Rank by signal clarity + confidence
  • Cache in DailyTopStocks model
  • Signal persistence tracking
```

---

### 4.10 Services — Signal Tracking & Backtest

Located in `apps/api/src/services/backtest/`:

#### Signal Tracker (`signalTracker.ts`)

**Signal Saving:**
- Every BUY/SELL signal saved with full condition context
- Condition hash computed: `hash(regime + alignmentBucket + adxBucket + volumeBucket)`
- Deduplication: one signal per symbol per day (update if exists)

**Outcome Resolution (Lazy Check):**
Run on every analysis request for the same symbol. Checks OHLC bars after signal date:

**Partial Profit Exit System (Phase 2):**

```
Day 0: Signal fires (PENDING)
  │
  ├─ Bar hits 1.5R target → 50% position exited (PARTIAL_PROFIT)
  │   ├─ Remaining 50%: trailing stop = lowest_low_last_2_bars (BUY)
  │   ├─ RSI Exhaustion Guard: RSI > 80 in first 3 days → tighten to breakeven
  │   │   └─ RSI drops < 65 → exit remaining (rsi_exhaustion)
  │   └─ Full target at 2.5R → exit remaining (target_full)
  │
  ├─ Bar hits stop loss → full exit (STOP_HIT)
  │
  └─ Day 7: Hard expiry (EXPIRED)
```

**MFE/MAE Tracking:** Records maximum favorable and adverse excursion during the trade.

**Blended P&L:** For partial exits: `(50% × partialPnl) + (50% × remainderPnl)`

#### Empirical Probability Engine

```
conditionHash → { totalSignals, wins, losses, winRate }
```

Buckets:
- **Alignment:** 80-100, 60-80, 40-60, 0-40
- **ADX:** 25+, 20-25, 15-20, 0-15
- **Volume:** 2.0+, 1.5-2.0, 1.0-1.5, 0-1.0

---

### 4.11 Services — Paper Trading

Located in `apps/api/src/services/paperTrading/`:

- **Auto-creation:** Every signal with confidence >= 60 gets a paper trade (Rs.1,00,000 normalized capital)
- **Sync:** `syncPaperTrades()` closes paper trades when their linked SignalRecord resolves
- **Unrealized P&L:** `updateUnrealizedPnl()` updates with current market prices
- **Portfolio Summary:** Win rate, profit factor, total P&L, avg holding days

---

### 4.12 Services — Notifications (Telegram)

Located in `apps/api/src/services/notifications/telegram.ts`:

| Alert Type | Trigger | Content |
|------------|---------|---------|
| `HIGH_CONFIDENCE_SIGNAL` | Signal fires with confidence >= 70 | Symbol, direction, entry/target/SL, R:R, regime, pattern |
| `STOP_LOSS_APPROACHING` | Price within X% of stop loss | Current price, stop level, distance |
| `TARGET_APPROACHING` | Price within X% of target | Current price, target, unrealized P&L |
| `MORNING_TOP_10` | Manual trigger or scheduled | Top 10 ranked signals for the day |
| `SIGNAL_RESOLVED` | Signal hits target/stop | Outcome, P&L, days held |

**Integration Points:**
- Orchestrator: auto-fires on high-confidence signals
- Signal Tracker: auto-fires on signal resolution (target/stop hit)
- Route: manual morning top 10 trigger, custom messages, test endpoint

---

## 5. Frontend Web App

### 5.1 Pages & Routing

| Route | Page | Description |
|-------|------|-------------|
| `/` | Dashboard | Top 10 stocks, watchlist, quick actions |
| `/analyze` | Analysis | Single stock deep analysis with all indicators |
| `/commodity` | Commodity | Gold, Silver, Crude Oil analysis |
| `/history` | History | Browse historical analyses with filters |
| `/journal` | Journal | Trading journal with notes and reflections |
| `/settings` | Settings | Theme, language, preferences |

### 5.2 Components

```
components/
├── analysis/
│   └── AnalysisDetail.tsx      # Full analysis view (indicators, patterns, AI, SMC, risk)
├── dashboard/
│   ├── StockCard.tsx           # Individual stock card with signal badge
│   └── WatchlistPanel.tsx      # Watchlist sidebar panel
├── chart/
│   └── [Chart components]      # Lightweight-charts based OHLC charting
├── commodity/
│   └── [Commodity components]  # Commodity-specific views
├── layout/
│   ├── Navbar.tsx              # Top navigation bar
│   ├── BottomNav.tsx           # Mobile bottom navigation
│   └── SplashScreen.tsx        # Loading splash screen
├── ui/
│   └── [Reusable UI]          # Buttons, cards, modals, badges
└── pwa/
    └── InstallPrompt.tsx       # PWA install banner
```

### 5.3 Hooks & Services

| Hook | Purpose |
|------|---------|
| `useTopStocks` | Fetch & cache top 10 stocks from `/api/stocks/top-10` |
| `useAnalysis` | Single stock analysis from `/api/analyze/single` |
| `useChartData` | OHLC chart data from `/api/stocks/chart` |
| `useCommodityChartData` | Commodity chart data |

**API Service** (`services/api.ts`): Centralized HTTP client with:
- Base URL configuration (`NEXT_PUBLIC_API_URL`)
- Error handling & response formatting
- Request/response interceptors

### 5.4 Context & State Management

| Context | State | Persistence |
|---------|-------|-------------|
| `ThemeContext` | Dark/light mode toggle | localStorage |
| `LanguageContext` | English/Hindi (i18n) | localStorage |
| `WatchlistContext` | User's stock watchlist | API-backed |
| `QueryProvider` | React Query client | In-memory cache |

### Frontend Constants

```typescript
API_ENDPOINTS = {
    TOP_STOCKS: '/api/stocks/top-10',
    ANALYZE_SINGLE: '/api/analyze/single',
    CHART_DATA: '/api/stocks/chart',
    // ... all endpoint URLs
}

CONFIDENCE = { HIGH: 70, MEDIUM: 50 }
CHART_RANGES = ['1M', '3M', '6M', '1Y', '2Y']
CHART_COLORS = { bullish: 'emerald', bearish: 'rose' }
```

---

## 6. Shared Package

### 6.1 Types

Located in `packages/shared/src/types/`:

| File | Key Types |
|------|-----------|
| `stock.ts` | `OHLCData`, `StockData`, `StockQuote` |
| `indicators.ts` | `TechnicalIndicators`, `RSIResult`, `MAResult`, `MACDResult`, `VolumeAnalysis`, `VWAPResult` |
| `analysis.ts` | `AnalysisRequest`, `AnalysisResponse`, `ConfidenceResult` |
| `patterns.ts` | `CandlestickPattern`, `PatternType` |
| `news.ts` | `NewsItem`, `NewsAnalysis` |
| `enhanced.ts` | Extended types (see below) |

**Enhanced Types (`enhanced.ts`):**
- `TimeframeResult` — patterns, trend, strength, keyLevels per timeframe
- `MultiTimeframeAnalysis` — alignment score across Daily/Weekly/Monthly
- `CandlestickAnalysis` — patterns[], bullishCount, bearishCount, dominantBias, compositeScore
- `BollingerBandsResult` — upper, middle, lower, position, percentB
- `EnhancedNewsAnalysis` — items[], sentiment, sentimentScore, impactLevel
- `FundamentalData` — valuation metrics, growth, financial health
- `ConfidenceBreakdown` — weighted sub-scores:
  - Pattern Strength: 25%
  - Technical Alignment: 25%
  - News Sentiment: 20%
  - Volume Confirmation: 15%
  - Fundamental Strength: 15%

### 6.2 Constants

**Stock Lists (`constants/stocks.ts`):**

| List | Count | Description |
|------|-------|-------------|
| `DEFAULT_WATCHLIST` | 10 | User favorites (RELIANCE, TCS, INFY, HDFCBANK, ICICIBANK, SBIN, BHARTIARTL, ITC, KOTAKBANK, LT) |
| `NIFTY_100` | 100 | Top 100 NSE stocks by market cap |
| `SCREENING_UNIVERSE` | ~200 | NIFTY 100 + Midcap 100 (all liquid stocks) |
| `STOCK_NAMES` | ~200 | Symbol → company name mapping |

**Trading Rules (`constants/trading.ts`):**

```typescript
TRADING = {
    CAPITAL: 15_000,                    // Virtual capital (Rs.)
    MAX_RISK: 500,                      // Max risk per trade (Rs.)
    MAX_POSITION_PERCENT: 40,           // Max single position size
    DEFAULT_STOP_LOSS_PERCENT: 1.5,     // Default SL
    MAX_STOP_LOSS_PERCENT: 2.0,         // Hard SL cap
    MIN_RISK_REWARD: 1.5,              // Minimum R:R ratio
    WIN_RATE_TARGET: 70,               // Target win rate %
    COSTS: {
        BROKERAGE: 0.03,               // 0.03% per leg
        STT: 0.025,                    // Securities Transaction Tax
        EXCHANGE: 0.00345,             // Exchange charges
        GST: 18,                       // GST on brokerage (%)
        STAMP_DUTY: 0.015,            // Stamp duty
        SLIPPAGE: 0.10,               // Estimated slippage
    }
}
// Total round-trip cost: ~0.35%
```

---

## 7. Data Flow Diagrams

### Morning Screening Flow

```
┌─────────────────────┐
│ SCREENING_UNIVERSE   │  ~200 liquid NSE stocks
│ (NIFTY100 + MC100)  │
└────────┬────────────┘
         │
         ▼
┌─────────────────────┐
│   Pre-Filter        │  Volume, price movement, data availability
│   (qualityGates)    │  ~200 → ~150 stocks
└────────┬────────────┘
         │
         ▼
┌─────────────────────┐
│  Full Analysis      │  Per stock: indicators → patterns → AI → scoring
│  (batch orchestr.)  │  ~150 → analyzed
└────────┬────────────┘
         │
         ▼
┌─────────────────────┐
│  Signal Clarity     │  MIN_CLARITY_THRESHOLD = 71
│  (signalClarity)    │  Multi-indicator agreement
└────────┬────────────┘
         │
         ▼
┌─────────────────────┐
│  Quality Gates      │  Confidence >= 65, volume confirmed, MTF aligned
│  + Ranking          │  Sort by clarity × confidence
└────────┬────────────┘
         │
         ▼
┌─────────────────────┐
│  TOP 10             │  Cached in DailyTopStocks
│  Dashboard Ready    │  Served to frontend
└─────────────────────┘
```

### Single Stock Analysis Pipeline

```
User enters symbol
      │
      ▼
┌─────────────────┐     ┌──────────────────┐
│  Yahoo Finance  │────▶│ OHLC Data        │
│  (daily+weekly) │     │ (D/W timeframes) │
└─────────────────┘     └────────┬─────────┘
                                 │
                    ┌────────────┼────────────┐
                    ▼            ▼            ▼
              ┌──────────┐ ┌──────────┐ ┌──────────┐
              │Indicators│ │Candlestk │ │   SMC    │
              │RSI, MACD │ │ Patterns │ │OB, CHoCH │
              │ADX, BB   │ │(NSE cal.)│ │Sweep,FVG │
              │VWAP, ATR │ │          │ │          │
              └────┬─────┘ └────┬─────┘ └────┬─────┘
                   │            │            │
                   └────────────┼────────────┘
                                │
                                ▼
                    ┌───────────────────────┐
                    │  Multi-TF Alignment   │
                    │  + Regime Classifier  │
                    │  + Sector Comparison  │
                    └───────────┬───────────┘
                                │
                                ▼
                    ┌───────────────────────┐
                    │   AI Prompt Builder   │
                    │ (all context injected)│
                    └───────────┬───────────┘
                                │
                                ▼
                    ┌───────────────────────┐
                    │ Gemini / Groq / Both  │
                    │   (ensemble AI)       │
                    └───────────┬───────────┘
                                │
                                ▼
                    ┌───────────────────────┐
                    │  Confidence Scoring   │
                    │  + Modifiers Applied  │
                    │  + Hard Filters       │
                    └───────────┬───────────┘
                                │
                                ▼
                    ┌───────────────────────┐
                    │   Signal Composer     │
                    │  BUY / SELL / HOLD    │
                    └───────────┬───────────┘
                                │
              ┌─────────────────┼─────────────────┐
              ▼                 ▼                 ▼
     ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
     │ SignalRecord  │  │ PaperTrade   │  │  Telegram    │
     │   (saved)    │  │ (if >= 60)   │  │ (if >= 70)   │
     └──────────────┘  └──────────────┘  └──────────────┘
```

### Signal Lifecycle

```
Signal Created (PENDING)
      │
      ├──── Bar hits 1.5R ──────▶ PARTIAL_PROFIT (50% exited)
      │                                │
      │                    ┌───────────┼───────────┐
      │                    ▼           ▼           ▼
      │              Full target   Trail stop   RSI exhaust
      │              (2.5R hit)    (LL 2-bar)   (>80→<65)
      │                    │           │           │
      │                    ▼           ▼           ▼
      │              TARGET_HIT   STOP_HIT    TARGET_HIT
      │                          (trailing)   (rsi_exhaust)
      │
      ├──── Bar hits stop loss ─▶ STOP_HIT (stop_initial)
      │
      └──── Day 7 reached ──────▶ EXPIRED (time_expiry)
```

---

## 8. Key Algorithms & Research

### NSE-Calibrated Pattern Weights

Based on a **16-year study across 17 NIFTY 50 stocks**. Plain Doji and Spinning Top set to 0 (unreliable on NSE). Three-candle patterns (Morning/Evening Star, Three Soldiers/Crows) weighted highest at 0.60-0.62.

### Sector-Optimized Indicators

Based on **Inumula 2019** research on sector-specific optimal parameters for Indian markets. Fast-moving sectors (IT, Metal/Energy) use shorter periods; slow-moving sectors (FMCG, Pharma) use longer periods.

### ATR-Based Stop Loss

**1.2 ATR buffer** based on a **9,433-trade backtest** showing the original 0.5 ATR was too tight for NSE volatility, causing premature stop-outs.

### Partial Profit Exit System

**Profit Factor math:**
- Win Rate: 57.5%
- Average Winner: 2.5R (blended: 50% at 1.5R + 50% trailing to 2.5R)
- Profit Factor: 57.5% × 2.5R / (42.5% × 1.0R) = **PF 3.4**

### Bollinger Squeeze (TRANSITION Detection)

When Bollinger bandwidth drops below 50% of its 120-bar average AND ADX starts rising from below 20, the market is transitioning from range to trend. This is the optimal entry window.

---

## 9. Environment Setup

### Prerequisites

- Node.js >= 18
- npm >= 9
- MongoDB (optional — demo mode works without it)

### Quick Start

```bash
# 1. Clone and install
git clone <repo-url> Stock-Assist
cd Stock-Assist
npm install

# 2. Configure environment
cp .env.example .env
# Edit .env with your keys

# 3. Start development
npm run dev
# API: http://localhost:4000
# Web: http://localhost:3000

# 4. Build for production
npm run build
```

### Environment Variables

```env
# Required for full functionality
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/stock-assist
GEMINI_API_KEY=your-gemini-key

# Optional enhancements
GROQ_API_KEY=your-groq-key              # Faster AI inference
TELEGRAM_BOT_TOKEN=your-bot-token       # Telegram alerts
TELEGRAM_CHAT_ID=your-chat-id           # Alert destination
ADMIN_KEY=your-admin-key                # /metrics access

# Defaults (usually fine as-is)
PORT=4000
NODE_ENV=development
AI_PROVIDER=gemini
NEXT_PUBLIC_API_URL=http://localhost:4000
NEXT_PUBLIC_APP_URL=http://localhost:3000
LOG_LEVEL=debug
```

---

## 10. API Reference (All Endpoints)

### Stock Analysis

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/analyze/stocks` | Screen default watchlist (10 stocks) |
| `POST` | `/api/analyze/single` | Deep analysis for one stock `{ symbol, language? }` |
| `GET` | `/api/analyze/history` | Historical analyses `?symbol=&startDate=&endDate=&minConfidence=` |
| `GET` | `/api/analyze/signal-stats` | Signal tracking stats, regime learning, calibration data |

### Stock Screening & Charts

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/stocks/top-10` | Today's top 10 signals (cached) |
| `POST` | `/api/stocks/top-10/refresh` | Force re-screen all 200 stocks |
| `GET` | `/api/stocks/chart` | OHLC chart data `?symbol=&range=1y&interval=1d` |

### Backtest & Calibration

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/backtest/predictions` | Save AI prediction for tracking |
| `POST` | `/api/backtest/check` | Check all pending predictions against current prices |
| `GET` | `/api/backtest/stats` | Accuracy: win rate, net PnL, target/stop hits |
| `GET` | `/api/backtest/calibration` | Confidence calibration data |
| `GET` | `/api/backtest/calibration-summary` | Calibration status summary |
| `GET` | `/api/backtest/summary` | Full backtest summary |
| `GET` | `/api/backtest/smc-comparison` | A/B comparison: with vs without SMC signals |
| `GET` | `/api/backtest/component-effectiveness` | Win rate by confidence, regime, pattern, SMC confluence |
| `GET` | `/api/backtest/post-mortem` | List resolved signals for post-mortem `?symbol=&limit=` |
| `GET` | `/api/backtest/post-mortem/:signalId` | Full post-mortem: indicator accuracy, learning insight |

### Paper Trading

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/paper-trade` | List paper trades `?status=OPEN&symbol=&limit=` |
| `GET` | `/api/paper-trade/portfolio` | Portfolio summary (P&L, win rate, profit factor) |
| `GET` | `/api/paper-trade/pnl-curve` | Cumulative P&L curve for charting |
| `POST` | `/api/paper-trade/sync` | Sync paper trades with resolved signals |
| `POST` | `/api/paper-trade/update-prices` | Update unrealized P&L `{ prices: { SYMBOL: price } }` |

### Telegram Alerts

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/alerts` | List alerts `?type=&symbol=&limit=&delivered=` |
| `GET` | `/api/alerts/stats` | Delivery stats by type, rate, last 24h |
| `POST` | `/api/alerts/test` | Test bot connection + send test message |
| `POST` | `/api/alerts/morning-top10` | Trigger morning top 10 alert |
| `POST` | `/api/alerts/send` | Send custom message `{ message: string }` |

### Risk Dashboard

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/risk/dashboard` | Full dashboard: risk score, open risk, concentration, worst-case, weekly P&L |

### Trade Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/trade` | List trades (paginated) `?page=&limit=` |
| `POST` | `/api/trade` | Create trade `{ symbol, direction, entryPrice, quantity }` |
| `PUT` | `/api/trade/:id` | Update/close trade `{ exitPrice, status }` |
| `DELETE` | `/api/trade/:id` | Delete trade |

### Watchlist

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/watchlist` | Get all watched stocks |
| `POST` | `/api/watchlist` | Add stock `{ symbol, notes? }` |
| `DELETE` | `/api/watchlist/:symbol` | Remove stock |

### Journal

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/journal` | Get all journal entries |
| `POST` | `/api/journal` | Create entry `{ content, sentiment?, type?, tradeDetails? }` |
| `PUT` | `/api/journal/:id` | Update entry |
| `DELETE` | `/api/journal/:id` | Delete entry |

### Commodity Analysis

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/analyze/commodity/supported` | List supported commodities |
| `GET` | `/api/analyze/commodity/exchanges/:symbol` | Supported exchanges for commodity |
| `POST` | `/api/analyze/commodity/analyze` | Analyze commodity `{ symbol, exchange, language? }` |
| `GET` | `/api/analyze/commodity/history` | Historical commodity analyses |

### System

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/health` | Health check (memory, uptime, cache stats) |
| `GET` | `/metrics` | Performance metrics (admin key required) |

---

*Generated: 2026-04-05*
*Stock-Assist v1.0 — All 4 phases of the FINAL-MASTER-PLAN implemented*
