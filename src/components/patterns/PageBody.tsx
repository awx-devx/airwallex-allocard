import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

/** List pages: at least the visible `main` height so tables can fill leftover space. */
export function PageFill({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('flex min-h-full min-w-0 flex-col gap-4', className)}>{children}</div>
}

/** Detail / form pages: stacked content; `main` page-scrolls when they run long. */
export function PageFlow({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('flex min-w-0 flex-col gap-4', className)}>{children}</div>
}
