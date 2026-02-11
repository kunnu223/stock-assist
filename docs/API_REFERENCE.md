# 📡 API Reference

> Complete API documentation for AI Trading Assistant

---

## Base URL

```
Development: http://localhost:3000/api
Production: https://your-domain.vercel.app/api
```

---

## Endpoints Overview

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/analyze-stocks` | GET | Morning screening (all watchlist stocks) |
| `/api/analyze-single` | POST | Single stock analysis |
| `/api/save-trade` | POST | Log a trade to journal |
| `/api/get-analytics` | GET | Get performance statistics |
| `/api/watchlist` | GET/POST/DELETE | Manage watchlist |
| `/api/stocks/top-10` | GET | Get top 10 screened stocks |

---

## 1. Morning Screening

### `GET /api/analyze-stocks`

Analyzes all stocks in your watchlist with dual strategy.

**Request:**
```bash
GET /api/analyze-stocks
```

**Response:**
```json
{
  "success": true,
  "date": "2026-02-06",
  "analyzedAt": "2026-02-06T09:15:30.000Z",
  "processingTime": "95 seconds",
  "totalStocks": 10,
  "stocks": {
    "strongSetups": [
      {
        "stock": "RELIANCE",
        "currentPrice": 2847.50,
        "overallBias": "BULLISH",
        "confidence": "HIGH",
        "bullishProbability": 65,
        "bearishProbability": 35,
        "recommendation": "Wait for ₹2,860 breakout",
        "pattern": {
          "name": "bullish_flag",
          "confidence": 82
        },
        "bullishScenario": {
          "trigger": "₹2,860 breakout",
          "entry": [2855, 2865],
          "stopLoss": 2820,
          "targets": [
            { "price": 2920, "probability": 75 },
            { "price": 2980, "probability": 45 }
          ],
          "riskReward": 1.67
        },
        "bearishScenario": {
          "trigger": "₹2,820 breakdown",
          "entry": [2815, 2820],
          "stopLoss": 2860,
          "targets": [
            { "price": 2780, "probability": 60 },
            { "price": 2750, "probability": 35 }
          ],
          "riskReward": 1.4
        }
      }
    ],
    "avoid": [
      {
        "stock": "SBIN",
        "currentPrice": 825.30,
        "overallBias": "NEUTRAL",
        "confidence": "LOW",
        "reason": "Mixed signals, no clear direction",
        "riskFactors": [
          "Support and resistance too close",
          "Conflicting news sentiment",
          "Low volume"
        ]
      }
    ],
    "neutral": [
      {
        "stock": "INFY",
        "currentPrice": 1850.25,
        "overallBias": "NEUTRAL",
        "confidence": "MEDIUM",
        "recommendation": "Wait for breakout above ₹1,875"
      }
    ]
  }
}
```

**Error Response:**
```json
{
  "success": false,
  "error": "Failed to fetch market data",
  "code": "YAHOO_FINANCE_ERROR"
}
```

---

## 2. Single Stock Analysis

### `POST /api/analyze-single`

Analyzes a single stock with detailed dual strategy.

**Request:**
```bash
POST /api/analyze-single
Content-Type: application/json

{
  "symbol": "RELIANCE"
}
```

**Response:**
```json
{
  "success": true,
  "analyzedAt": "2026-02-06T14:30:45.000Z",
  "processingTime": "32 seconds",
  
  "stock": "RELIANCE",
  "currentPrice": 2847.50,
  "previousClose": 2835.00,
  "change": 12.50,
  "changePercent": 0.44,
  
  "overallBias": "BULLISH",
  "confidence": "HIGH",
  "recommendation": "Wait for ₹2,860 breakout, then BUY",
  
  "indicators": {
    "rsi": 58,
    "rsiInterpretation": "Neutral with bullish bias",
    "ma20": 2815,
    "ma50": 2790,
    "maTrend": "Bullish (price above both MAs)",
    "support": 2820,
    "resistance": 2860,
    "volumeTrend": "Declining (consolidation)",
    "volumeAvg": 4200000
  },
  
  "pattern": {
    "name": "bullish_flag",
    "confidence": 82,
    "description": "Flag consolidation after strong uptrend. Typically resolves upward with 68% historical accuracy.",
    "expectedMove": "Breakout above ₹2,860 targets ₹2,920-2,980"
  },
  
  "news": [
    {
      "title": "Reliance Jio announces 15% tariff hike",
      "source": "Economic Times",
      "date": "2026-02-05",
      "sentiment": "positive",
      "impact": "Revenue boost expected"
    },
    {
      "title": "Reliance Retail expansion plans",
      "source": "Moneycontrol",
      "date": "2026-02-04",
      "sentiment": "positive",
      "impact": "Long-term growth catalyst"
    }
  ],
  
  "bullishScenario": {
    "probability": 65,
    "score": 78,
    "trigger": "Price breaks above ₹2,860 with volume",
    
    "tradePlan": {
      "action": "BUY",
      "entry": [2855, 2865],
      "stopLoss": 2820,
      "stopLossPercent": 1.4,
      "targets": [
        { "price": 2920, "probability": 75, "profit": "₹55-65/share" },
        { "price": 2980, "probability": 45, "profit": "₹115-125/share" }
      ],
      "riskReward": 1.67,
      "positionSize": "3 shares (₹500 max risk)",
      "potentialProfit": [165, 375]
    },
    
    "supportingFactors": [
      "Bullish flag pattern with 82% confidence",
      "Volume declining during consolidation (healthy)",
      "RSI at 58 - room for upside before overbought",
      "Positive news flow (Jio tariff hike)",
      "Price above 20 & 50 day MAs",
      "Overall market (Nifty) in uptrend"
    ],
    
    "timeHorizon": "2-5 trading days",
    "bestEntry": "First 15 min after ₹2,860 breakout with volume confirmation"
  },
  
  "bearishScenario": {
    "probability": 35,
    "score": 52,
    "trigger": "Price breaks below ₹2,820 support",
    
    "tradePlan": {
      "action": "SELL_IF_HOLDING / SHORT",
      "entry": [2815, 2820],
      "stopLoss": 2860,
      "stopLossPercent": 1.9,
      "targets": [
        { "price": 2780, "probability": 60, "profit": "₹35-40/share" },
        { "price": 2750, "probability": 35, "profit": "₹65-70/share" }
      ],
      "riskReward": 1.4,
      "buybackZone": [2760, 2780],
      "potentialProfit": [105, 210]
    },
    
    "riskFactors": [
      "Support at ₹2,820 has been tested 3 times",
      "If breaks, next support at ₹2,780",
      "Market-wide selloff could trigger breakdown",
      "Short-term overbought on 1H chart"
    ],
    
    "timeHorizon": "1-3 trading days",
    "warningSign": "Closing below ₹2,820 on high volume"
  },
  
  "marketContext": {
    "niftyTrend": "Bullish",
    "niftyLevel": 22450,
    "sectorTrend": "Oil & Gas - Neutral to Bullish",
    "fiiActivity": "Net buyers last 3 days",
    "overallSentiment": "Cautiously optimistic"
  }
}
```

---

## 3. Save Trade

### `POST /api/save-trade`

Logs a completed trade to your journal.

**Request:**
```bash
POST /api/save-trade
Content-Type: application/json

{
  "stock": "RELIANCE",
  "direction": "LONG",
  "quantity": 3,
  "entryPrice": 2860,
  "entryDate": "2026-02-06",
  "entryTime": "09:45",
  "exitPrice": 2920,
  "exitDate": "2026-02-07",
  "exitTime": "14:30",
  "pattern": "bullish_flag",
  "scenario": "bullish",
  "aiScore": 78,
  "analysisId": "65a1b2c3d4e5f6789",
  "entryReason": "Breakout above ₹2,860 with volume",
  "exitReason": "Target 1 hit",
  "notes": "Pattern worked exactly as predicted. Held overnight.",
  "lessonsLearned": "Wait for volume confirmation on breakout"
}
```

**Response:**
```json
{
  "success": true,
  "tradeId": "65b2c3d4e5f67890",
  "trade": {
    "stock": "RELIANCE",
    "direction": "LONG",
    "quantity": 3,
    "entryPrice": 2860,
    "exitPrice": 2920,
    "profitLoss": 180,
    "profitLossPercent": 2.1,
    "holdingPeriod": "1 day",
    "wasPatternAccurate": true
  },
  "updatedPerformance": {
    "totalTrades": 26,
    "winRate": 61.5,
    "totalProfitLoss": 4430
  }
}
```

---

## 4. Get Analytics

### `GET /api/get-analytics`

Retrieves your trading performance statistics.

**Request:**
```bash
GET /api/get-analytics
GET /api/get-analytics?period=month    # Filter by period
GET /api/get-analytics?period=week
GET /api/get-analytics?period=all
```

**Response:**
```json
{
  "success": true,
  "period": "all",
  "performance": {
    "totalTrades": 25,
    "wins": 15,
    "losses": 10,
    "winRate": 60,
    
    "totalProfitLoss": 4250,
    "avgWin": 320,
    "avgLoss": 180,
    "profitFactor": 1.78,
    "expectancy": 170,
    
    "largestWin": 650,
    "largestLoss": 350,
    "maxConsecutiveWins": 4,
    "maxConsecutiveLosses": 2,
    
    "avgHoldingPeriod": "1.5 days",
    "bestDay": "Tuesday",
    "worstDay": "Monday"
  },
  
  "patternStats": {
    "bullish_flag": {
      "trades": 8,
      "wins": 6,
      "winRate": 75,
      "avgReturn": 2.5,
      "totalPnL": 1850,
      "recommendation": "HIGH confidence - continue trading"
    },
    "triangle_breakout": {
      "trades": 5,
      "wins": 3,
      "winRate": 60,
      "avgReturn": 1.8,
      "totalPnL": 780,
      "recommendation": "MEDIUM confidence - be selective"
    },
    "support_bounce": {
      "trades": 7,
      "wins": 4,
      "winRate": 57,
      "avgReturn": 1.5,
      "totalPnL": 920,
      "recommendation": "MEDIUM confidence - use tight stops"
    },
    "resistance_rejection": {
      "trades": 3,
      "wins": 1,
      "winRate": 33,
      "avgReturn": -0.8,
      "totalPnL": -300,
      "recommendation": "LOW confidence - AVOID this pattern"
    }
  },
  
  "stockStats": {
    "RELIANCE": {
      "trades": 5,
      "winRate": 80,
      "totalPnL": 1200,
      "avgReturn": 2.8,
      "recommendation": "Your BEST stock - prioritize"
    },
    "TCS": {
      "trades": 4,
      "winRate": 50,
      "totalPnL": 350,
      "avgReturn": 1.2,
      "recommendation": "Average performance"
    },
    "SBIN": {
      "trades": 4,
      "winRate": 25,
      "totalPnL": -450,
      "avgReturn": -1.5,
      "recommendation": "AVOID - losing money here"
    }
  },
  
  "scenarioStats": {
    "bullish": {
      "trades": 18,
      "winRate": 67,
      "totalPnL": 3800,
      "recommendation": "Bullish setups working well"
    },
    "bearish": {
      "trades": 7,
      "winRate": 43,
      "totalPnL": 450,
      "recommendation": "Be more selective with bearish trades"
    }
  },
  
  "weeklyPnL": [
    { "week": "2026-W03", "pnl": 650, "trades": 4 },
    { "week": "2026-W04", "pnl": 850, "trades": 5 },
    { "week": "2026-W05", "pnl": 1200, "trades": 6 },
    { "week": "2026-W06", "pnl": 1550, "trades": 7 }
  ],
  
  "insights": [
    "🏆 Your best pattern is bullish_flag (75% win rate)",
    "⚠️ Avoid resistance_rejection pattern (33% win rate)",
    "📈 RELIANCE is your most profitable stock",
    "📉 Consider removing SBIN from watchlist",
    "💡 Bullish scenarios outperform bearish (67% vs 43%)"
  ]
}
```

---

## 5. Watchlist Management

### `GET /api/watchlist`

Get current watchlist.

**Response:**
```json
{
  "success": true,
  "stocks": [
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
  "count": 10,
  "updatedAt": "2026-02-06T08:00:00.000Z"
}
```

### `POST /api/watchlist`

Add stock to watchlist.

**Request:**
```json
{
  "symbol": "WIPRO"
}
```

**Response:**
```json
{
  "success": true,
  "message": "WIPRO added to watchlist",
  "stocks": ["RELIANCE", "TCS", "...", "WIPRO"],
  "count": 11
}
```

### `DELETE /api/watchlist`

Remove stock from watchlist.

**Request:**
```json
{
  "symbol": "SBIN"
}
```

**Response:**
```json
{
  "success": true,
  "message": "SBIN removed from watchlist",
  "stocks": ["RELIANCE", "TCS", "..."],
  "count": 9
}
```

---

## 6. Top 10 Stocks

### `GET /api/stocks/top-10`

Get the top 10 stocks screened from the NIFTY 100 universe based on technical signal clarity.

> **Detailed Flow**: See [Top 10 Stock API Flow](./TOP_10_STOCKS_FLOW.md) for the complete screening algorithm.

**Request:**
```bash
GET /api/stocks/top-10
```

**Response:**
```json
{
  "success": true,
  "stocks": [
    {
      "symbol": "RELIANCE",
      "name": "Reliance Industries",
      "price": 2450.50,
      "changePercent": 1.2,
      "confidence": 88,
      "direction": "bullish",
      "reason": "Strong Bullish (5/6 indicators agree)",
      "technicalScore": 88,
      "signalClarity": 83
    }
  ],
  "count": 10,
  "totalScanned": 100,
  "updatedAt": "2026-02-06T10:00:00.000Z"
}
```

### `POST /api/stocks/top-10/refresh`

Force refresh the screening process.

**Request:**
```bash
POST /api/stocks/top-10/refresh
```

---

## 🚨 ERROR HANDLING & ACCURACY SAFEGUARDS

### Data Quality Checks

Before sending to AI, validate:

```javascript
function validateStockData(data) {
  const errors = [];
  
  // Check data completeness
  if (data.ohlc.length < 20) {
    errors.push("Insufficient historical data");
  }
  
  // Check for data anomalies
  const priceChanges = data.ohlc.map((d, i, arr) => 
    i > 0 ? Math.abs((d.close - arr[i-1].close) / arr[i-1].close) : 0
  );
  
  if (Math.max(...priceChanges) > 0.15) {
    errors.push("Abnormal price movement detected (>15% single day)");
  }
  
  // Check volume
  if (data.avgVolume < 100000) {
    errors.push("Low liquidity stock (avg volume < 100k)");
  }
  
  // Check for split/bonus
  const volumeSpike = data.ohlc.some(d => 
    d.volume > data.avgVolume * 10
  );
  if (volumeSpike) {
    errors.push("Possible corporate action detected");
  }
  
  return {
    isValid: errors.length === 0,
    errors: errors
  };
}
```

### AI Response Validation

```javascript
function validateAIResponse(response) {
  // Check probabilities sum to 100
  const sum = response.bullishProb + response.bearishProb;
  if (Math.abs(sum - 100) > 5) {
    throw new Error("Probabilities don't sum to 100");
  }
  
  // Check pattern confidence
  if (response.pattern.confidence < 50) {
    console.warn("Low pattern confidence, flagging as uncertain");
  }
  
  // Check for realistic price targets
  const currentPrice = response.currentPrice;
  const maxTarget = Math.max(...response.bullishScenario.targets.map(t => t.price));
  
  if ((maxTarget - currentPrice) / currentPrice > 0.20) {
    console.warn("Target >20% away, may be unrealistic for swing trade");
  }
  
  return true;
}
```

---

## Error Codes

| Code | Description | Action |
|------|-------------|--------|
| `YAHOO_FINANCE_ERROR` | Failed to fetch market data | Retry in 30 seconds |
| `AI_RATE_LIMIT` | Gemini API rate limited | Wait 60 seconds |
| `AI_ERROR` | Gemini API error | Check API key |
| `DB_ERROR` | MongoDB connection failed | Check connection string |
| `INVALID_SYMBOL` | Stock symbol not found | Verify NSE symbol |
| `MARKET_CLOSED` | Market is closed | Wait for market hours |
| `VALIDATION_ERROR` | Invalid request data | Check request body |

---

## Rate Limits

| Service | Limit | Reset |
|---------|-------|-------|
| Morning Screening | 1 per 5 minutes | Rolling |
| Single Stock Analysis | 10 per minute | Rolling |
| Save Trade | 50 per hour | Rolling |
| Get Analytics | 100 per hour | Rolling |

---

## Authentication (Future)

Currently, the API is open. Future versions will include:

```bash
# Header-based authentication
Authorization: Bearer <your-api-key>
```

---

*API Version: 1.0.0*
*Last Updated: February 6, 2026*
