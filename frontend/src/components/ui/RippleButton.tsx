import {
  useCallback,
  useId,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type MouseEvent,
  type ReactNode,
} from 'react'
import { cn } from '@/lib/utils'

type Ripple = { id: string; x: number; y: number }

export type RippleButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode
  className?: string
  /**
   * Renders an inner sweep layer (z between gradient and label) so the highlight is visible;
   * wrapper-only ::after often ends up behind an opaque button — see docs/RIPPLE_BUTTON_EFFECT.md.
   */
  enableCtaShine?: boolean
}

/**
 * Material-style ripple on click: spawns a circle at the pointer, scales up, fades out, then unmounts.
 * Ripple nodes use `pointer-events: none` so they never steal clicks from the real button.
 * Coordinates are relative to the button via `getBoundingClientRect()` (client-space math).
 */
export function RippleButton({
  children,
  className,
  onClick,
  type = 'button',
  enableCtaShine = false,
  ...props
}: RippleButtonProps) {
  const [ripples, setRipples] = useState<Ripple[]>([])
  const idPrefix = useId()
  const seq = useRef(0)

  const addRipple = useCallback((clientX: number, clientY: number, el: HTMLButtonElement) => {
    const rect = el.getBoundingClientRect()
    const x = clientX - rect.left
    const y = clientY - rect.top
    const id = `${idPrefix}-${seq.current++}`
    setRipples((r) => [...r, { id, x, y }])
  }, [idPrefix])

  const handleClick = (e: MouseEvent<HTMLButtonElement>) => {
    addRipple(e.clientX, e.clientY, e.currentTarget)
    onClick?.(e)
  }

  return (
    <button
      type={type}
      className={cn(
        'relative inline-flex touch-manipulation items-center justify-center gap-2 overflow-hidden',
        className,
      )}
      onClick={handleClick}
      {...props}
    >
      {enableCtaShine && (
        <span
          className="pointer-events-none absolute inset-0 z-[1] overflow-hidden rounded-[inherit]"
          aria-hidden
        >
          <span className="cta-shine-stripe" />
        </span>
      )}
      {ripples.map((r) => (
        <span
          key={r.id}
          className="pointer-events-none absolute z-[5] rounded-full bg-white/50 shadow-[0_0_24px_rgba(255,255,255,0.55)] ring-2 ring-white/35 animate-ripple-expand will-change-transform"
          style={{
            left: r.x,
            top: r.y,
            width: 12,
            height: 12,
            marginLeft: -6,
            marginTop: -6,
          }}
          onAnimationEnd={() => {
            setRipples((prev) => prev.filter((x) => x.id !== r.id))
          }}
        />
      ))}
      <span className="relative z-[3] inline-flex items-center justify-center gap-2">{children}</span>
    </button>
  )
}
