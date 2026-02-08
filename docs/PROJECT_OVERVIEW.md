# 🚀 AI Trading Assistant - Complete Project Documentation

> **Version:** 1.0.0  
> **Last Updated:** February 6, 2026  
> **Status:** Pre-Development  

---

## 📋 Table of Contents

1. [Project Overview](#-project-overview)
2. [System Architecture](#-system-architecture)
3. [Tech Stack](#-tech-stack)
4. [Core Functionality](#-core-functionality)
5. [Dual Strategy System](#-dual-strategy-system)
6. [Folder Structure](#-folder-structure)
7. [Database Schema](#-database-schema)
8. [Data Flow](#-data-flow)
9. [API Endpoints](#-api-endpoints)
10. [UI Pages](#-ui-pages)
11. [Implementation Roadmap](#-implementation-roadmap)
12. [Success Criteria](#-success-criteria)

---

## 🎯 Project Overview

### What is this?
**AI Trading Assistant** is a dual-strategy trading analysis system designed to help make profitable trades with ₹15,000 capital. The unique feature is analyzing BOTH bullish AND bearish scenarios for every stock, giving you a plan regardless of market direction.

---

## 🎯 CORE FOCUS: ACCURACY

> **The #1 priority of this system is ACCURACY.** 
> Every feature, every algorithm, every AI prompt is designed to provide the **MOST ACCURATE trading suggestions possible.**

### Why Accuracy Matters
- Accurate analysis = Confident decisions
- Accurate patterns = Higher win rate
- Accurate levels = Better entries & exits
- Accurate scenarios = Right plan for any market direction

**We don't limit profit targets.** A single accurate trade can yield ₹1,000, ₹5,000, or even ₹10,000+. The focus is on getting the analysis RIGHT.

---

## 🎯 ACCURACY OPTIMIZATION STRATEGIES

### Data Quality
- **Use 30-day historical data minimum** (not just 20)
- **Cross-verify Yahoo Finance data** with backup source when available
- **Filter out low-volume stocks** (< 100k daily volume)
- **Ignore news older than 72 hours** (already priced in)

### Technical Indicator Accuracy
- **RSI**: Use 14-period (industry standard)
- **Support/Resistance**: Must be tested 2+ times to be valid
- **Moving Averages**: Use both 20 & 50 day for confirmation
- **Volume**: Compare to 20-day average, not just yesterday

### Pattern Detection Accuracy
- **Pattern confidence threshold**: > 70% to consider
- **Require volume confirmation** for breakouts
- **Ignore patterns in low-liquidity stocks**
- **Use multiple timeframes** (1D + 1W) for validation

### AI Prompt Optimization
- **Provide specific numerical data** (not "high volume")
- **Include market context** (Nifty trend, sector trend)
- **Ask AI to show its reasoning** step-by-step
- **Request confidence scores** for each prediction

### News Sentiment Accuracy
- **Filter only NSE/company-specific news**
- **Ignore opinion pieces and rumors**
- **Weight recent news (24h) higher** than 3-day old
- **Cross-reference multiple sources** for major news

### Probability Calibration
- **After 30 trades, calibrate AI probabilities**
- **If AI says 70% bullish, should win 65-75% of time**
- **Adjust prompts if systematic bias detected**
- **Keep calibration logs in database**

---

### Goals
| Metric | Target |
|--------|--------|
| **Analysis Accuracy** | > 70% pattern recognition |
| **Win Rate Target** | > 55% |
| **Profit Potential** | Unlimited (₹1,000 - ₹10,000+ per trade) |
| **Max Risk Per Trade** | ₹500 |
| **Profit Factor** | > 1.5 |

### Unique Value Proposition
- **🎯 ACCURACY FIRST**: Every component optimized for maximum prediction accuracy
- **Dual Strategy Analysis**: Get trading plans for BOTH up and down scenarios
- **AI-Powered Insights**: Gemini AI analyzes patterns, news, and technicals
- **100% Free**: All services used are free tier
- **Personal Trading Journal**: Track what works for YOU
- **Pattern-Based Learning**: System learns which patterns work best
- **No Profit Limits**: Accurate trades can yield ₹1,000 to ₹10,000+

---

## 🏗️ System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     FRONTEND (Next.js 14)                        │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │  Dashboard  │  │   Analyze   │  │   Journal   │              │
│  │  (Morning   │  │   (Single   │  │   (Trade    │              │
│  │  Screening) │  │    Stock)   │  │   Tracker)  │              │
│  └─────────────┘  └─────────────┘  └─────────────┘              │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│              API ROUTES (Next.js Backend)                        │
│                                                                  │
│  /api/analyze-stocks    → Morning screening (10 stocks)         │
│  /api/analyze-single    → Single stock analysis                 │
│  /api/save-trade        → Log trade to journal                  │
│  /api/get-analytics     → Performance statistics                │
│                                                                  │
└──────┬──────────┬──────────┬──────────┬─────────────────────────┘
       │          │          │          │
       ▼          ▼          ▼          ▼
┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐
│  Yahoo   │ │  Gemini  │ │  Google  │ │ MongoDB  │
│ Finance  │ │   API    │ │   News   │ │  Atlas   │
│  (Data)  │ │   (AI)   │ │  (RSS)   │ │   (DB)   │
│   FREE   │ │   FREE   │ │   FREE   │ │   FREE   │
└──────────┘ └──────────┘ └──────────┘ └──────────┘
```

### Flow Summary
1. **User** opens dashboard
2. **Frontend** calls API endpoints
3. **API** fetches market data from Yahoo Finance
4. **API** fetches news from Google News RSS
5. **API** sends data to Gemini AI for dual analysis
6. **API** stores results in MongoDB
7. **Frontend** displays dual scenarios

---

## 💻 Tech Stack

### Frontend
| Technology | Purpose | Cost |
|------------|---------|------|
| Next.js 14 | React framework with SSR | Free |
| React 18 | UI components | Free |
| TailwindCSS | Styling | Free |
| Chart.js / Recharts | Performance charts | Free |

### Backend
| Technology | Purpose | Cost |
|------------|---------|------|
| Next.js API Routes | Backend APIs | Free |
| Mongoose | MongoDB ODM | Free |

### External Services
| Service | Purpose | Cost |
|---------|---------|------|
| MongoDB Atlas | Database (512MB free) | **FREE** |
| Yahoo Finance API | Stock OHLC data | **FREE** |
| Google News RSS | Stock news headlines | **FREE** |
| Google Gemini API | AI analysis | **FREE** |
| Vercel | Hosting | **FREE** |

### **Total Monthly Cost: ₹0**

---

## 📊 Core Functionality

### 1. Morning Screening (Automated)

**Trigger:** 9:00 AM daily (manual or cron)

**Input:** Your watchlist (10 stocks)

**Process:**
```
1. Fetch 30 days OHLC data (Yahoo Finance)
2. Calculate indicators (RSI, MA, Support/Resistance)
3. Detect patterns (flags, triangles, breakouts)
4. Fetch news (last 3 days)
5. Send to AI for dual analysis
6. Get both bullish AND bearish scenarios
7. Store in database
8. Display on dashboard
```

**Output:**
| Category | Count | Action |
|----------|-------|--------|
| ✅ Strong Setups | 3-4 | Trade these |
| ⚠️ Avoid | 2-3 | High risk, skip |
| ⏳ Neutral | 3-4 | Wait for clarity |

---

### 2. Single Stock Analysis (On-Demand)

**Trigger:** Anytime during market hours

**Input:** Stock symbol (e.g., "RELIANCE")

**Process:**
```
1. Fetch real-time data
2. Calculate indicators
3. Fetch latest news (24 hours)
4. AI dual analysis
5. Return both scenarios
```

**Output:** Detailed dual-scenario analysis

**Time:** 30-45 seconds

---

### 3. Trade Journal

**Input:** Your executed trades

**Features:**
- Log entry, exit, P&L
- AI reviews: Was pattern accurate?
- Track win rate by pattern type
- Identify what works for YOU

**Output:** Performance analytics & insights

---

## 🎯 Dual Strategy System

This is the **CORE INNOVATION** of this system. For EVERY stock analyzed, you get TWO plans:

### Output Structure

```javascript
{
  // ═══════════════════════════════════════════
  // OVERVIEW
  // ═══════════════════════════════════════════
  stock: "RELIANCE",
  currentPrice: 2847.50,
  overallBias: "BULLISH",        // BULLISH | BEARISH | NEUTRAL
  confidence: "HIGH",             // HIGH | MEDIUM | LOW
  recommendation: "WAIT_FOR_BREAKOUT",
  
  // ═══════════════════════════════════════════
  // BULLISH SCENARIO (When price goes UP)
  // ═══════════════════════════════════════════
  bullishScenario: {
    probability: 65,              // % chance this happens
    score: 78,                    // Bullish strength /100
    trigger: "₹2,860 breakout",   // WHEN to execute this plan
    
    tradePlan: {
      action: "BUY",
      entry: [2855, 2865],        // Entry zone
      stopLoss: 2820,             // Exit if wrong
      targets: [
        { price: 2920, probability: 75 },  // Target 1
        { price: 2980, probability: 45 }   // Target 2
      ],
      riskReward: 1.67,
      potentialProfit: [175, 350] // Profit range
    },
    
    supportingFactors: [
      "Bullish flag pattern (82% confidence)",
      "Volume declining in consolidation",
      "RSI at 58 (room for upside)",
      "Positive news: Jio tariff hike"
    ],
    
    timeHorizon: "2-5 days"
  },
  
  // ═══════════════════════════════════════════
  // BEARISH SCENARIO (When price goes DOWN)
  // ═══════════════════════════════════════════
  bearishScenario: {
    probability: 35,              // % chance this happens
    score: 52,                    // Bearish strength /100
    trigger: "₹2,820 breakdown",  // WHEN to execute this plan
    
    tradePlan: {
      action: "SELL_OR_SHORT",
      entry: [2815, 2820],
      stopLoss: 2860,
      targets: [
        { price: 2780, probability: 60 },
        { price: 2750, probability: 35 }
      ],
      riskReward: 1.4,
      buybackZone: [2760, 2780],  // Re-entry for longs
      potentialProfit: [35, 95]
    },
    
    riskFactors: [
      "Support weak if breaks ₹2,820",
      "Overall market showing weakness",
      "Short-term overbought on 1H chart"
    ],
    
    timeHorizon: "1-3 days"
  }
}
```

### How to Use Dual Strategy

| Market Condition | Action |
|------------------|--------|
| Price breaks ₹2,860 UP | Execute **Bullish Plan** |
| Price breaks ₹2,820 DOWN | Execute **Bearish Plan** |
| Price stays in range | **WAIT** - Do not trade |

---

## � WHEN NOT TO TRADE (Accuracy Protection)

### Skip These Scenarios

| Scenario | Reason | Example |
|----------|--------|---------|
| Probability 45-55% | Coin flip | INFY: 52% bull, 48% bear |
| Low pattern confidence | < 70% | Triangle at 65% confidence |
| Conflicting signals | RSI bullish, MA bearish | Skip |
| Low volume | < 50% of average | Unreliable breakouts |
| Major news pending | Earnings tomorrow | Too unpredictable |
| Market closed | After 3:30 PM | Stale data |
| Gap up/down > 3% | Opening volatility | Wait 30 min |
| Both scenarios weak | Bull: 45, Bear: 42 | No clear edge |

### Red Flags Checklist

Before taking ANY trade, verify:
- [ ] Pattern confidence > 70%
- [ ] Probability > 60% in one direction
- [ ] Volume confirms the pattern
- [ ] News is not conflicting
- [ ] Support/Resistance tested 2+ times
- [ ] Risk/Reward > 1.5
- [ ] You understand the setup

---

## �📁 Folder Structure

```
trading-assistant/
│
├── 📁 app/                           # Next.js App Router
│   ├── page.jsx                      # Dashboard (morning screening)
│   ├── layout.jsx                    # Root layout
│   ├── globals.css                   # Global styles
│   │
│   ├── 📁 analyze/
│   │   └── page.jsx                  # Quick single stock analysis
│   │
│   ├── 📁 journal/
│   │   └── page.jsx                  # Trade journal & analytics
│   │
│   └── 📁 api/                       # API Routes
│       ├── 📁 analyze-stocks/
│       │   └── route.js              # Morning screening API
│       ├── 📁 analyze-single/
│       │   └── route.js              # Single stock analysis
│       ├── 📁 save-trade/
│       │   └── route.js              # Save trade entry
│       └── 📁 get-analytics/
│           └── route.js              # Get performance stats
│
├── 📁 lib/                           # Core business logic
│   ├── yahoo-finance.js              # Fetch OHLC data
│   ├── indicators.js                 # Calculate RSI, MA, S/R
│   ├── patterns.js                   # Pattern detection
│   ├── news-fetcher.js               # Google News RSS
│   ├── ai-provider.js                # Switchable AI interface
│   ├── gemini.js                     # Gemini implementation
│   ├── claude.js                     # Claude (future)
│   └── mongodb.js                    # DB connection
│
├── 📁 components/                    # React components
│   ├── StockCard.jsx                 # Display stock analysis
│   ├── DualScenario.jsx              # Show both scenarios
│   ├── TradeForm.jsx                 # Log trade form
│   ├── AnalyticsChart.jsx            # Performance charts
│   └── LoadingSpinner.jsx            # Loading states
│
├── 📁 models/                        # MongoDB schemas
│   ├── Watchlist.js
│   ├── Analysis.js
│   ├── Trade.js
│   └── Performance.js
│
├── 📁 utils/                         # Utility functions
│   ├── calculations.js               # Helper functions
│   └── constants.js                  # Watchlist, config
│
├── 📁 docs/                          # Documentation
│   ├── PROJECT_OVERVIEW.md           # This file
│   ├── API_REFERENCE.md              # API documentation
│   └── DEPLOYMENT.md                 # Deployment guide
│
├── .env.local                        # Environment variables
├── .env.example                      # Example env file
├── package.json
├── next.config.js
└── README.md
```

---

## 🗄️ Database Schema

### Collection: `watchlists`

```javascript
{
  _id: ObjectId,
  userId: String,                     // For future multi-user
  stocks: [
    "RELIANCE",
    "TCS",
    "INFY",
    "HDFCBANK",
    "ICICIBANK",
    "SBIN",
    "BHARTIARTL",
    "ITC",
    "KOTAKBANK",
    "LT"
  ],
  createdAt: Date,
  updatedAt: Date
}
```

### Collection: `analyses`

```javascript
{
  _id: ObjectId,
  date: "2026-02-06",                 // Analysis date
  stock: "RELIANCE",
  currentPrice: 2847.50,
  
  // Overall assessment
  overallBias: "BULLISH",             // BULLISH | BEARISH | NEUTRAL
  confidence: "HIGH",                 // HIGH | MEDIUM | LOW
  recommendation: "WAIT_FOR_BREAKOUT",
  
  // Technical indicators
  indicators: {
    rsi: 58,
    ma20: 2815,
    ma50: 2790,
    support: 2820,
    resistance: 2860,
    volumeTrend: "declining"
  },
  
  // Detected pattern
  pattern: {
    name: "bullish_flag",
    confidence: 82,
    description: "Flag consolidation after uptrend"
  },
  
  // News headlines
  news: [
    {
      title: "Reliance Jio announces tariff hike",
      source: "Economic Times",
      date: "2026-02-05",
      sentiment: "positive"
    }
  ],
  
  // Dual scenarios (full structure)
  bullishScenario: { /* ... */ },
  bearishScenario: { /* ... */ },
  
  createdAt: Date
}
```

### Collection: `trades`

```javascript
{
  _id: ObjectId,
  
  // Trade details
  stock: "RELIANCE",
  direction: "LONG",                  // LONG | SHORT
  quantity: 3,
  
  // Entry
  entryDate: Date,
  entryPrice: 2860,
  entryReason: "Breakout above resistance",
  
  // Exit
  exitDate: Date,
  exitPrice: 2920,
  exitReason: "Target 1 hit",
  
  // P&L
  profitLoss: 180,                    // In rupees
  profitLossPercent: 2.1,
  
  // Analysis reference
  analysisId: ObjectId,               // Link to analysis
  pattern: "bullish_flag",
  aiScore: 78,
  scenario: "bullish",                // Which scenario was executed
  
  // Learning
  wasPatternAccurate: true,
  notes: "Pattern worked perfectly",
  lessonsLearned: "Wait for volume confirmation",
  
  createdAt: Date
}
```

### Collection: `performance`

```javascript
{
  _id: ObjectId,
  
  // Overall stats
  totalTrades: 25,
  wins: 15,
  losses: 10,
  winRate: 60,
  
  // P&L metrics
  totalProfitLoss: 4250,
  avgWin: 320,
  avgLoss: 180,
  profitFactor: 1.78,
  largestWin: 650,
  largestLoss: 350,
  
  // Pattern performance
  patternStats: {
    "bullish_flag": { trades: 8, winRate: 75, avgReturn: 2.5 },
    "triangle_breakout": { trades: 5, winRate: 60, avgReturn: 1.8 },
    "support_bounce": { trades: 7, winRate: 57, avgReturn: 1.5 }
  },
  
  // Stock performance
  stockStats: {
    "RELIANCE": { trades: 5, winRate: 80, totalPnL: 1200 },
    "TCS": { trades: 4, winRate: 50, totalPnL: 350 }
  },
  
  // Time-based
  weeklyPnL: [
    { week: "2026-W05", pnl: 850 },
    { week: "2026-W06", pnl: 1200 }
  ],
  
  updatedAt: Date
}
```

---

## 🔄 Data Flow

### Morning Screening Flow

```
┌──────────────────────────────────────────────────────────────┐
│  1. TRIGGER (9:00 AM or Manual)                              │
└────────────────────────┬─────────────────────────────────────┘
                         ▼
┌──────────────────────────────────────────────────────────────┐
│  2. GET /api/analyze-stocks                                  │
└────────────────────────┬─────────────────────────────────────┘
                         ▼
┌──────────────────────────────────────────────────────────────┐
│  3. Fetch Watchlist from MongoDB                             │
│     → ["RELIANCE", "TCS", "INFY", ...]                       │
└────────────────────────┬─────────────────────────────────────┘
                         ▼
┌──────────────────────────────────────────────────────────────┐
│  4. FOR EACH STOCK (parallel processing):                    │
│                                                              │
│     ┌─────────────────┐  ┌─────────────────┐                │
│     │ Yahoo Finance   │  │ Google News     │                │
│     │ (30 days OHLC)  │  │ (3 days news)   │                │
│     └────────┬────────┘  └────────┬────────┘                │
│              │                    │                          │
│              ▼                    ▼                          │
│     ┌─────────────────────────────────────┐                 │
│     │ Calculate Indicators                 │                 │
│     │ RSI, MA20, MA50, Support/Resistance │                 │
│     └────────────────┬────────────────────┘                 │
│                      ▼                                       │
│     ┌─────────────────────────────────────┐                 │
│     │ Detect Patterns                      │                 │
│     │ Flags, Triangles, Breakouts         │                 │
│     └────────────────┬────────────────────┘                 │
│                      ▼                                       │
│     ┌─────────────────────────────────────┐                 │
│     │ Compiled Stock Data Object          │                 │
│     └─────────────────────────────────────┘                 │
└────────────────────────┬─────────────────────────────────────┘
                         ▼
┌──────────────────────────────────────────────────────────────┐
│  5. Send ALL stocks to Gemini AI                             │
│                                                              │
│     Prompt: "Analyze these 10 stocks with dual strategy.     │
│              For each stock, provide bullish and bearish     │
│              scenarios with trade plans..."                  │
└────────────────────────┬─────────────────────────────────────┘
                         ▼
┌──────────────────────────────────────────────────────────────┐
│  6. AI Returns Dual Scenarios for All Stocks                 │
└────────────────────────┬─────────────────────────────────────┘
                         ▼
┌──────────────────────────────────────────────────────────────┐
│  7. Save to MongoDB (analyses collection)                    │
└────────────────────────┬─────────────────────────────────────┘
                         ▼
┌──────────────────────────────────────────────────────────────┐
│  8. Return to Frontend                                       │
│                                                              │
│     {                                                        │
│       strongSetups: [...],    // 3-4 stocks                  │
│       avoid: [...],           // 2-3 stocks                  │
│       neutral: [...]          // 3-4 stocks                  │
│     }                                                        │
└────────────────────────┬─────────────────────────────────────┘
                         ▼
┌──────────────────────────────────────────────────────────────┐
│  9. Dashboard Displays Ranked Stock Cards                    │
└──────────────────────────────────────────────────────────────┘
```

### Single Stock Analysis Flow

```
User enters "RELIANCE"
        │
        ▼
POST /api/analyze-single { symbol: "RELIANCE" }
        │
        ▼
┌───────────────────────────────────┐
│ Parallel Data Fetch:              │
│ • Yahoo Finance (real-time)       │
│ • Google News (24 hours)          │
└───────────────┬───────────────────┘
                │
                ▼
┌───────────────────────────────────┐
│ Calculate Indicators + Patterns   │
└───────────────┬───────────────────┘
                │
                ▼
┌───────────────────────────────────┐
│ Send to Gemini AI                 │
│ (Detailed dual analysis)          │
└───────────────┬───────────────────┘
                │
                ▼
┌───────────────────────────────────┐
│ Return Dual Scenario Response     │
│ (~30-45 seconds total)            │
└───────────────┬───────────────────┘
                │
                ▼
Frontend displays side-by-side scenarios
```

---

## 🔌 API Endpoints

### 1. Morning Screening

```
GET /api/analyze-stocks

Response:
{
  success: true,
  date: "2026-02-06",
  analyzedAt: "2026-02-06T09:15:30Z",
  stocks: {
    strongSetups: [
      { stock: "RELIANCE", bias: "BULLISH", confidence: "HIGH", ... },
      { stock: "TCS", bias: "BULLISH", confidence: "MEDIUM", ... }
    ],
    avoid: [
      { stock: "SBIN", bias: "BEARISH", confidence: "HIGH", reason: "..." }
    ],
    neutral: [
      { stock: "INFY", bias: "NEUTRAL", confidence: "LOW", ... }
    ]
  }
}
```

### 2. Single Stock Analysis

```
POST /api/analyze-single
Body: { symbol: "RELIANCE" }

Response:
{
  success: true,
  stock: "RELIANCE",
  currentPrice: 2847.50,
  overallBias: "BULLISH",
  confidence: "HIGH",
  bullishScenario: { ... },
  bearishScenario: { ... },
  recommendation: "Wait for ₹2,860 breakout"
}
```

### 3. Save Trade

```
POST /api/save-trade
Body: {
  stock: "RELIANCE",
  direction: "LONG",
  quantity: 3,
  entryPrice: 2860,
  entryDate: "2026-02-06",
  exitPrice: 2920,
  exitDate: "2026-02-07",
  pattern: "bullish_flag",
  scenario: "bullish",
  notes: "Pattern worked as expected"
}

Response:
{
  success: true,
  tradeId: "...",
  profitLoss: 180
}
```

### 4. Get Analytics

```
GET /api/get-analytics

Response:
{
  success: true,
  performance: {
    totalTrades: 25,
    winRate: 60,
    totalProfitLoss: 4250,
    avgWin: 320,
    avgLoss: 180,
    profitFactor: 1.78,
    patternStats: { ... },
    stockStats: { ... }
  }
}
```

---

## 🎨 UI Pages

### 1. Dashboard (`app/page.jsx`)

```
┌─────────────────────────────────────────────────────────────────┐
│  📊 AI Trading Assistant                    Feb 6, 2026  9:15 AM│
│                                                    [↻ Refresh]  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ✅ STRONG SETUPS (Trade These)                                 │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐               │
│  │ RELIANCE    │ │ TCS         │ │ BHARTIARTL  │               │
│  │ ₹2,847.50   │ │ ₹4,125.00   │ │ ₹1,580.25   │               │
│  │             │ │             │ │             │               │
│  │ 🟢 65% Bull │ │ 🟢 72% Bull │ │ 🔴 58% Bear │               │
│  │ 🔴 35% Bear │ │ 🔴 28% Bear │ │ 🟢 42% Bull │               │
│  │             │ │             │ │             │               │
│  │ [Details]   │ │ [Details]   │ │ [Details]   │               │
│  └─────────────┘ └─────────────┘ └─────────────┘               │
│                                                                 │
│  ⚠️ AVOID TODAY (High Risk)                                     │
│  ┌─────────────┐ ┌─────────────┐                               │
│  │ SBIN        │ │ KOTAKBANK   │                               │
│  │ Uncertain   │ │ Mixed sigs  │                               │
│  └─────────────┘ └─────────────┘                               │
│                                                                 │
│  ⏳ NEUTRAL (Wait for Clarity)                                  │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐               │
│  │ INFY        │ │ HDFCBANK    │ │ ITC         │               │
│  └─────────────┘ └─────────────┘ └─────────────┘               │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 2. Analyze Page (`app/analyze/page.jsx`)

```
┌─────────────────────────────────────────────────────────────────┐
│  🔍 Quick Stock Analysis                                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌────────────────────────────────┐                            │
│  │ Enter stock symbol...  RELIANCE│  [🔍 Analyze]              │
│  └────────────────────────────────┘                            │
│                                                                 │
│  ═══════════════════════════════════════════════════════════   │
│  RELIANCE - ₹2,847.50                      Overall: 🟢 BULLISH │
│  ═══════════════════════════════════════════════════════════   │
│                                                                 │
│  ┌─────────────────────────┐  ┌─────────────────────────┐      │
│  │  🟢 BULLISH SCENARIO    │  │  🔴 BEARISH SCENARIO    │      │
│  │     65% Probability     │  │     35% Probability     │      │
│  ├─────────────────────────┤  ├─────────────────────────┤      │
│  │                         │  │                         │      │
│  │  Trigger: ₹2,860 break  │  │  Trigger: ₹2,820 break  │      │
│  │                         │  │                         │      │
│  │  Action: BUY            │  │  Action: SELL/SHORT     │      │
│  │  Entry: ₹2,855-2,865    │  │  Entry: ₹2,815-2,820    │      │
│  │  Stop Loss: ₹2,820      │  │  Stop Loss: ₹2,860      │      │
│  │  Target 1: ₹2,920 (75%) │  │  Target 1: ₹2,780 (60%) │      │
│  │  Target 2: ₹2,980 (45%) │  │  Target 2: ₹2,750 (35%) │      │
│  │                         │  │                         │      │
│  │  Risk:Reward = 1:1.67   │  │  Risk:Reward = 1:1.4    │      │
│  │                         │  │                         │      │
│  │  ✓ Bullish flag 82%     │  │  ⚠ Weak if breaks 2820  │      │
│  │  ✓ Volume declining     │  │  ⚠ Market weakness      │      │
│  │  ✓ RSI 58 (room up)     │  │  ⚠ Overbought 1H        │      │
│  │  ✓ Positive news        │  │                         │      │
│  │                         │  │                         │      │
│  │  Time: 2-5 days         │  │  Time: 1-3 days         │      │
│  │                         │  │                         │      │
│  └─────────────────────────┘  └─────────────────────────┘      │
│                                                                 │
│  📝 RECOMMENDATION: Wait for ₹2,860 breakout, then BUY         │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 3. Journal Page (`app/journal/page.jsx`)

```
┌─────────────────────────────────────────────────────────────────┐
│  📓 Trade Journal                                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │  📊 Performance Summary                                    │ │
│  │                                                           │ │
│  │  Total Trades: 25    Win Rate: 60%    Total P&L: +₹4,250 │ │
│  │  Wins: 15            Losses: 10       Profit Factor: 1.78│ │
│  │  Avg Win: ₹320       Avg Loss: ₹180   Best: bullish_flag │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │  ➕ Log New Trade                                         │ │
│  │                                                           │ │
│  │  Stock: [RELIANCE  ▼]    Direction: [LONG ▼]             │ │
│  │  Quantity: [3     ]      Entry Price: [₹2,860]           │ │
│  │  Exit Price: [₹2,920]    Pattern: [bullish_flag ▼]       │ │
│  │  Notes: [Pattern worked perfectly________________]        │ │
│  │                                                           │ │
│  │                                        [💾 Save Trade]    │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │  📜 Trade History                                         │ │
│  ├───────┬────────┬───────┬───────┬────────┬────────────────┤ │
│  │ Date  │ Stock  │ Entry │ Exit  │ P&L    │ Pattern        │ │
│  ├───────┼────────┼───────┼───────┼────────┼────────────────┤ │
│  │ Feb 6 │RELIANCE│ 2,860 │ 2,920 │ +₹180  │ bullish_flag ✓ │ │
│  │ Feb 5 │ TCS    │ 4,100 │ 4,050 │ -₹150  │ triangle    ✗  │ │
│  │ Feb 4 │ INFY   │ 1,850 │ 1,895 │ +₹135  │ breakout    ✓  │ │
│  └───────┴────────┴───────┴───────┴────────┴────────────────┘ │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## � MULTIPLE TIMEFRAME ANALYSIS (Higher Accuracy)

### Why Multiple Timeframes Matter

Single timeframe = 60% accuracy  
Multiple timeframes = 75%+ accuracy

### Implementation

For each stock, analyze:

| Timeframe | Purpose | Weight |
|-----------|---------|--------|
| **1 Day (1D)** | Entry/exit timing | 40% |
| **1 Week (1W)** | Trend confirmation | 35% |
| **1 Month (1M)** | Overall context | 25% |

### Example Multi-Timeframe Analysis

```javascript
RELIANCE Multi-Timeframe:

1D (Daily):
- Pattern: Bullish flag (82% confidence)
- Trigger: ₹2,860
- Bias: BULLISH

1W (Weekly):
- Trend: Uptrend for 3 weeks
- Holding above weekly MA
- Bias: BULLISH ✅ Confirms 1D

1M (Monthly):
- Long-term uptrend
- No major resistance nearby
- Bias: BULLISH ✅ Confirms 1W

VERDICT: HIGH CONFIDENCE (all timeframes align)
```

### Conflicting Timeframes

```javascript
TATAMOTORS Multi-Timeframe:

1D: Bullish breakout (70% confidence)
1W: Bearish trend, facing resistance
1M: Downtrend for 2 months

VERDICT: CONFLICTING → SKIP TRADE
(1D bullish but 1W & 1M bearish = high risk)
```

**Update AI prompt to request multi-timeframe analysis!**

---

## 📊 ACCURACY VALIDATION (Backtesting)

### How to Backtest (Week 3-4)

**Goal:** Verify AI predictions match reality BEFORE real money

**Process:**
1. **Save AI predictions** (morning screening)
2. **Track actual outcomes** (did it hit targets?)
3. **Calculate accuracy** (were probabilities correct?)
4. **Identify patterns** (which setups work best?)

### Backtesting Metrics

After 30 predictions, measure:

| Metric | How to Calculate | Target |
|--------|------------------|--------|
| **Pattern Accuracy** | Patterns that worked / Total patterns | > 70% |
| **Probability Calibration** | Actual wins when AI said 70% / Total 70% predictions | 65-75% |
| **Target Achievement** | Trades hitting Target 1 / Total trades | > 60% |
| **False Signals** | Trades stopping out / Total trades | < 35% |
| **Direction Accuracy** | Correct bias / Total predictions | > 65% |

### Example Backtest Log

```javascript
{
  date: "2026-02-06",
  stock: "RELIANCE",
  
  // AI Prediction
  aiPrediction: {
    bias: "BULLISH",
    bullishProb: 65,
    target1: 2920,
    trigger: 2860
  },
  
  // Actual Outcome (tracked next day)
  actualOutcome: {
    didTrigger: true,
    triggeredAt: 2862,
    highAfterTrigger: 2935,
    hitTarget1: true,
    result: "WIN"
  },
  
  // Accuracy Assessment
  accurate: true,
  notes: "Pattern worked perfectly"
}
```

### Calibration Adjustment

If after 30 trades you see:
- AI says 70% bullish → Only wins 50% → **Reduce confidence**
- AI says 60% bullish → Wins 75% → **Increase confidence**
- Pattern X: 80% confidence → Only 50% success → **Lower that pattern's weight**

**This feedback loop improves accuracy over time!**

---

## �📅 Implementation Roadmap

### Week 1: Foundation

| Day | Tasks | Deliverables |
|-----|-------|--------------|
| **Day 1-2** | Project Setup | ✅ Next.js project created |
| | | ✅ Folder structure ready |
| | | ✅ Dependencies installed |
| | | ✅ MongoDB connected |
| | | ✅ Git initialized |
| **Day 3-4** | Data Fetching | ✅ Yahoo Finance integration |
| | | ✅ RELIANCE data fetched |
| | | ✅ Multiple stocks working |
| | | ✅ Error handling added |
| **Day 5-6** | Technical Analysis | ✅ RSI calculation |
| | | ✅ Moving averages |
| | | ✅ Support/Resistance |
| | | ✅ Basic patterns |
| **Day 7** | News Integration | ✅ Google News RSS |
| | | ✅ Headlines parsed |
| | | ✅ Tested with RELIANCE |

### Week 2: AI & UI

| Day | Tasks | Deliverables |
|-----|-------|--------------|
| **Day 8-9** | AI Integration | ✅ Gemini API setup |
| | | ✅ Dual strategy prompt |
| | | ✅ Sample data tested |
| | | ✅ AI provider switchable |
| **Day 10-11** | Dashboard UI | ✅ Dashboard page |
| | | ✅ StockCard component |
| | | ✅ DualScenario component |
| | | ✅ Basic styling |
| **Day 12-13** | Analyze Page | ✅ Search functionality |
| | | ✅ Single stock analysis |
| | | ✅ Dual scenarios display |
| | | ✅ Recommendations shown |
| **Day 14** | Polish | ✅ Trade journal basic |
| | | ✅ Error handling |
| | | ✅ Loading states |
| | | ✅ Mobile responsive |

### Week 3-4: Testing

| Task | Target |
|------|--------|
| Paper trade daily | 20-30 trades |
| Refine AI prompts | Improve accuracy |
| UI improvements | Based on usage |
| Bug fixes | Zero crashes |
| Performance optimization | < 2 min analysis |

### Month 2: Real Trading

| Milestone | Target |
|-----------|--------|
| Start with ₹15k | Week 1 |
| 2-3 trades per week | Weeks 1-4 |
| 100% trade logging | Every trade |
| Monthly review | End of month |
| Profit target | ₹3,000+ |

---

## ✅ Success Criteria

### 🎯 ACCURACY METRICS (Primary Focus)

> **Accuracy is our #1 priority. Every metric below serves this goal.**

| Metric | Target | Status |
|--------|--------|--------|
| **Pattern Recognition Accuracy** | > 70% | ⏳ |
| **Support/Resistance Accuracy** | > 75% | ⏳ |
| **Trend Direction Accuracy** | > 65% | ⏳ |
| **News Sentiment Accuracy** | > 80% | ⏳ |
| **Overall Prediction Accuracy** | > 60% | ⏳ |

### Technical Metrics

| Metric | Target | Status |
|--------|--------|--------|
| Morning analysis time | < 2 minutes | ⏳ |
| Single analysis time | < 45 seconds | ⏳ |
| Zero crashes | 100% uptime | ⏳ |
| Mobile responsive | Works on phone | ⏳ |
| Data accuracy | 99%+ | ⏳ |

### Trading Metrics

| Metric | Target | Status |
|--------|--------|--------|
| Win rate | > 55% | ⏳ |
| Profit factor | > 1.5 | ⏳ |
| Profit potential | Unlimited (₹1k - ₹10k+) | ⏳ |
| Max drawdown | < 15% | ⏳ |
| Max risk per trade | ₹500 | ⏳ |

### Personal Metrics

| Metric | Target | Status |
|--------|--------|--------|
| Accurate trading suggestions | Consistently reliable | ⏳ |
| Helps decision-making | Yes | ⏳ |
| Saves time | 4+ hours/day | ⏳ |
| Reduces stress | Significantly | ⏳ |

---

## ⚙️ Environment Setup

### Required Environment Variables

```bash
# .env.local

# ═══════════════════════════════════════════════════════════════
# DATABASE
# ═══════════════════════════════════════════════════════════════
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/trading

# ═══════════════════════════════════════════════════════════════
# AI PROVIDER (Switch anytime between 'gemini' or 'claude')
# ═══════════════════════════════════════════════════════════════
AI_PROVIDER=gemini
GEMINI_API_KEY=your_gemini_api_key_here
ANTHROPIC_API_KEY=your_claude_api_key_here  # For future use

# ═══════════════════════════════════════════════════════════════
# APP CONFIG
# ═══════════════════════════════════════════════════════════════
NODE_ENV=development
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### Quick Start

```bash
# 1. Create project
npx create-next-app@latest trading-assistant
cd trading-assistant

# 2. Install dependencies
npm install mongoose axios cheerio

# 3. Setup environment
# Copy .env.example to .env.local and fill in values

# 4. Run development server
npm run dev

# 5. Open browser
# http://localhost:3000
```

---

## 🔑 Key Principles

| Principle | Description |
|-----------|-------------|
| **Start Simple** | Basic version first, add features later |
| **Free First** | Use all free tiers for testing |
| **Dual Strategy** | Always analyze BOTH directions |
| **Skip Unclear** | If 50-50 probability, don't trade |
| **Journal Everything** | Track every single trade |
| **Risk Management** | Max ₹500 risk per trade |
| **Be Patient** | Wait for clear triggers |
| **Learn & Adapt** | Refine based on results |

---

## 📞 Support & Resources

### Documentation
- [Next.js Docs](https://nextjs.org/docs)
- [MongoDB Atlas](https://www.mongodb.com/atlas)
- [Gemini API](https://ai.google.dev/)
- [Yahoo Finance](https://finance.yahoo.com/)

### Troubleshooting
- Check `.env.local` values
- Verify MongoDB connection
- Test API keys individually
- Check console for errors

---

*Document created: February 6, 2026*  
*Last updated: February 6, 2026*  
*Version: 1.0.0*
