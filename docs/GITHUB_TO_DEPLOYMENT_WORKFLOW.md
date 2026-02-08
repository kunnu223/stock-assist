# 🚀 GitHub to Deployment & CI/CD Workflow

This guide provides the complete set of commands and steps to push the **Stock-Assist** project to GitHub, deploy it to Vercel, and understand the CI/CD pipeline.

---

## 🏎️ Phase 1: Local Git Initialization
*Status: Already completed by Antigravity*

If you need to re-initialize or check status:
```bash
# Check current status
git status

# Add all changes (if any)
git add .

# Create a commit
git commit -m "feat: initial project structure"
```

---

## 📤 Phase 2: Pushing to GitHub

1. **Create Repository**: Go to [GitHub](https://github.com/new) and create a **Private** repository named `Stock-Assist`.
2. **Link and Push**:
```bash
# Add the remote (Replace YOUR_USERNAME)
git remote add origin https://github.com/kunnu223/stock-assist.git

# Set the main branch
git branch -M main

# Push the code
git push -u origin main
```

---

## 🌐 Phase 3: Deployment (Vercel)

1. **Import Project**:
   - Log in to [Vercel](https://vercel.com).
   - Click **"Add New"** > **"Project"**.
   - Import `Stock-Assist`.

2. **Configure Project**:
   - **Framework**: Next.js (Auto-detected).
   - **Root Directory**: Leave as `./` (Root).
   - **Build Settings**: Vercel handles the monorepo automatically.

3. **Environment Variables**:
   Add these in **Settings > Environment Variables**:
   - `MONGODB_URI`: Your MongoDB Atlas connection string.
   - `GROQ_API_KEY`: Your Groq API key.
   - `GEMINI_API_KEY`: Your Gemini API key.
   - `NEXT_PUBLIC_API_URL`: Initially set to your local IP or `http://localhost:4000`. After first deployment, update this to your Vercel URL (e.g., `https://stock-assist-api.vercel.app`).

---

## 🔄 Phase 4: CI/CD Pipeline (GitHub Actions)

We have already set up a CI pipeline in `.github/workflows/ci.yml`.

### How it works:
1. **Trigger**: Every time you `git push` to the `main` branch.
2. **Automated Checks**:
   - **Install**: Installs all dependencies.
   - **Lint**: Checks for code errors in `apps/api`.
   - **Type Check**: Verifies TypeScript types in `packages/shared`.
   - **Build**: Attempts to build `apps/web` to ensure no breaking changes.

### Monitoring:
- Go to the **"Actions"** tab on your GitHub repository to see the results of each push.
- A **Green Checkmark** ✅ means your code is stable.
- A **Red Cross** ❌ means something broke, and you should check the logs.

---

## 🛠️ Summary of Commands for Future Updates

Whenever you make changes and want to deploy:
```bash
# 1. Stage changes
git add .

# 2. Commit changes
git commit -m "description of your change"

# 3. Push to GitHub (This triggers CI/CD and Vercel Auto-Deploy)
git push origin main
```

---
*Created on: Feb 8, 2026*
