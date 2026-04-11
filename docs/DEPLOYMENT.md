# Blog-to-Audio — Deployment (Coolify + Vercel)

Backend runs on a **VPS with Coolify**; frontend on **Vercel**. For **DNS, Traefik/Caddy labels, TLS checks, CORS, and OAuth redirect patterns** (all with placeholders), see **[COOLIFY_PUBLIC_BACKEND_GUIDE.md](./COOLIFY_PUBLIC_BACKEND_GUIDE.md)**. For **Docker image hygiene, non-root user, and VPS prune commands**, see **[DOCKER_VPS_BACKEND_PLAYBOOK.md](./DOCKER_VPS_BACKEND_PLAYBOOK.md)**.

If you keep **personal** VPS notes (IPs, internal ports, passwords) in Markdown under `docs/`, add those filenames to `.gitignore` so they are never pushed.

---

## Project layout (no `backend/` folder needed)

- **Root:** `main.py`, `requirements.txt`, `Dockerfile` → backend (Coolify).
- **frontend/** → React/Vite app → deploy to Vercel.

Coolify uses the **repo root** as build context; Vercel uses **frontend/** as root.

---

## 1. Backend — Coolify (VPS)

- **Base directory:** `.` (repo root).
- **Dockerfile:** `./Dockerfile` (at root).
- **Port:** Container listens on **3000** by default. The app reads `PORT` from the environment so it matches Coolify and the Dockerfile healthcheck.
- **Coolify:** set **`PORT=3000`**, map a **host** port to container **3000** if you run multiple apps on one host (e.g. `HOST_PORT:3000`).
- **Healthcheck:** Dockerfile targets `/api/health` on the same port as `PORT`.
- **Public hostname:** pick something like `https://api.yourdomain.com`. Add an **A** record at your DNS provider to your VPS public IP, then configure Coolify domains and proxy labels — follow **[COOLIFY_PUBLIC_BACKEND_GUIDE.md](./COOLIFY_PUBLIC_BACKEND_GUIDE.md)**.
- **Env in Coolify (examples):**  
  `PORT=3000`, `CORS_ORIGINS=https://your-frontend.vercel.app`, plus provider keys as needed (`OPENAI_API_KEY`, `ELEVENLABS_API_KEY`, `REPLICATE_API_TOKEN`, `HF_API_KEY`, etc.).  
  Do **not** commit `.env`; it is in `.gitignore`.

---

## 2. Frontend — Vercel

- **Root directory:** `frontend`.
- **Build command:** `npm run build`.
- **Output directory:** `dist` (Vite default).
- **Env in Vercel:**  
  `VITE_API_BASE_URL=https://api.yourdomain.com` (your real backend URL, no trailing slash).

- **Production API calls:** The app may use relative URLs (`/api/...`), which only work in dev (Vite proxy). For production you must either:
  - **Option A — Vercel rewrites:** Add a `vercel.json` in **frontend/** with rewrites so `/api/*` is proxied to your Coolify backend URL; or
  - **Option B — Env base URL:** Set `VITE_API_BASE_URL` (see `frontend/src/lib/api-base.ts` and `frontend/.env.example`) so production hits the backend directly.

---

## 3. `.gitignore`

- `__pycache__/`, `.env`, and other secrets are ignored; `.env.example` stays committed as a template.

---

## 4. Optional: move backend into `backend/`

1. Create `backend/`.
2. Move `main.py`, `requirements.txt`, and `Dockerfile` into `backend/`.
3. In Coolify, set **Base directory** to `backend`.
4. Keep `frontend/` as-is for Vercel.

The default layout (**base directory = `.`**, Dockerfile at root) works without moving files.
