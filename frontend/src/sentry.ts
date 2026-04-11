/**
 * Sentry browser SDK — init before React root. No-op without VITE_SENTRY_DSN.
 * Tunnel: dev → /api/monitoring (Vite proxy); prod → {VITE_API_BASE_URL}/api/monitoring (ad-block bypass).
 * `shouldCreateSpanForRequest` keeps tracing noise low while still measuring API and absolute-backend calls.
 */
import * as Sentry from '@sentry/react'
import { getApiBaseUrl } from '@/lib/api-base'

const dsn = import.meta.env.VITE_SENTRY_DSN
if (typeof dsn === 'string' && dsn.trim()) {
  const apiBase = getApiBaseUrl()
  const tunnel = import.meta.env.DEV
    ? '/api/monitoring'
    : apiBase
      ? `${apiBase}/api/monitoring`
      : undefined

  const rawRate = import.meta.env.VITE_SENTRY_TRACES_SAMPLE_RATE
  const tracesSampleRate =
    typeof rawRate === 'string' && rawRate.trim() !== ''
      ? Math.min(1, Math.max(0, Number(rawRate)))
      : import.meta.env.PROD
        ? 0.1
        : 1.0

  Sentry.init({
    dsn: dsn.trim(),
    tunnel,
    environment:
      (typeof import.meta.env.VITE_SENTRY_ENVIRONMENT === 'string' &&
        import.meta.env.VITE_SENTRY_ENVIRONMENT.trim()) ||
      import.meta.env.MODE,
    release: (() => {
      const fromEnv =
        typeof import.meta.env.VITE_SENTRY_RELEASE === 'string'
          ? import.meta.env.VITE_SENTRY_RELEASE.trim()
          : ''
      const fromCi =
        typeof __SENTRY_RELEASE__ === 'string' ? __SENTRY_RELEASE__.trim() : ''
      return fromEnv || fromCi || undefined
    })(),
    integrations: [
      Sentry.browserTracingIntegration({
        shouldCreateSpanForRequest: (url) =>
          url.includes('/api/') || (!!apiBase && url.startsWith(apiBase)),
      }),
    ],
    tracesSampleRate: Number.isFinite(tracesSampleRate) ? tracesSampleRate : 0.1,
    ignoreErrors: [
      'top.GLOBALS',
      'ResizeObserver loop limit exceeded',
      'ResizeObserver loop completed with undelivered notifications',
      'Non-Error promise rejection captured',
    ],
  })
}
