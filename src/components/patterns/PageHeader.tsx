import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export function PageHeader({
  kicker,
  title,
  status,
  actions,
  className,
}: {
  kicker?: ReactNode
  title: ReactNode
  status?: ReactNode
  actions?: ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex min-w-0 flex-wrap items-start justify-between gap-3', className)}>
      <div className="min-w-0">
        {kicker ? (
          <p className="text-[0.625rem] font-semibold tracking-[0.16em] text-muted-foreground uppercase">
            {kicker}
          </p>
        ) : null}
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
          {status}
        </div>
      </div>
      {actions ? <div className="flex min-w-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  )
}
