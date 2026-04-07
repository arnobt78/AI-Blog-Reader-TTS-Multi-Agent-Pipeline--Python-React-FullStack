# Deploy this Vite + React frontend on Vercel

This guide matches the layout of [`frontend/vercel.json`](../frontend/vercel.json) and [`docs/VERCEL_PRODUCTION_GUARDRAILS.md`](./VERCEL_PRODUCTION_GUARDRAILS.md).

## 1. Project settings (Vercel dashboard)

| Setting            | Value                          |
| ------------------ | ------------------------------ |
| **Framework**      | Vite (or “Other” + commands below) |
| **Root Directory** | `frontend`                     |
| **Build Command**  | `npm run build`                |
| **Output Directory** | `dist`                      |
| **Install Command** | `npm install` (default)       |

## 2. Environment variables

| Name                 | When to set | Purpose |
| -------------------- | ----------- | ------- |
| `VITE_API_BASE_URL`  | Production  | Full origin of your FastAPI API **without** trailing slash (e.g. `https://api.example.com`). The client calls `${VITE_API_BASE_URL}/api/...`. Leave **unset** locally so Vite’s dev proxy keeps using `/api` → `localhost:8000`. |

Add the variable under **Project → Settings → Environment Variables** for Production (and Preview if you use a staging API).

## 3. SPA routing (no 404 on refresh)

[`frontend/vercel.json`](../frontend/vercel.json) rewrites unknown paths to `index.html` while **excluding** hashed assets under `/assets/`, `favicon.ico`, `robots.txt`, `bg-images/`, and `vite.svg`.

## 4. Production guardrails (manual)

- Enable **Firewall → Bot Protection** and **AI Bots** on Vercel.
- After deploy, spot-check **Observability** (edge requests, origin transfer) per the guardrails doc.

## 5. Backend

The FastAPI app is **not** deployed by this static build. Host it separately (VPS, Railway, Fly, etc.) and point `VITE_API_BASE_URL` at that origin. Ensure CORS on the API allows your Vercel domain if browsers call the API cross-origin.
