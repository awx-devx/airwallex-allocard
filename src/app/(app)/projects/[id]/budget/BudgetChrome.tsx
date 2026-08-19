'use client'

import { useParams, usePathname } from 'next/navigation'
import type { ReactNode } from 'react'
import { BUDGET_NAV, budgetNavHref, isBudgetNavActive } from '@/client/lib/budget'
import { SubNav } from '@/components/patterns/SubNav'

export function BudgetChrome({ children }: { children: ReactNode }) {
  const raw = useParams().id
  const id = typeof raw === 'string' ? raw : Array.isArray(raw) ? (raw[0] ?? '') : ''
  const pathname = usePathname()

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <SubNav
        label="Budget"
        items={BUDGET_NAV.map((item) => {
          const href = id.length >= 1 ? budgetNavHref(id, item.suffix) : '#'
          const active = id.length >= 1 && isBudgetNavActive(pathname, id, item.suffix)
          return {
            href,
            label: item.label,
            active,
          }
        })}
      />
      <div className="min-w-0">{children}</div>
    </div>
  )
}
