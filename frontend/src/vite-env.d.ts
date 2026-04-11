/// <reference types="vite/client" />

/** Injected in vite.config.ts from VERCEL_GIT_COMMIT_SHA or VITE_SENTRY_RELEASE. */
declare const __SENTRY_RELEASE__: string

interface ImportMetaEnv {
  /** Optional FastAPI origin for production (no trailing slash). */
  readonly VITE_API_BASE_URL?: string
  /** Sentry browser DSN (public). */
  readonly VITE_SENTRY_DSN?: string
  /** Release identifier for Sentry Release Health (e.g. VERCEL_GIT_COMMIT_SHA in Vercel). */
  readonly VITE_SENTRY_RELEASE?: string
  /** Override Sentry environment name (defaults to Vite MODE). */
  readonly VITE_SENTRY_ENVIRONMENT?: string
  /** Performance sample rate 0–1 (optional). */
  readonly VITE_SENTRY_TRACES_SAMPLE_RATE?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
