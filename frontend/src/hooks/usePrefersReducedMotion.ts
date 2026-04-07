import { useEffect, useState } from 'react'

/**
 * Reflects `prefers-reduced-motion: reduce` so we can shorten or skip Framer Motion animations
 * (accessibility: respect OS / browser setting).
 */
export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => setReduced(mq.matches)
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])

  return reduced
}
