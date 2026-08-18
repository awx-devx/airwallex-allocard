'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { activeNavHref } from '@/client/shell/navActive'
import { navIcon } from '@/client/shell/navIcons'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

export type SideNavItem = {
  href: string
  label: string
  badge?: number
}

export function SideNav({ items }: { items: SideNavItem[] }) {
  const pathname = usePathname()
  const selected = activeNavHref(
    pathname,
    items.map((item) => item.href),
  )

  return (
    <nav aria-label="Primary">
      <ul className="m-0 flex list-none flex-col gap-1 p-0">
        {items.map((item) => {
          const Icon = navIcon(item.href)
          const active = item.href === selected
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                title={item.label}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex h-8 items-center gap-2 rounded-md px-2 text-sm hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                  active && 'bg-sidebar-accent text-sidebar-accent-foreground',
                )}
              >
                {Icon ? <Icon className="size-4 shrink-0" aria-hidden /> : null}
                <span className="min-w-0 flex-1 truncate group-data-[expanded=false]/sidenav:hidden">
                  {item.label}
                </span>
                {item.badge !== undefined && item.badge > 0 ? (
                  <Badge variant="secondary" className="group-data-[expanded=false]/sidenav:hidden">
                    {item.badge}
                  </Badge>
                ) : null}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
