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
