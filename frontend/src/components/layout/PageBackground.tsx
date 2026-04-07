import { cn } from '@/lib/utils'

type PageBackgroundProps = {
  /** Public URL under `/public` (e.g. `/bg-images/bg-11.png`). */
  bgImage?: string
  /** CSS class that sets `background-image` + rotation (see `index.css` `.intro-orbit`). */
  orbitClassName?: string
  /** Lower opacity on the orbit layer for calmer reader UI. */
  orbitOpacity?: string
}

/**
 * Shared full-viewport layers: cover photo + radial vignette + optional rotating center art.
 * Uses `fixed` positioning so it works the same on intro and reader routes.
 */
export function PageBackground({
  bgImage = '/bg-images/bg-11.png',
  orbitClassName = 'intro-orbit',
  orbitOpacity = 'opacity-[0.22] dark:opacity-[0.18]',
}: PageBackgroundProps) {
  return (
    <>
      <div
        className="pointer-events-none fixed inset-0 z-0 bg-cover bg-center"
        style={{ backgroundImage: `url('${bgImage}')` }}
        aria-hidden
      />
      <div
        className="pointer-events-none fixed inset-0 z-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,rgba(15,23,42,0.35)_50%,rgba(15,23,42,0.88)_100%)] dark:bg-[radial-gradient(ellipse_at_center,transparent_0%,rgba(2,6,23,0.5)_45%,rgba(2,6,23,0.92)_100%)]"
        aria-hidden
      />
      <div
        className="pointer-events-none fixed left-1/2 top-1/2 z-[1] -translate-x-1/2 -translate-y-1/2"
        aria-hidden
      >
        <div
          className={cn(
            'h-[min(72vw,520px)] w-[min(72vw,520px)]',
            orbitClassName,
            orbitOpacity,
          )}
        />
      </div>
    </>
  )
}
