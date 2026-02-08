# 🚀 Implementation Plan - Accuracy Features

## Current Code Review Summary

### ✅ What's Already Built:
1. **API Structure** - Express server with modular routes
2. **Data Fetching** - Yahoo Finance integration
3. **Technical Indicators** - RSI, MA, S/R, Volume
4. **Pattern Detection** - Trend analysis and patterns
5. **News Fetching** - News analysis service
6. **AI Integration** - Gemini AI with retry logic
7. **Basic Prompt** - Dual strategy prompt structure

### 🔧 What Needs Enhancement:
1. **AI Prompt** - Upgrade to accuracy-focused expert prompt
2. **Data Validation** - Add quality checks before AI
3. **Trade Decision Logic** - Implement "When NOT to trade"
4. **Error Handling** - Add validation safeguards
5. **Multi-Timeframe** - Add 1W and 1M analysis
6. **Backtesting** - Add tracking framework

---

## 📋 Implementation Phases

### **Phase 1: Critical Updates (Today)** ⚡
**Goal:** Improve AI accuracy and add basic validation

1. ✅ **Update AI System Prompt** (30 min)
   - File: `apps/api/src/services/ai/prompt.ts`
   - Replace with enhanced accuracy-focused prompt
   - Add step-by-step reasoning requirements

2. ✅ **Create Validation Utilities** (45 min)
   - File: `apps/api/src/utils/validation.ts` (NEW)
   - Add `validateStockData()` function
   - Add `validateAIResponse()` function

3. ✅ **Create Trade Decision Logic** (30 min)
   - File: `apps/api/src/utils/tradeDecision.ts` (NEW)
   - Add `shouldTrade()` function
   - Implement red flags checklist

4. ✅ **Update Analyze Routes** (30 min)
   - File: `apps/api/src/routes/analyze.ts`
   - Add validation before AI call
   - Add trade decision after AI response
   - Add error handling

**Total Time: ~2 hours**

---

### **Phase 2: Enhanced Features (Next Session)** 🔄
**Goal:** Add multi-timeframe and backtesting

5. ⏳ **Multi-Timeframe Data Fetching**
   - File: `apps/api/src/services/data/multiTimeframe.ts` (NEW)
   - Fetch 1D, 1W, 1M data
   - Analyze each timeframe
   - Check alignment

6. ⏳ **Backtesting Schema & Routes**
   - File: `apps/api/src/models/Backtest.ts` (NEW)
   - File: `apps/api/src/routes/backtest.ts` (NEW)
   - Save predictions
   - Track outcomes
   - Calculate accuracy

7. ⏳ **Update Types**
   - File: `packages/shared/src/types/analysis.ts`
   - Add validation result types
   - Add backtest types
   - Add multi-timeframe types

---

### **Phase 3: UI & Analytics (Future)** 📊
**Goal:** Display accuracy metrics to user

8. ⏳ **Accuracy Dashboard**
   - Show validation warnings
   - Display confidence scores
   - Show backtesting results

9. ⏳ **Calibration System**
   - Auto-adjust after 30 trades
   - Show calibration metrics
   - Suggest prompt improvements

---

## 🎯 Phase 1 - Detailed Steps

### Step 1: Update AI Prompt ✅

**File:** `apps/api/src/services/ai/prompt.ts`

**Changes:**
- Replace basic prompt with enhanced expert prompt
- Add 4-step analysis framework
- Add specific accuracy rules
- Add reasoning requirements

### Step 2: Create Validation Utils ✅

**File:** `apps/api/src/utils/validation.ts` (NEW)

**Functions:**
- `validateStockData()` - Check data quality
- `validateAIResponse()` - Verify AI output
- `ValidationResult` interface

### Step 3: Create Trade Decision Logic ✅

**File:** `apps/api/src/utils/tradeDecision.ts` (NEW)

**Functions:**
- `shouldTrade()` - Apply red flags checklist
- `TradeDecision` interface
- Return category: STRONG_SETUP | NEUTRAL | AVOID

### Step 4: Update Analyze Routes ✅

**File:** `apps/api/src/routes/analyze.ts`

**Changes:**
- Import validation and decision utils
- Validate stock data before AI
- Validate AI response after AI
- Apply trade decision logic
- Add warnings to response
- Improve error handling

---

## 🧪 Testing Plan

### After Phase 1:
1. Test single stock analysis
2. Verify validation catches bad data
3. Check AI responses are more detailed
4. Confirm trade decisions work
5. Test error handling

### Commands:
```bash
# Start API
cd apps/api
npm run dev

# Test single stock
curl -X POST http://localhost:4000/api/analyze/single \
  -H "Content-Type: application/json" \
  -d '{"symbol":"RELIANCE"}'

# Test morning screening
curl http://localhost:4000/api/analyze/stocks
```

---

## 📝 Success Criteria

### Phase 1 Complete When:
- [x] AI prompt includes step-by-step reasoning
- [x] Data validation catches anomalies
- [x] Low-confidence patterns flagged
- [x] Coin-flip probabilities rejected
- [x] Error handling prevents crashes
- [x] Warnings logged appropriately

---

## 🚀 Ready to Start?

**Next Action:** Begin Phase 1 implementation

1. Update prompt.ts
2. Create validation.ts
3. Create tradeDecision.ts
4. Update analyze.ts
5. Test everything

**Estimated Time:** 2 hours
**Priority:** HIGH - Core accuracy improvements

---

*Plan created: February 8, 2026*
*Status: Ready to implement*
