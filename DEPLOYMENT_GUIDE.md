# 🚀 Easy Deployment Guide for Stock Assist

I have configured everything for production. Follow these simplified steps.

## Checklist: What I Need From You
You will need to provide these values to the hosting platforms during setup:
1.  **`MONGODB_URI`**: Your MongoDB connection string.
2.  **`GEMINI_API_KEY`**: Your Google Gemini API Key.
3.  **`FRONTEND_URL`**: The URL Vercel gives you (e.g., `https://stock-assist-web.vercel.app`), needed for backend security.

---

## Part 1: Backend (Render) - Automated with `render.yaml`

1.  Go to the [Render Dashboard](https://dashboard.render.com).
2.  Click **New +** -> **Blueprint**.
3.  Connect your GitHub repository `stock-assist`.
4.  Render will automatically detect the **`render.yaml`** file I created.
5.  It will ask you for `MONGODB_URI` and `GEMINI_API_KEY`. **Paste them in.**
6.  Click **Apply**.
7.  **Wait for deployment.** Once done, **copy the Service URL** (e.g., `https://stock-assist-api.onrender.com`).

---

## Part 2: Frontend (Vercel)

1.  Go to [Vercel Dashboard](https://vercel.com/dashboard) and click **Add New...** -> **Project**.
2.  Import your `stock-assist` repository.
3.  **Configure Project**:
    *   **Framework Preset**: Next.js
    *   **Root Directory**: Click Edit and select `apps/web`.
4.  **Build Command Override**:
    *   Enable Override and paste:
        ```bash
        cd ../.. && npm i && npm run build -w @stock-assist/shared && cd apps/web && next build
        ```
5.  **Environment Variables**:
    *   Add `API_URL` = Your Render Backend URL (e.g., `https://stock-assist-api.onrender.com`).
6.  Click **Deploy**.

---

## Part 3: Final Connection

1.  Once Vercel deploys, **copy your Vercel URL** (e.g., `https://stock-assist-web.vercel.app`).
2.  Go back to **Render Dashboard** -> **Environment**.
3.  Add/Update the `FRONTEND_URL` variable with your Vercel URL.
4.  **Save Changes** (this will restart the backend).

🎉 **You are live!**
