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
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <aside
        style={{
          width: 220,
          borderRight: '1px solid #ddd',
          padding: 16,
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
        }}
      >
        <div style={{ fontWeight: 700 }}>Allocard</div>
        <OrgSwitcher
          memberships={memberships}
          activeOrgId={activeOrgId}
          onSwitch={(id) => setOrgId(id)}
        />
        <SideNav items={items} />
      </aside>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <header
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            borderBottom: '1px solid #ddd',
            padding: '12px 16px',
            gap: 12,
          }}
        >
          <ProjectContext project={project} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <ApprovalsBadge count={approvalsCount} />
            <UserMenu user={user} onSignOut={onSignOut ?? (() => undefined)} />
          </div>
        </header>
        <main style={{ padding: 16, flex: 1 }}>{children}</main>
      </div>
    </div>
  )
}
