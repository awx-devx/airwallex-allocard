'use client'

import { usePathname } from 'next/navigation'
import { useState, type ReactNode } from 'react'
import { ApprovalsBadge } from '@/client/shell/ApprovalsBadge'
import { OrgSwitcher } from '@/client/shell/OrgSwitcher'
import { ProjectContext } from '@/client/shell/ProjectContext'
import { SideNav, type SideNavItem } from '@/client/shell/SideNav'
import { UserMenu } from '@/client/shell/UserMenu'
import { useActiveOrg } from '@/client/providers/ActiveOrgProvider'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'

const DEFAULT_NAV: SideNavItem[] = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/projects', label: 'Projects' },
  { href: '/approvals', label: 'Approvals' },
  { href: '/activity', label: 'Activity' },
  { href: '/reports', label: 'Reports' },
  { href: '/settings/roles', label: 'Roles' },
  { href: '/settings/access-reviews', label: 'Access reviews' },
]

export type AppShellProps = {
  children: ReactNode
  memberships: { orgId: string; name: string; slug: string }[]
  activeOrgId: string | null
  user: { name: string; email: string; image?: string }
  approvalsCount: number
  project?: { id: string; name: string; code: string; status: string } | null
  navItems?: SideNavItem[]
  onSignOut?: () => void
}

export function AppShell({
  children,
  memberships,
  activeOrgId,
  user,
  approvalsCount,
  project = null,
  navItems = DEFAULT_NAV,
  onSignOut,
}: AppShellProps) {
  const { setOrgId } = useActiveOrg()
  const pathname = usePathname()
  const [menu, setMenu] = useState({ open: false, at: pathname })
  const open = menu.open && menu.at === pathname
  const items = navItems.map((item) =>
    item.href === '/approvals' ? { ...item, badge: approvalsCount } : item,
  )

  const orgSwitcher = (
    <OrgSwitcher
      memberships={memberships}
      activeOrgId={activeOrgId}
      onSwitch={(id) => setOrgId(id)}
    />
  )

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <aside className="hidden w-56 shrink-0 flex-col gap-4 border-r border-sidebar-border bg-sidebar/90 p-4 text-sidebar-foreground shadow-[var(--shadow-elevated)] backdrop-blur-sm md:flex">
        <div className="text-sm font-semibold tracking-tight">Allocard</div>
        {orgSwitcher}
        <SideNav items={items} />
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between gap-3 border-b border-border/80 bg-card/60 px-4 py-3 shadow-[inset_0_-1px_0_0_hsl(var(--gloss-highlight)/0.35)] backdrop-blur-sm">
          <div className="flex min-w-0 items-center gap-3">
            <Button
              type="button"
              className="md:hidden"
              aria-label="Open menu"
              onClick={() => setMenu({ open: true, at: pathname })}
            >
              Menu
            </Button>
            <ProjectContext project={project} />
          </div>
          <div className="flex items-center gap-3">
            <ApprovalsBadge count={approvalsCount} />
            <UserMenu user={user} onSignOut={onSignOut ?? (() => undefined)} />
          </div>
        </header>
        <main className="flex-1 p-4">{children}</main>
      </div>
      <Sheet open={open} onOpenChange={(next) => setMenu({ open: next, at: pathname })}>
        <SheetContent side="left">
          <SheetHeader>
            <SheetTitle>Menu</SheetTitle>
          </SheetHeader>
          <div className="flex flex-col gap-4 px-4 pb-4">
            <OrgSwitcher
              memberships={memberships}
              activeOrgId={activeOrgId}
              onSwitch={(id) => setOrgId(id)}
            />
            <SideNav items={items} />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}
