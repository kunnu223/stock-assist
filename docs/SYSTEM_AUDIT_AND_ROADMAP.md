# 🏗️ Stock-Assist: System Audit & Industry-Level Roadmap

> **Audit Date:** 2026-02-23  
> **Current Version:** v1.0.0  
> **Architecture:** Monorepo (npm workspaces) — Express API + Next.js 14 PWA + Shared Package

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Current Architecture Map](#2-current-architecture-map)
3. [What's Working Well ✅](#3-whats-working-well-)
4. [Critical Gaps (Industry-Level Perspective) 🔴](#4-critical-gaps-industry-level-perspective-)
5. [Detailed Findings by Category](#5-detailed-findings-by-category)
6. [Industry-Level Roadmap](#6-industry-level-roadmap)
7. [Priority Matrix](#7-priority-matrix)

---

## 1. Executive Summary

**Stock-Assist** is a full-stack AI-powered stock & commodity analysis platform targeting Indian markets (Nifty 100, MCX). It features:

| Dimension | Current State | Industry Target |
|-----------|--------------|-----------------|
| **Architecture** | Monolithic Express API | Microservices / Event-driven |
| **Testing** | ❌ Zero test files | >80% coverage, E2E, integration |
| **Error Handling** | console.log + generic catches | Structured error classes, correlation IDs |
| **Security** | Basic CORS | Auth, rate limiting, input sanitization, API keys |
| **Observability** | console.log statements | Structured logging, APM, metrics, alerting |
| **Performance** | Single-threaded, no caching layer | Redis caching, worker threads, queue system |
| **CI/CD** | None | GitHub Actions, automated deploy, preview envs |
| **Code Quality** | No linting enforcement | ESLint strict, Prettier, Husky pre-commit |
| **API Design** | Inconsistent response shapes | OpenAPI spec, versioned, pagination, rate limits |
| **Data Layer** | Raw Mongoose, no migrations | Repository pattern, schema versioning |
| **Type Safety** | Partial (`any` types throughout) | Strict types, runtime validation (Zod) |
| **Scalability** | Single process, single server | Horizontal scaling, queue workers, CDN |

**Overall Grade: 4/10 for production-readiness.** The analysis engine is sophisticated (regime classification, empirical weights, confidence calibration), but the surrounding infrastructure is hobby-project level. Below are the specific gaps and a phased plan to reach **industry-grade (8+/10)**.

---

## 2. Current Architecture Map

```
┌─────────────────────────────────────────────────────────────────────┐
│                        MONOREPO (npm workspaces)                    │
│                                                                     │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐  │
│  │  @stock-assist/  │  │  @stock-assist/  │  │  @stock-assist/  │  │
│  │       web        │  │       api        │  │     shared       │  │
│  │   Next.js 14     │  │    Express 4     │  │  Types/Utils     │  │
│  │   TailwindCSS    │  │    Mongoose      │  │                  │  │
│  │   Recharts       │  │   Groq + Gemini  │  │                  │  │
│  │   Framer Motion  │  │  Yahoo Finance   │  │                  │  │
│  └──────────────────┘  └──────────────────┘  └──────────────────┘  │
│                              │                                      │
│                              ▼                                      │
│                         MongoDB Atlas                               │
│                        (8 collections)                              │
└─────────────────────────────────────────────────────────────────────┘

API Service Layer (52 files):
├── ai/           → Groq/Gemini with fallback chain
├── analysis/     → Confidence scoring, regime, calibration, expectancy
├── backtest/     → Signal tracking, outcome resolution
├── commodity/    → Gold/Silver/Crude with MCX/COMEX pricing
├── data/         → Yahoo Finance fetching, fundamentals
├── indicators/   → RSI, MA, MACD, Bollinger, ADX, ATR, VWAP
├── news/         → Scraping-based news with sentiment
├── patterns/     → Bullish/Bearish candlestick detection
└── screening/    → Top-10 pipeline with signal clarity scoring
```

---

## 3. What's Working Well ✅

1. **Sophisticated Analysis Engine** — The multi-phase confidence scoring (direction/strength split, regime-adaptive weights, empirical calibration) is genuinely advanced. Most retail tools don't have condition-hash → win-rate matrices.

2. **Multi-Timeframe Analysis** — Daily, weekly, monthly indicator confluence with alignment scoring.

3. **Self-Learning Architecture** — Signal tracking with lazy outcome checking, empirical weight learning, confidence calibration buckets.

4. **Circuit Breaker Pattern** — The rate-limit circuit breaker in the screening endpoint is a good resilience pattern.

5. **AI Fallback Chain** — Groq → Gemini → System-generated fallback ensures the system never fully fails.

6. **PWA Support** — Service worker, manifest, install prompt, bottom nav — good mobile-first approach.

7. **Monorepo Structure** — Clean workspace separation (API, Web, Shared).

8. **SEO & Metadata** — Good OpenGraph, structured data (JSON-LD), robots/sitemap.

---

## 4. Critical Gaps (Industry-Level Perspective) 🔴

### 🔴 GAP 1: Zero Automated Tests

**Severity: CRITICAL**

There are **zero** test files (`*.test.*`, `*.spec.*`) in the entire codebase. For a financial analysis system, this is the single biggest risk.

**Impact:**
- Every deployment is a potential regression
- Confidence scoring formulas can silently break
- Indicator calculations have no verified correctness
- Refactoring is dangerous

**Industry Standard:** 80%+ code coverage with unit, integration, and E2E tests.

---

### 🔴 GAP 2: No Authentication or Authorization

**Severity: CRITICAL**

The API is completely open — no auth tokens, no API keys, no user management. Anyone with the URL can:
- Trigger expensive AI analyses (consuming your Groq/Gemini credits)
- Read all historical data
- Access all endpoints without restriction

**Impact:** Unbounded cost exposure, data privacy risk, abuse vulnerability.

---

### 🔴 GAP 3: No Input Validation / Sanitization

**Severity: HIGH**

```typescript
// analyze.ts line 125 — raw user input used directly
const { symbol, language } = req.body;
// No validation beyond: if (!symbol)

// history endpoint — query params used in MongoDB query directly
const { symbol, startDate, endDate, minConfidence, ... } = req.query;
query.symbol = { $regex: new RegExp(symbol as string, 'i') };
// ⚠️ Regex injection vulnerability!
```

**Impact:** NoSQL injection, Regex DoS (ReDoS), invalid data corrupting DB.

---

### 🔴 GAP 4: `any` Types Everywhere

**Severity: HIGH**

The codebase has extensive use of `any`:
- `analyze.ts`: `const results: any[]`, `let aiResponse = null`, `let calibratedResponse: any`
- `tradeDecision.ts`: `shouldTrade(analysis: any)`, `checkRedFlags(analysis: any)`
- `processStock()` returns `Promise<any>`
- `generateFallbackAnalysis()` takes `technicalAnalysis: any` and returns `any`

**Impact:** Type errors caught only at runtime, impossible to refactor safely, misleading IDE assistance.

---

### 🔴 GAP 5: God Route File — `analyze.ts` (1,124 lines)

**Severity: HIGH**

The `analyze.ts` route file is **1,124 lines** and contains:
- Route handlers
- Business logic
- Data transformation
- Response building
- Fallback generation
- Signal tracking orchestration

This single file does the work of at least 5 distinct services. It violates Single Responsibility Principle and makes testing, debugging, and extending extremely difficult.

---

### 🔴 GAP 6: No Rate Limiting

**Severity: HIGH**

No Express rate limiting middleware. Any client can flood the API with requests, exhausting:
- Yahoo Finance quotas
- Groq/Gemini API credits
- MongoDB connections
- Server CPU/memory

---

### 🔴 GAP 7: No Structured Logging

**Severity: MEDIUM**

All logging is `console.log()` / `console.error()` with emoji-heavy strings:
```typescript
console.log(`[Analyze] 🚀 Enhanced analysis for: ${symbol}`);
console.log(`[Analyze] 📈 ADX: ${adxResult.adx} (${adxResult.trendStrength})`);
```

**Impact:** Cannot filter logs by level, no structured JSON for log aggregation (Datadog, ELK), no correlation IDs to trace requests, no performance measurement.

---

### 🔴 GAP 8: No Error Classes / Error Handling Strategy

**Severity: MEDIUM**

Errors are caught as generic `catch (error)` blocks and returned as `String(error)`:
```typescript
} catch (error) {
    res.status(500).json({
        success: false,
        error: String(error),
        message: 'Enhanced analysis failed. Please try again.'
    });
}
```

No distinction between:
- Client errors (bad input → 400)
- Upstream errors (Yahoo Finance down → 502)
- Internal errors (code bug → 500)
- Rate limit errors (429)

---

### 🔴 GAP 9: No Caching Layer

**Severity: MEDIUM**

The only caching is an in-memory `Map` in `topStocks.ts` (6-hour TTL for historical data) and a 1-hour cache in `regimeClassifier.ts`. There is no:
- Redis/Memcached for shared caching
- Response caching for repeated analyses
- CDN caching for static assets
- Yahoo Finance response caching (currently re-fetches on every call)
- Cache invalidation strategy

---

### 🔴 GAP 10: No CI/CD Pipeline

**Severity: MEDIUM**

The `.github/` directory exists but has minimal content. No:
- GitHub Actions workflows
- Automated testing on PR
- Automated deployment
- Preview environments
- Security scanning (Dependabot, Snyk)

---

## 5. Detailed Findings by Category

### 5.1 API Design Issues

| Issue | Location | Fix |
|-------|----------|-----|
| Inconsistent response shapes | All routes | Define unified `ApiResponse<T>` envelope |
| No API versioning | `index.ts` | Add `/api/v1/` prefix |
| No pagination | `/history` endpoint | Add `page`, `limit`, `cursor` params |
| No request ID tracking | Middleware | Add `x-request-id` header + correlation |
| Giant response payloads | `/analyze/single` | Too much data in single response (~50+ fields) |
| No OpenAPI/Swagger docs | N/A | Generate from types or use decorators |

### 5.2 Data Layer Issues

| Issue | Location | Fix |
|-------|----------|-----|
| No repository pattern | Models used directly in routes | Add repository abstraction |
| No database migrations | Mongoose schemas | Add schema versioning strategy |
| No connection pooling config | `db.ts` | Configure pool size, timeouts |
| No database indexes review | `SignalRecord.ts` | Audit query patterns vs indexes |
| Raw MongoDB in route handlers | `analyze.ts:688` | Extract to service layer |
| No data TTL/cleanup | All models | Add TTL indexes for old data |

### 5.3 Security Issues

| Issue | Severity | Fix |
|-------|----------|-----|
| No authentication | 🔴 Critical | JWT/API key authentication |
| No rate limiting | 🔴 Critical | Express rate limiter middleware |
| Regex injection in queries | 🔴 High | Input sanitization, parameterized queries |
| Secrets in `.env` without rotation | 🟡 Medium | Secret management (Vault, env rotation) |
| No HTTPS enforcement | 🟡 Medium | Strict transport security headers |
| No helmet.js | 🟡 Medium | Security headers |
| No CORS restriction in dev | 🟢 Low | Tighten in production |

### 5.4 Performance Issues

| Issue | Impact | Fix |
|-------|--------|-----|
| Sequential stock processing | High latency for screening | Parallel with concurrency limit |
| No worker threads for CPU-bound calculations | Blocks event loop | Use worker_threads |
| Indicator recalculation on every request | Wasted CPU | Cache indicator results |
| Yahoo Finance called without rate limiting | Potential blocking | Queue + rate limit per source |
| Large response serialization | Memory pressure | Selective field projection |
| No gzip/compression middleware | Bandwidth waste | Add `compression` middleware |

### 5.5 Frontend Issues

| Issue | Location | Fix |
|-------|----------|-----|
| Client-side data fetching only | `page.tsx` | Server-side fetching with Next.js RSC |
| No error boundaries | Components | Add React Error Boundaries |
| No loading skeletons | Dashboard | Add proper loading UI |
| No state management | Context only | Consider Zustand or React Query |
| No data fetching library | Raw fetch | Use React Query/SWR for caching + revalidation |
| No form validation | Analysis form | Add Zod + react-hook-form |

### 5.6 Code Organization Issues

| Issue | Location | Fix |
|-------|----------|-----|
| `analyze.ts` = 1,124 lines | Routes | Split into controller + service + transformer |
| `commodity/index.ts` = 719 lines | Services | Split into orchestrator + AI + pricing |
| `signalTracker.ts` = 663 lines | Backtest | Split into tracker + resolver + analytics |
| `confidenceScoring.ts` = 526 lines | Analysis | Split into scorers + combiner |
| Duplicate fallback code | Multiple files | Extract shared fallback factory |
| Mixed concerns in route handlers | All routes | Apply Controller → Service → Repository |

---

## 6. Industry-Level Roadmap

### 🏗️ PHASE 1: Foundation (Week 1-2) — "Make It Safe"

**Goal:** Security, stability, and basic guardrails.

#### 1.1 Input Validation with Zod
```
npm install zod
```
- Create request validation schemas for every endpoint
- Validate body, params, and query parameters
- Sanitize regex-vulnerable inputs

#### 1.2 Authentication & Authorization
- Implement JWT-based auth OR API key system
- Protect all `/api/*` endpoints
- Add rate limiting per user/IP (express-rate-limit)

#### 1.3 Security Middleware
```
npm install helmet express-rate-limit
```
- Add `helmet()` for security headers
- Add rate limiting (100 req/min per IP)
- Add request size limits
- Add CORS strict mode for production

#### 1.4 Error Handling Framework
- Create custom error classes: `AppError`, `ValidationError`, `UpstreamError`, `NotFoundError`
- Create global error handler middleware
- Map errors to proper HTTP status codes
- Remove generic `String(error)` returns

#### 1.5 Structured Logging
```
npm install pino pino-pretty
```
- Replace all `console.log` with structured logger
- Add log levels (debug, info, warn, error)
- Add request correlation IDs
- Add performance timing logs

---

### 🧪 PHASE 2: Quality (Week 3-4) — "Make It Testable"

**Goal:** Testing infrastructure, type safety, code refactoring.

#### 2.1 Testing Framework
```
npm install -D vitest @testing-library/react @testing-library/jest-dom msw supertest
```
- **Unit tests** for every indicator calculator (RSI, MACD, ADX, etc.)
- **Unit tests** for confidence scoring functions
- **Unit tests** for trade decision logic
- **Integration tests** for API endpoints (with supertest)
- **E2E tests** for critical user flows

#### 2.2 Eliminate `any` Types
- Replace all `any` with proper interfaces
- Create strict response types for every endpoint
- Add `"noImplicitAny": true` to tsconfig
- Create unions and discriminated unions where needed

#### 2.3 Refactor God Files
- **Split `analyze.ts`** into:
  - `controllers/analyzeController.ts` — HTTP handling only
  - `services/singleAnalysis.ts` — Orchestration logic
  - `services/batchAnalysis.ts` — Screening logic
  - `transformers/analyzeTransformer.ts` — Response shaping
- **Split `commodity/index.ts`** into:
  - `commodity/orchestrator.ts`
  - `commodity/aiAnalysis.ts`
  - `commodity/prediction.ts`

#### 2.4 CI/CD Pipeline
- GitHub Actions workflow:
  - Lint → Type-check → Unit Tests → Build → Deploy
  - PR checks with test coverage requirements
  - Automated Vercel preview deployments
  - Dependabot for dependency updates

---

### ⚡ PHASE 3: Performance (Week 5-6) — "Make It Fast"

**Goal:** Caching, performance optimization, scalability prep.

#### 3.1 Caching Strategy
```
npm install ioredis
```
- **Redis caching** for:
  - Yahoo Finance quotes (5-min TTL during market hours)
  - Yahoo Finance history (24-hour TTL)
  - Indicator calculations (keyed by symbol + date)
  - AI analysis results (6-hour TTL)
  - Fundamentals data (24-hour TTL)
- **Cache invalidation** triggers
- **Stale-while-revalidate** pattern for non-critical data

#### 3.2 API Response Optimization
- Add `compression` middleware for gzip
- Implement field projection (clients choose fields)
- Add pagination for list endpoints
- Add ETags for conditional requests

#### 3.3 Background Job Processing
```
npm install bullmq
```
- Move expensive operations to background:
  - Signal outcome resolution
  - Market breadth calculation
  - Top-10 stock screening (scheduled cron)
  - Prediction accuracy updates
- Add job progress tracking
- Add retry with exponential backoff

#### 3.4 Frontend Performance
- Convert to React Server Components where possible
- Add React Query for data fetching with caching
- Add proper loading skeletons
- Lazy-load analysis detail components
- Add virtual scrolling for lists

---

### 📊 PHASE 4: Observability (Week 7-8) — "Make It Visible"

**Goal:** Monitoring, alerting, and debugging capability.

#### 4.1 Application Performance Monitoring
- Integrate with APM (New Relic / Datadog / OpenTelemetry)
- Track request latency per endpoint
- Track AI model response times
- Track Yahoo Finance API health
- Track MongoDB query performance

#### 4.2 Health & Readiness Checks
- Enhanced `/health` endpoint:
  - MongoDB connection status
  - Redis connection status
  - Yahoo Finance reachability
  - AI API key validity
  - Disk/memory usage

#### 4.3 Alerting
- Alert on: error rate spike, latency increase, AI failure rate
- Alert on: MongoDB connection loss
- Alert on: Groq/Gemini quote exhaustion

#### 4.4 Business Metrics Dashboard
- Track: analyses per day, confidence calibration quality
- Track: AI model usage distribution, fallback rate
- Track: signal accuracy over time
- Track: user engagement metrics

---

### 🚀 PHASE 5: Scale & Polish (Week 9-12) — "Make It Professional"

**Goal:** Production hardening, documentation, developer experience.

#### 5.1 API Documentation
- OpenAPI 3.0 spec auto-generated from types
- Interactive Swagger UI at `/api/docs`
- Versioned API (`/api/v1/`)
- Changelog for breaking changes

#### 5.2 Database Optimization
- Review and optimize all MongoDB indexes
- Add compound indexes for frequent query patterns
- Implement data archival strategy (signals > 1 year)
- Add TTL indexes for temporary data
- Implement connection pooling configuration

#### 5.3 Feature Flags
- Add feature flag system for gradual rollouts
- Enable/disable AI providers dynamically
- A/B test different confidence scoring strategies

#### 5.4 Multi-Environment Support
- Proper environment separation (dev/staging/prod)
- Environment-specific configuration
- Database per environment
- Preview deployments for PRs

#### 5.5 Developer Experience
- Pre-commit hooks (Husky + lint-staged)
- Automatic code formatting (Prettier)
- Commit message linting (Commitlint)
- Automatic changelog generation
- Contribution guidelines

---

## 7. Priority Matrix

| Priority | Task | Effort | Impact | Risk Reduction |
|----------|------|--------|--------|----------------|
| 🔴 P0 | Input validation + sanitization | 2 days | High | Prevents injection attacks |
| 🔴 P0 | Rate limiting | 1 day | High | Prevents cost explosion |
| 🔴 P0 | Authentication (API keys minimum) | 3 days | Critical | Prevents unauthorized access |
| 🔴 P1 | Testing framework + core tests | 1 week | Critical | Prevents silent regressions |
| 🔴 P1 | Error handling framework | 2 days | High | Proper error reporting |
| 🔴 P1 | Eliminate `any` types | 3 days | High | Type-safe refactoring |
| 🟡 P2 | Structured logging | 2 days | Medium | Production debugging |
| 🟡 P2 | Refactor `analyze.ts` | 3 days | High | Maintainability |
| 🟡 P2 | CI/CD pipeline | 2 days | Medium | Automated quality gates |
| 🟡 P2 | Redis caching | 3 days | High | Performance + cost reduction |
| 🟢 P3 | Background jobs (BullMQ) | 3 days | Medium | Scalability |
| 🟢 P3 | APM integration | 2 days | Medium | Observability |
| 🟢 P3 | OpenAPI docs | 2 days | Medium | Developer experience |
| 🟢 P3 | React Query on frontend | 3 days | Medium | UX improvement |

---

## Summary

Your **analysis engine is genuinely impressive** — the regime classification, empirical weight learning, confidence calibration, and signal tracking system is more sophisticated than most retail trading platforms. The core algorithmic logic is solid.

However, the **surrounding infrastructure** (security, testing, error handling, observability, performance) is at a hobby-project level. Industry-grade systems differentiate themselves not by smarter algorithms alone, but by:

1. **Reliability** — The system never silently breaks (testing + monitoring)
2. **Security** — The system is protected from abuse (auth + rate limiting)
3. **Scalability** — The system handles 10x load without rewriting (caching + queues)
4. **Maintainability** — New developers can contribute safely (types + tests + docs)
5. **Observability** — You can diagnose any issue within minutes (logging + APM)

The roadmap above is designed to be **incremental** — each phase delivers standalone value and can be shipped independently.

**Recommended starting point:** Phase 1 (Security) — it's the highest risk and relatively low effort.
