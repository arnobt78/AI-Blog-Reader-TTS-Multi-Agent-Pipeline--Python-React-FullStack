import {
  useCallback,
  useState,
  type ImgHTMLAttributes,
  type SyntheticEvent,
} from 'react'
import { cn } from '@/lib/utils'

export type SafeImageProps = Omit<ImgHTMLAttributes<HTMLImageElement>, 'src'> & {
  src: string
  /** If primary `src` fails (404, CORS, etc.), try this URL once. */
  fallbackSrc?: string
}

/**
 * Vite-friendly “safe image” (see `docs/SAFE_IMAGE_REUSABLE_COMPONENT.md` — Next version uses `next/image`).
 * Uses native `<img>` only: on first `onError`, swaps to `fallbackSrc` or calls your `onError` handler.
 */
export function SafeImage({ src, fallbackSrc, alt, className, onError, ...rest }: SafeImageProps) {
  const [current, setCurrent] = useState(src)
  const [triedFallback, setTriedFallback] = useState(false)

  const handleError = useCallback(
    (e: SyntheticEvent<HTMLImageElement, Event>) => {
      if (!triedFallback && fallbackSrc && current !== fallbackSrc) {
        setTriedFallback(true)
        setCurrent(fallbackSrc)
        return
      }
      onError?.(e)
    },
    [triedFallback, fallbackSrc, current, onError],
  )

  if (!current) return null

  return (
    <img
      src={current}
      alt={alt}
      className={cn(className)}
      onError={handleError}
      {...rest}
    />
  )
}
