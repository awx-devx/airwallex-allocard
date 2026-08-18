'use client'

import { usePathname } from 'next/navigation'
import { useState, type FocusEvent, type PointerEvent, type ReactNode } from 'react'
import { MenuIcon } from 'lucide-react'
import { ApprovalsBadge } from '@/client/shell/ApprovalsBadge'
import { BrandLogo } from '@/client/shell/BrandLogo'
import { OrgSwitcher } from '@/client/shell/OrgSwitcher'
import { ProjectContext } from '@/client/shell/ProjectContext'
import { SideNav, type SideNavItem } from '@/client/shell/SideNav'
import { ThemeToggle } from '@/client/shell/ThemeToggle'
import { UserMenu } from '@/client/shell/UserMenu'
import { useActiveOrg } from '@/client/providers/ActiveOrgProvider'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'

const DEFAULT_NAV: SideNavItem[] = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/projects', label: 'Projects' },
  { href: '/cards', label: 'Cards' },
  { href: '/requests', label: 'Requests' },
  { href: '/approvals', label: 'Approvals' },
  { href: '/activity', label: 'Activity' },
  { href: '/transactions', label: 'Transactions' },
  { href: '/receipts', label: 'Receipts' },
  { href: '/automation', label: 'Automation' },
  { href: '/reports', label: 'Reports' },
  { href: '/audit', label: 'Audit' },
  { href: '/settings/roles', label: 'Roles' },
  { href: '/settings/access-reviews', label: 'Access reviews' },
  { href: '/settings/rules', label: 'Rules' },
  { href: '/settings/attributes', label: 'Attributes' },
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
  const [rail, setRail] = useState({ hover: false, focus: false, org: false })
  const open = menu.open && menu.at === pathname
  const expanded = rail.hover || rail.focus || rail.org
  const items = navItems.map((item) =>
    item.href === '/approvals' ? { ...item, badge: approvalsCount } : item,
  )

  function focusRail(event: FocusEvent<HTMLElement>) {
    const target = event.target
    if (!(target instanceof HTMLElement) || !target.matches(':focus-visible')) return
    setRail((current) => ({ ...current, focus: true }))
  }

  function blurRail(event: FocusEvent<HTMLElement>) {
    const next = event.relatedTarget
    if (next instanceof Node && event.currentTarget.contains(next)) return
    setRail((current) => ({ ...current, focus: false }))
  }

  function leaveRail(event: PointerEvent<HTMLElement>) {
    const orgOpen = rail.org
    setRail((current) =>
      orgOpen ? { ...current, hover: false } : { ...current, hover: false, focus: false },
    )
    if (orgOpen) return
    const active = document.activeElement
    if (active instanceof HTMLElement && event.currentTarget.contains(active)) active.blur()
  }

  return (
    <div className="flex h-dvh overflow-hidden bg-background text-foreground">
      <aside className="relative hidden w-16 min-h-0 shrink-0 md:flex">
        <div
          className="group/sidenav absolute inset-y-0 left-0 z-20 flex w-16 min-h-0 flex-col gap-4 overflow-hidden border-r border-sidebar-border bg-sidebar/90 p-4 text-sidebar-foreground shadow-[var(--shadow-elevated)] backdrop-blur-sm transition-[width] duration-200 ease-out data-[expanded=true]:w-56"
          data-expanded={expanded ? 'true' : 'false'}
          onPointerEnter={() => setRail((current) => ({ ...current, hover: true }))}
          onPointerLeave={leaveRail}
          onFocusCapture={focusRail}
          onBlurCapture={blurRail}
        >
          <div className="shrink-0 overflow-hidden">
            <BrandLogo priority />
          </div>
          <div className="shrink-0">
            <OrgSwitcher
              memberships={memberships}
              activeOrgId={activeOrgId}
              onSwitch={(id) => setOrgId(id)}
              onOpenChange={(next) => setRail((current) => ({ ...current, org: next }))}
            />
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
            <SideNav items={items} />
          </div>
        </div>
      </aside>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-border/80 bg-card/60 px-4 py-3 shadow-[inset_0_-1px_0_0_hsl(var(--gloss-highlight)/0.35)] backdrop-blur-sm">
          <div className="flex min-w-0 items-center gap-3">
            <Button
              type="button"
              className="md:hidden"
              aria-label="Open menu"
              onClick={() => setMenu({ open: true, at: pathname })}
            >
              <MenuIcon className="size-4 shrink-0" aria-hidden />
              Menu
            </Button>
            <ProjectContext project={project} />
          </div>
          <div className="flex min-w-0 flex-wrap items-center justify-end gap-3">
            <ThemeToggle />
            <ApprovalsBadge count={approvalsCount} />
            <UserMenu user={user} onSignOut={onSignOut ?? (() => undefined)} />
          </div>
        </header>
        <main className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4">{children}</main>
      </div>
      <Sheet open={open} onOpenChange={(next) => setMenu({ open: next, at: pathname })}>
        <SheetContent side="left">
          <SheetHeader>
            <SheetTitle>Menu</SheetTitle>
          </SheetHeader>
          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden px-4 pb-4">
            <div className="shrink-0">
              <BrandLogo />
            </div>
            <div className="shrink-0">
              <OrgSwitcher
                memberships={memberships}
                activeOrgId={activeOrgId}
                onSwitch={(id) => setOrgId(id)}
              />
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
              <SideNav items={items} />
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}
