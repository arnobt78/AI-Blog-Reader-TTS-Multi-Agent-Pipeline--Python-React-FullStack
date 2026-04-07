/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Optional FastAPI origin for production (no trailing slash). */
  readonly VITE_API_BASE_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
