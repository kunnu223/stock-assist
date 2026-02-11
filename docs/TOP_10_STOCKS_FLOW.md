# Top 10 Stock API Flow

This document outlines the architecture and execution flow of the **Top 10 Stocks** dashboard feature. The system automatically screens the NIFTY 100 universe to identify high-probability trading setups based on technical signal concensus.

---

## 1. Overview

- **Endpoint**: `GET /api/stocks/top-10`
- **Refresh Endpoint**: `POST /api/stocks/top-10/refresh`
- **Universe**: NIFTY 100 (100 largest Indian stocks)
- **Methodology**: Technical Signal Clarity (Consensus Algorithm)
- **Data Source**: Yahoo Finance (History & Real-time Quote)
- **Storage**: MongoDB (`DailyTopStocks` collection) with daily caching.

---

## 2. Process Flow

### Step 1: Request & Cache Check
1.  **Incoming Request**: Client requests top 10 stocks.
2.  **Cache Lookup**: System checks `DailyTopStocks` for an entry with today's date (`YYYY-MM-DD`).
    -   **Cache Hit**: Returns the stored 10 stocks immediately.
    -   **Cache Miss**: Initiates the screening process (Stage 1).
3.  **Fallback**: If screening fails or returns 0 stocks, system attempts to return yesterday's cached data.

### Step 2: Stage 1 Screening (Clarity Filter)
The system iterates through all NIFTY 100 stocks.

**Per Stock Execution:**
1.  **Data Fetching**:
    -   Fetches **3 months of daily history** (OHLCV).
    -   *Requirement*: Minimum 26 data points (for EMA26 calculation).
2.  **Signal Clarity Calculation**:
    -   Computes 6 technical indicators.
    -   Determines consensus direction (Bullish/Bearish).
    -   Calculates `clarityScore` (Percentage of agreeing indicators).
    -   Calculates `weightedScore` (Weighted sum of indicator strengths).
3.  **Filtering**:
    -   **Rule**: `clarityScore >= 67` (Approx. 4/6 indicators must agree).
    -   Stocks failing this are discarded.
4.  **Sorting**:
    -   Remaining stocks are sorted descending by `weightedScore` (Signal Strength).

### Step 3: Stage 2 Selection (Top Picks)
From the Stage 1 results, the top 10 candidates are processed.

**Per Top 10 Candidate:**
1.  **Live Quote**: Fetches real-time price (`price`, `changePercent`) via `fetchQuote`.
2.  **Confidence Calculation**:
    -   `confidence = min(95, weightedScore)`
    -   Capped at 95% to avoid overconfidence.
3.  **Object Construction**:
    -   Returns `IStockPick` object with:
        -   `symbol`, `name`, `price`, `changePercent`
        -   `confidence`, `direction`, `reason` (Summary string)
        -   `technicalScore`, `signalClarity`, `signals` (List of active signals)

### Step 4: Storage & Response
1.  **Persistence**: The final list of 10 stocks is saved to MongoDB (`DailyTopStocks`) with a timestamp.
2.  **Response**: JSON payload returned to the client.

---

## 3. Signal Clarity Engine
Located in: `services/screening/signalClarity.ts`

The engine uses a weighted voting system.

### Indicators & Weights
| Indicator | Weight | Conditions (Bullish) |
| :--- | :--- | :--- |
| **RSI** | 20% | > 55 |
| **MACD** | 20% | MACD > Signal & Histogram > 0 |
| **MA Trend** | 20% | Price > SMA20 > SMA50 |
| **Bollinger** | 15% | %B > 0.7 |
| **Trend (Reg)** | 15% | Linear Regression Slope > 0 |
| **Volume** | 10% | Volume > 1.2x Average & Price Up |

### Scoring Logic
-   **Direction**: Majority vote (e.g., 5 Bullish vs 1 Bearish → **Bullish**).
-   **Clarity Score**: `(Majority Votes / Total Indicators) * 100`
-   **Weighted Score**: Sum of `(Weight * IndicatorStrength)` for all indicators matching the majority direction.

---

## 4. Error Handling
-   **API Limits**: 300ms delay between calls to respect Yahoo Finance rate limits.
-   **Data Gaps**: Skips stocks with insufficient history (< 26 days).
-   **Failures**: Individual stock failures are logged and skipped; process continues for others.
