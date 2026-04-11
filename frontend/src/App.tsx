/**
 * Top-level SPA: React Router + shared width shell (`RootLayout`).
 * `/` = portfolio intro; `/app` = AI Blog Reader tool (existing functionality).
 * `/health` surfaces backend JSON for demos; unknown paths redirect home to avoid dead-end URLs on static hosting.
 */
import * as Sentry from '@sentry/react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { RootLayout } from '@/components/layout/RootLayout'
import { Toaster } from '@/components/ui/sonner'
import IntroPage from '@/pages/IntroPage'
import HealthPage from '@/pages/HealthPage'
import { ReaderPage } from '@/pages/ReaderPage'

export default function App() {
  // ErrorBoundary wraps the whole router so runtime render errors still show the fallback UI + Sentry event.
  return (
    <Sentry.ErrorBoundary
      fallback={({ resetError }) => (
        <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 p-8 text-center text-zinc-200">
          <p className="text-lg">Something went wrong.</p>
          <button
            type="button"
            className="rounded-md border border-zinc-600 bg-zinc-800 px-4 py-2 text-sm hover:bg-zinc-700"
            onClick={resetError}
          >
            Try again
          </button>
        </div>
      )}
    >
      <BrowserRouter>
        <Toaster />
        <RootLayout>
          <Routes>
            <Route path="/" element={<IntroPage />} />
            <Route path="/app" element={<ReaderPage />} />
            <Route path="/health" element={<HealthPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </RootLayout>
      </BrowserRouter>
    </Sentry.ErrorBoundary>
  )
}
