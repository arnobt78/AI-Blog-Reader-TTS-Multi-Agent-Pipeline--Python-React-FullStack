/**
 * Top-level SPA: React Router + shared width shell (`RootLayout`).
 * `/` = portfolio intro; `/app` = AI Blog Reader tool (existing functionality).
 */
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { RootLayout } from '@/components/layout/RootLayout'
import { Toaster } from '@/components/ui/sonner'
import IntroPage from '@/pages/IntroPage'
import HealthPage from '@/pages/HealthPage'
import { ReaderPage } from '@/pages/ReaderPage'

export default function App() {
  return (
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
  )
}
