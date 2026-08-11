import Link from 'next/link'

export type SideNavItem = {
  href: string
  label: string
  badge?: number
}

export function SideNav({ items }: { items: SideNavItem[] }) {
  return (
    <nav aria-label="Primary">
      <ul
        style={{
          listStyle: 'none',
          padding: 0,
          margin: 0,
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        }}
      >
        {items.map((item) => (
          <li key={item.href}>
            <Link href={item.href}>
              {item.label}
              {item.badge !== undefined && item.badge > 0 ? ` (${item.badge})` : ''}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  )
}
