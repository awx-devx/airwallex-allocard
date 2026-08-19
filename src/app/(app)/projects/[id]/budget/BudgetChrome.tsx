'use client'

import Link from 'next/link'
import { useParams, usePathname } from 'next/navigation'
import type { ReactNode } from 'react'
import { BUDGET_NAV, budgetNavHref, isBudgetNavActive } from '@/client/lib/budget'
import { cn } from '@/lib/utils'

export function BudgetChrome({ children }: { children: ReactNode }) {
  const raw = useParams().id
  const id = typeof raw === 'string' ? raw : Array.isArray(raw) ? (raw[0] ?? '') : ''
  const pathname = usePathname()

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <nav
        className="flex w-fit max-w-full flex-wrap gap-1 rounded-md bg-muted/70 p-1"
        aria-label="Budget"
      >
        {BUDGET_NAV.map((item) => {
          const href = id.length >= 1 ? budgetNavHref(id, item.suffix) : '#'
          const active = id.length >= 1 && isBudgetNavActive(pathname, id, item.suffix)
          return (
            <Link
              key={item.suffix || 'overview'}
              href={href}
              className={cn(
                'rounded-[var(--radius-chip)] px-3 py-1.5 text-sm',
                active
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {item.label}
            </Link>
          )
        })}
      </nav>
      <div className="min-w-0">{children}</div>
    </div>
  )
}
