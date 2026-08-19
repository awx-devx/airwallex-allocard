import Link from 'next/link'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

export type SubNavItem = {
  href: string
  label: string
  active: boolean
  icon?: LucideIcon
}

export function SubNav({ label, items }: { label: string; items: SubNavItem[] }) {
  return (
    <nav
      className="flex w-fit max-w-full shrink-0 flex-wrap gap-1 rounded-lg border border-border bg-muted p-1"
      aria-label={label}
    >
      {items.map((item) => {
        const Icon = item.icon
        return (
          <Link
            key={`${item.href}-${item.label}`}
            href={item.href}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium',
              item.active
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:bg-background/80 hover:text-foreground',
            )}
          >
            {Icon ? <Icon className="size-4 shrink-0" aria-hidden /> : null}
            {item.label}
          </Link>
        )
      })}
    </nav>
  )
}
