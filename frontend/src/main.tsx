/**
 * App entry: mounts React root into `#root` and loads global CSS (Tailwind + theme variables).
 * `import './sentry'` runs side-effect init before React so early errors can still be captured when DSN is set.
 */
import './sentry'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// Disable browser scroll restoration — each page scrolls to top on mount instead.
if ('scrollRestoration' in history) {
  history.scrollRestoration = 'manual'
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
