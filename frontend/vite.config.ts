/**
 * Vite config: React + Tailwind, @ alias for src/, and dev proxy so /api/* goes to backend on :8000.
 * In production (Vercel) /api must be rewrites or VITE_API_BASE_URL to point at Coolify backend.
 */
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const root = path.resolve(__dirname)
  const fileEnv = loadEnv(mode, root, '')
  const sentryRelease = (
    process.env.VERCEL_GIT_COMMIT_SHA ||
    fileEnv.VITE_SENTRY_RELEASE ||
    ''
  ).trim()

  return {
    define: {
      __SENTRY_RELEASE__: JSON.stringify(sentryRelease),
    },
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      proxy: {
        '/api': {
          target: 'http://localhost:8000',
          changeOrigin: true,
        },
      },
    },
    build: {
      // Default 500 kB; app bundle (React + Framer Motion + lucide) is ~550 kB minified.
      chunkSizeWarningLimit: 900,
    },
  }
})
