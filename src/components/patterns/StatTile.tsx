import Link from 'next/link'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

/** Compact fact cell — label + value, not a padded Card. */
export function StatTile({
  label,
  children,
  href,
  className,
}: {
  label: string
  children: ReactNode
  href?: string
  className?: string
}) {
  const body = (
    <>
      <p className="text-[0.625rem] font-semibold tracking-[0.16em] text-muted-foreground uppercase">
        {label}
      </p>
      <div className="min-w-0 text-sm">{children}</div>
    </>
  )
  const cls = cn(
    'flex min-w-0 flex-col justify-center gap-1 rounded-lg border bg-card px-3 py-2.5 shadow-[var(--shadow-glass)]',
    href ? 'hover:bg-muted/40' : null,
    className,
  )
  if (href) {
    return (
      <Link href={href} className={cls}>
        {body}
      </Link>
    )
  }
  return <div className={cls}>{body}</div>
}
