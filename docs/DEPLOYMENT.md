# 🚀 Deployment Guide

> Step-by-step guide to deploy AI Trading Assistant

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Local Development Setup](#local-development-setup)
3. [MongoDB Atlas Setup](#mongodb-atlas-setup)
4. [Gemini API Setup](#gemini-api-setup)
5. [Vercel Deployment](#vercel-deployment)
6. [Environment Variables](#environment-variables)
7. [Post-Deployment Checklist](#post-deployment-checklist)

---

## Prerequisites

Before starting, ensure you have:

- [ ] Node.js 18+ installed
- [ ] npm or yarn package manager
- [ ] Git installed
- [ ] GitHub account
- [ ] Google account (for Gemini API)
- [ ] MongoDB Atlas account (free)
- [ ] Vercel account (free)

---

## Local Development Setup

### Step 1: Create Next.js Project

```bash
# Create project with Next.js
npx create-next-app@latest trading-assistant --typescript --tailwind --eslint --app --src-dir=false

# Navigate to project
cd trading-assistant
```

### Step 2: Install Dependencies

```bash
# Core dependencies
npm install mongoose axios cheerio

# UI dependencies (optional)
npm install recharts lucide-react

# Development
npm install -D @types/cheerio
```

### Step 3: Create Folder Structure

```bash
# Create directories
mkdir -p lib components models utils docs

# Create placeholder files
touch lib/yahoo-finance.js
touch lib/indicators.js
touch lib/patterns.js
touch lib/news-fetcher.js
touch lib/ai-provider.js
touch lib/gemini.js
touch lib/mongodb.js
```

### Step 4: Setup Environment

```bash
# Create environment file
cp .env.example .env.local

# Edit with your values
notepad .env.local  # Windows
# or
nano .env.local     # Mac/Linux
```

### Step 5: Run Development Server

```bash
npm run dev

# Open http://localhost:3000
```

---

## MongoDB Atlas Setup

### Step 1: Create Account

1. Go to [MongoDB Atlas](https://www.mongodb.com/atlas)
2. Sign up for free account
3. Verify email

### Step 2: Create Cluster

1. Click "Build a Database"
2. Select **FREE Shared** tier
3. Choose cloud provider: **AWS**
4. Choose region: **Mumbai (ap-south-1)** for lowest latency
5. Cluster name: `trading-cluster`
6. Click "Create Cluster"

### Step 3: Create Database User

1. Go to "Database Access" in sidebar
2. Click "Add New Database User"
3. Authentication: Password
4. Username: `trading_user`
5. Password: Generate secure password (save it!)
6. Privileges: "Read and write to any database"
7. Click "Add User"

### Step 4: Configure Network Access

1. Go to "Network Access" in sidebar
2. Click "Add IP Address"
3. Click "Allow Access from Anywhere" (for development)
4. For production, add specific IPs
5. Click "Confirm"

### Step 5: Get Connection String

1. Go to "Database" in sidebar
2. Click "Connect" on your cluster
3. Select "Connect your application"
4. Driver: Node.js, Version: 5.5 or later
5. Copy connection string:

```
mongodb+srv://trading_user:<password>@trading-cluster.xxxxx.mongodb.net/?retryWrites=true&w=majority
```

6. Replace `<password>` with your actual password
7. Add database name:

```
mongodb+srv://trading_user:yourpassword@trading-cluster.xxxxx.mongodb.net/trading?retryWrites=true&w=majority
```

---

## Gemini API Setup

### Step 1: Get API Key

1. Go to [Google AI Studio](https://aistudio.google.com/)
2. Sign in with Google account
3. Click "Get API Key"
4. Click "Create API key in new project"
5. Copy the API key (starts with `AIza...`)

### Step 2: Test API Key

```bash
# Test with curl
curl "https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=YOUR_API_KEY" \
  -H 'Content-Type: application/json' \
  -d '{"contents":[{"parts":[{"text":"Hello"}]}]}'
```

### Step 3: API Limits (Free Tier)

| Limit | Value |
|-------|-------|
| Requests per minute | 60 |
| Requests per day | 1,500 |
| Tokens per minute | 32,000 |

This is MORE than enough for our use case.

---

## Vercel Deployment

### Step 1: Push to GitHub

```bash
# Initialize git (if not already)
git init

# Add all files
git add .

# Commit
git commit -m "Initial commit - Trading Assistant"

# Add remote
git remote add origin https://github.com/yourusername/trading-assistant.git

# Push
git push -u origin main
```

### Step 2: Connect to Vercel

1. Go to [Vercel](https://vercel.com)
2. Sign up with GitHub
3. Click "Add New Project"
4. Import your `trading-assistant` repository
5. Configure project:
   - Framework: Next.js (auto-detected)
   - Root Directory: `./`
   - Build Command: `npm run build`
   - Output Directory: `.next`

### Step 3: Add Environment Variables

In Vercel project settings:

1. Go to "Settings" > "Environment Variables"
2. Add each variable:

| Name | Value | Environment |
|------|-------|-------------|
| `MONGODB_URI` | Your MongoDB connection string | Production, Preview, Development |
| `AI_PROVIDER` | `gemini` | All |
| `GEMINI_API_KEY` | Your Gemini API key | All |
| `NEXT_PUBLIC_APP_URL` | Your Vercel URL | Production |

### Step 4: Deploy

1. Click "Deploy"
2. Wait for build (2-3 minutes)
3. Your app is live at: `https://trading-assistant-xxxx.vercel.app`

### Step 5: Custom Domain (Optional)

1. Go to "Settings" > "Domains"
2. Add your domain
3. Configure DNS as instructed

---

## Environment Variables

### Complete `.env.local` Template

```bash
# ═══════════════════════════════════════════════════════════════
# DATABASE
# ═══════════════════════════════════════════════════════════════
MONGODB_URI=mongodb+srv://trading_user:password@trading-cluster.xxxxx.mongodb.net/trading?retryWrites=true&w=majority

# ═══════════════════════════════════════════════════════════════
# AI PROVIDER
# Options: 'gemini' or 'claude' (future)
# ═══════════════════════════════════════════════════════════════
AI_PROVIDER=gemini
GEMINI_API_KEY=AIzaSy...your-key-here

# For future Claude support
ANTHROPIC_API_KEY=sk-ant-...your-key-here

# ═══════════════════════════════════════════════════════════════
# APP CONFIGURATION
# ═══════════════════════════════════════════════════════════════
NODE_ENV=development
NEXT_PUBLIC_APP_URL=http://localhost:3000

# ═══════════════════════════════════════════════════════════════
# OPTIONAL: ANALYTICS
# ═══════════════════════════════════════════════════════════════
# NEXT_PUBLIC_GA_ID=G-XXXXXXXXXX

# ═══════════════════════════════════════════════════════════════
# OPTIONAL: ERROR TRACKING
# ═══════════════════════════════════════════════════════════════
# SENTRY_DSN=https://...
```

### Variable Descriptions

| Variable | Required | Description |
|----------|----------|-------------|
| `MONGODB_URI` | ✅ Yes | MongoDB Atlas connection string |
| `AI_PROVIDER` | ✅ Yes | Which AI to use (`gemini` or `claude`) |
| `GEMINI_API_KEY` | ✅ Yes* | Google Gemini API key |
| `ANTHROPIC_API_KEY` | ❌ No | Claude API key (future) |
| `NODE_ENV` | ❌ No | Environment (`development` or `production`) |
| `NEXT_PUBLIC_APP_URL` | ❌ No | Public URL of your app |

---

## Post-Deployment Checklist

### Immediate Checks

- [ ] App loads without errors
- [ ] Dashboard displays correctly
- [ ] Can analyze a single stock
- [ ] MongoDB connection works
- [ ] Gemini API responds

### Functional Tests

- [ ] Morning screening completes in < 2 min
- [ ] Single stock analysis in < 45 sec
- [ ] Trade journaling works
- [ ] Analytics page displays correctly
- [ ] Mobile responsive

### Performance Tests

- [ ] Page load time < 3 seconds
- [ ] No console errors
- [ ] No memory leaks
- [ ] API rate limits respected

### Security Checks

- [ ] Environment variables not exposed
- [ ] No sensitive data in client-side code
- [ ] HTTPS enabled (automatic on Vercel)
- [ ] MongoDB IP whitelist configured

---

## Troubleshooting

### MongoDB Connection Issues

```
Error: MongoNetworkError
```

**Fix:**
1. Check IP whitelist in MongoDB Atlas
2. Verify connection string format
3. Ensure password has no special characters (or URL-encode them)

### Gemini API Errors

```
Error: 429 Too Many Requests
```

**Fix:**
1. Wait 60 seconds
2. Implement rate limiting in code
3. Check daily quota in Google AI Studio

### Build Failures on Vercel

```
Error: Build failed
```

**Fix:**
1. Check build logs for specific error
2. Ensure all dependencies are in `package.json`
3. Test build locally: `npm run build`
4. Check for TypeScript errors

### Environment Variable Issues

```
Error: MONGODB_URI is not defined
```

**Fix:**
1. Verify variable is set in Vercel
2. Redeploy after adding variables
3. Check variable names match exactly (case-sensitive)

---

## Updating & Redeployment

### Automatic Deployment

Vercel auto-deploys on every push to `main`:

```bash
git add .
git commit -m "Update feature X"
git push origin main
# Vercel automatically deploys
```

### Manual Redeployment

1. Go to Vercel Dashboard
2. Click "Redeploy"
3. Select "Use existing build cache" (faster) or rebuild

### Environment Variable Updates

1. Update in Vercel Settings
2. **Must redeploy for changes to take effect**

---

## Monitoring

### Vercel Analytics (Free)

1. Enable in Project Settings > Analytics
2. View traffic, performance, errors

### Recommended Monitoring

| Service | Purpose | Cost |
|---------|---------|------|
| Vercel Analytics | Traffic & Performance | Free |
| MongoDB Atlas | Database metrics | Free tier included |
| Sentry | Error tracking | Free tier |

---

## Backup Strategy

### MongoDB Backup

1. Use MongoDB Atlas built-in backups (free tier: manual only)
2. Export collections periodically:

```bash
mongoexport --uri="your-connection-string" --collection=trades --out=trades_backup.json
```

### Code Backup

1. GitHub serves as code backup
2. Tag releases:

```bash
git tag -a v1.0.0 -m "First stable release"
git push origin v1.0.0
```

---

*Deployment Guide Version: 1.0.0*
*Last Updated: February 6, 2026*
