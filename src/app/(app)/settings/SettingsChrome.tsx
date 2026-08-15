'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { ReactNode } from 'react'
import { SETTINGS_NAV } from '@/client/lib/access'
import { Button } from '@/components/ui/button'

export function SettingsChrome({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  return (
    <div className="flex min-w-0 flex-col gap-4">
      <nav className="flex flex-wrap gap-2" aria-label="Settings">
        {SETTINGS_NAV.map((item) => {
          const active = pathname === item.href
          return (
            <Button
              key={item.href}
              asChild
              variant="ghost"
              className={active ? 'bg-accent' : undefined}
            >
              <Link href={item.href}>{item.label}</Link>
            </Button>
          )
        })}
      </nav>
      <div className="min-w-0">{children}</div>
    </div>
  )
}
