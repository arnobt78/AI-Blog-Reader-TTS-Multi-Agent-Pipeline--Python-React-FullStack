import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { Footer } from '@/components/layout/Footer'

type RootLayoutProps = {
  children: ReactNode
  className?: string
}

/**
 * Portfolio shell: max-w ~9xl (96rem), `min-h-dvh` column with main growing and footer at bottom center.
 */
export function RootLayout({ children, className }: RootLayoutProps) {
  return (
    <div
      className={cn(
        'mx-auto flex w-full min-h-[100dvh] max-w-[96rem] flex-col px-4 sm:px-6 lg:px-8',
        className,
      )}
    >
      <div className="flex min-h-0 flex-1 flex-col">{children}</div>
      <Footer />
    </div>
  )
}
