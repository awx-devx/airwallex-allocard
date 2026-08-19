'use client'

import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select'
import type { OrgRole } from '@/shared/enums/orgRole'

export type ShellMembership = {
  orgId: string
  name: string
  slug: string
  orgRole: OrgRole
}

export type OrgSwitcherProps = {
  memberships: ShellMembership[]
  activeOrgId: string | null
  onSwitch: (orgId: string) => void
  onOpenChange?: (open: boolean) => void
}

function orgRoleLabel(role: OrgRole): string {
  return role.charAt(0) + role.slice(1).toLowerCase()
}

export function OrgSwitcher({
  memberships,
  activeOrgId,
  onSwitch,
  onOpenChange,
}: OrgSwitcherProps) {
  const active = memberships.find((m) => m.orgId === activeOrgId)
  const activeName = active?.name ?? 'Organisation'
  const mark = activeName.trim().charAt(0).toUpperCase() || '?'

  return (
    <Select value={activeOrgId ?? undefined} onValueChange={onSwitch} onOpenChange={onOpenChange}>
      <SelectTrigger
        id="org-switcher"
        aria-label={activeName}
        title={activeName}
        size="sm"
        className="h-auto w-full justify-start gap-2 rounded-md border-0 bg-sidebar-foreground/[0.04] px-2 py-1.5 text-sidebar-foreground shadow-none hover:bg-sidebar-accent hover:text-sidebar-accent-foreground [&_svg]:text-sidebar-foreground/50 group-data-[expanded=false]/sidenav:[&_svg]:hidden"
      >
        <span
          aria-hidden
          className="grid size-[1.35rem] shrink-0 place-items-center rounded-[var(--radius-chip)] bg-sidebar-primary/18 text-[0.65rem] font-bold text-sidebar-primary"
        >
          {mark}
        </span>
        <span className="min-w-0 flex-1 text-left group-data-[expanded=false]/sidenav:hidden">
          <span className="block truncate text-xs font-semibold">{activeName}</span>
          {active ? (
            <span className="block truncate text-[0.65rem] text-sidebar-foreground/70">
              {orgRoleLabel(active.orgRole)}
            </span>
          ) : null}
        </span>
      </SelectTrigger>
      <SelectContent
        position="popper"
        side="right"
        align="start"
        sideOffset={8}
        className="min-w-48"
      >
        {memberships.map((m) => (
          <SelectItem key={m.orgId} value={m.orgId}>
            {m.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
