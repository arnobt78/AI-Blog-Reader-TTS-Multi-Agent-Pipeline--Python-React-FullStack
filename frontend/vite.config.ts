/**
 * Vite config: React + Tailwind, @ alias for src/, and dev proxy so /api/* goes to backend on :8000.
 * In production (Vercel) /api must be rewrites or VITE_API_BASE_URL to point at Coolify backend.
 */
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
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
})
