'use client'

import Link from 'next/link'
import { useParams, usePathname } from 'next/navigation'
import type { ReactNode } from 'react'
import { BUDGET_NAV, budgetNavHref, isBudgetNavActive } from '@/client/lib/budget'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export function BudgetChrome({ children }: { children: ReactNode }) {
  const raw = useParams().id
  const id = typeof raw === 'string' ? raw : Array.isArray(raw) ? (raw[0] ?? '') : ''
  const pathname = usePathname()

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <nav className="flex flex-wrap gap-2" aria-label="Budget">
        {BUDGET_NAV.map((item) => {
          const href = id.length >= 1 ? budgetNavHref(id, item.suffix) : '#'
          const active = id.length >= 1 && isBudgetNavActive(pathname, id, item.suffix)
          return (
            <Link
              key={item.suffix || 'overview'}
              href={href}
              className={cn(buttonVariants({ variant: 'ghost' }), active && 'bg-accent')}
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
