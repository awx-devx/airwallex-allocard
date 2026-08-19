'use client'

import { MenuIcon } from 'lucide-react'
import { AppBreadcrumbs } from '@/client/shell/AppBreadcrumbs'
import { ApprovalsBadge } from '@/client/shell/ApprovalsBadge'
import { ThemeToggle } from '@/client/shell/ThemeToggle'
import { UserMenu } from '@/client/shell/UserMenu'
import { Button } from '@/components/ui/button'

export type AppHeaderProps = {
  user: { name: string; email: string; image?: string }
  approvalsCount: number
  projectName?: string
  onSignOut: () => void
  onOpenMenu: () => void
}

export function AppHeader({
  user,
  approvalsCount,
  projectName,
  onSignOut,
  onOpenMenu,
}: AppHeaderProps) {
  return (
    <header className="relative z-1 shrink-0 border-b border-border bg-background/95 px-4 py-2.5 backdrop-blur-xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <Button
            type="button"
            variant="secondary"
            className="md:hidden"
            aria-label="Open menu"
            onClick={onOpenMenu}
          >
            <MenuIcon className="size-4 shrink-0" aria-hidden />
            Menu
          </Button>
          <AppBreadcrumbs projectName={projectName} />
        </div>
        <div className="flex min-w-0 flex-wrap items-center justify-end gap-3">
          <ThemeToggle />
          <ApprovalsBadge count={approvalsCount} />
          <UserMenu user={user} onSignOut={onSignOut} />
        </div>
      </div>
    </header>
  )
}
