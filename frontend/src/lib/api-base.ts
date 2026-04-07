/**
 * API base URL for fetch calls.
 *
 * - **Local dev:** leave `VITE_API_BASE_URL` unset. Vite proxies `/api/*` to FastAPI (see vite.config.ts),
 *   so requests stay same-origin: `fetch('/api/providers')` works.
 * - **Production (Vercel static):** set `VITE_API_BASE_URL` to your deployed FastAPI origin, e.g.
 *   `https://api.yourdomain.com` (no trailing slash). Builds bake this into the client bundle.
 */
export function getApiBaseUrl(): string {
  const raw = import.meta.env.VITE_API_BASE_URL
  if (typeof raw !== 'string') return ''
  return raw.trim().replace(/\/$/, '')
}

/** Build an absolute or relative URL for API routes. Path must start with `/` (e.g. `/api/providers`). */
export function apiUrl(path: string): string {
  const normalized = path.startsWith('/') ? path : `/${path}`
  const base = getApiBaseUrl()
  return base ? `${base}${normalized}` : normalized
}

/**
 * Origin for opening backend pages in the browser (`/docs`, `/api/health`).
 * - **Prod + `VITE_API_BASE_URL`:** that origin (e.g. Coolify API).
 * - **Vite dev:** `http://localhost:8000` (only `/api` is proxied; `/docs` is not).
 * **Prod same-origin** (SPA served by FastAPI, no env): empty → use relative paths.
 */
export function backendBrowserOrigin(): string {
  const base = getApiBaseUrl()
  if (base) return base
  if (import.meta.env.DEV) return 'http://localhost:8000'
  return ''
}

/** Swagger UI — always absolute in dev when needed, or relative in same-origin deploys. */
export function backendDocsUrl(): string {
  const o = backendBrowserOrigin()
  return o ? `${o}/docs` : '/docs'
}

/** JSON health endpoint. */
export function backendHealthUrl(): string {
  const o = backendBrowserOrigin()
  return o ? `${o}/api/health` : '/api/health'
}
