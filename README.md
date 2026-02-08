# 📈 Stock Assist - AI Trading Assistant

> **Industry-Grade Monorepo** for AI-powered stock analysis with **70%+ Win Rate** target

## 🎯 Core Focus: ACCURACY

The #1 priority is **ACCURACY**. Every component is designed for precise trading suggestions.

| Metric | Target |
|--------|--------|
| **Win Rate** | > 70% |
| **Profit Potential** | ₹1,000 - ₹10,000+ per trade |
| **Max Risk** | ₹500 per trade |
| **Profit Factor** | > 1.5 |

## 🏗️ Monorepo Structure

```
Stock-Assist/
├── apps/
│   ├── api/          # Express Backend (Port 4000)
│   └── web/          # Next.js Frontend (Port 3000)
├── packages/
│   └── shared/       # Shared types, constants, utilities
├── docs/             # Documentation
└── package.json      # Root workspace config
```

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- MongoDB Atlas (free tier)
- Gemini API Key (free tier)

### 1. Install Dependencies
```bash
npm install
```

### 2. Setup Environment
```bash
cp .env.example apps/api/.env
# Edit apps/api/.env with your MongoDB URI and Gemini API Key
```

### 3. Run Development
```bash
npm run dev
```
This runs **both frontend and backend concurrently**:
- Frontend: http://localhost:3000
- Backend API: http://localhost:4000

## 📦 Workspaces

| Package | Description |
|---------|-------------|
| `@stock-assist/web` | Next.js 14 frontend |
| `@stock-assist/api` | Express backend |
| `@stock-assist/shared` | Shared types & utilities |

## 🔧 Scripts

```bash
npm run dev          # Run both frontend & backend
npm run dev:api      # Run only API
npm run dev:web      # Run only frontend
npm run build        # Build all packages
npm run lint         # Lint all packages
npm run clean        # Clean node_modules
```

## 📁 Code Quality

- **Max 150 lines per file** - Easy readability
- **TypeScript** - Type safety
- **Modular design** - Small, focused modules
- **Shared package** - DRY principles

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14, React, Tailwind |
| Backend | Express, TypeScript |
| Database | MongoDB Atlas (Free) |
| AI | Google Gemini (Free) |
| Data | Yahoo Finance (Free) |

## 📊 Features

- ✅ Morning stock screening
- ✅ Dual-strategy analysis (Bullish + Bearish)
- ✅ AI-powered recommendations
- ✅ Technical indicators (RSI, MACD, MA)
- ✅ Pattern detection
- ✅ News sentiment analysis
- ✅ Trade journal
- ✅ Performance analytics

## 📖 API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/analyze/stocks` | GET | Morning screening |
| `/api/analyze/single` | POST | Single stock analysis |
| `/api/trade` | GET/POST/PUT/DELETE | Trade CRUD |
| `/api/watchlist` | GET/POST/DELETE | Watchlist management |
| `/api/analytics` | GET | Performance stats |

## 🎯 Win Rate Strategy

To achieve **70%+ win rate**:
1. Higher pattern confidence threshold (70%)
2. Dual-strategy analysis (prepare for both scenarios)
3. Conservative risk management (₹500 max)
4. AI-enhanced decision making
5. Pattern performance tracking

---

**Made with ❤️ for consistent trading profits**
