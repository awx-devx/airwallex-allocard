import Link from 'next/link'
import { Badge } from '@/components/ui/badge'

export type SideNavItem = {
  href: string
  label: string
  badge?: number
}

export function SideNav({ items }: { items: SideNavItem[] }) {
  return (
    <nav aria-label="Primary">
      <ul className="m-0 flex list-none flex-col gap-1 p-0">
        {items.map((item) => (
          <li key={item.href}>
            <Link
              href={item.href}
              className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground"
            >
              {item.label}
              {item.badge !== undefined && item.badge > 0 ? (
                <Badge variant="secondary">{item.badge}</Badge>
              ) : null}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  )
}
