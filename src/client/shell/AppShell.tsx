'use client'

import type { ReactNode } from 'react'
import { ApprovalsBadge } from '@/client/shell/ApprovalsBadge'
import { OrgSwitcher } from '@/client/shell/OrgSwitcher'
import { ProjectContext } from '@/client/shell/ProjectContext'
import { SideNav, type SideNavItem } from '@/client/shell/SideNav'
import { UserMenu } from '@/client/shell/UserMenu'
import { useActiveOrg } from '@/client/providers/ActiveOrgProvider'

const DEFAULT_NAV: SideNavItem[] = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/projects', label: 'Projects' },
  { href: '/approvals', label: 'Approvals' },
  { href: '/activity', label: 'Activity' },
  { href: '/reports', label: 'Reports' },
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
  const items = navItems.map((item) =>
    item.href === '/approvals' ? { ...item, badge: approvalsCount } : item,
  )

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <aside className="flex w-56 shrink-0 flex-col gap-4 border-r border-sidebar-border bg-sidebar/90 p-4 text-sidebar-foreground shadow-[var(--shadow-elevated)] backdrop-blur-sm">
        <div className="text-sm font-semibold tracking-tight">Allocard</div>
        <OrgSwitcher
          memberships={memberships}
          activeOrgId={activeOrgId}
          onSwitch={(id) => setOrgId(id)}
        />
        <SideNav items={items} />
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between gap-3 border-b border-border/80 bg-card/60 px-4 py-3 shadow-[inset_0_-1px_0_0_hsl(var(--gloss-highlight)/0.35)] backdrop-blur-sm">
          <ProjectContext project={project} />
          <div className="flex items-center gap-3">
            <ApprovalsBadge count={approvalsCount} />
            <UserMenu user={user} onSignOut={onSignOut ?? (() => undefined)} />
          </div>
        </header>
        <main className="flex-1 p-4">{children}</main>
      </div>
    </div>
  )
}
