'use client'

import { Progress as ProgressPrimitive } from 'radix-ui'
import { cn } from '@/lib/utils'

function Progress({
  className,
  value = 0,
  ...props
}: React.ComponentProps<typeof ProgressPrimitive.Root>) {
  const raw = typeof value === 'number' ? value : 0
  const isOver = raw > 100
  const clamped = Math.min(Math.max(raw, 0), 100)

  return (
    <ProgressPrimitive.Root
      data-slot="progress"
      value={clamped}
      className={cn('relative h-2 w-full overflow-hidden rounded-full bg-primary/20', className)}
      {...props}
    >
      <ProgressPrimitive.Indicator
        data-slot="progress-indicator"
        className={cn(
          'h-full w-full flex-1 transition-all',
          isOver ? 'bg-status-danger' : 'bg-primary',
        )}
        style={{ transform: `translateX(-${100 - clamped}%)` }}
      />
    </ProgressPrimitive.Root>
  )
}

export { Progress }
