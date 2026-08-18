'use client'

import { Avatar } from '@/components/ui/avatar'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

export type OrgSwitcherProps = {
  memberships: { orgId: string; name: string; slug: string }[]
  activeOrgId: string | null
  onSwitch: (orgId: string) => void
  onOpenChange?: (open: boolean) => void
}

export function OrgSwitcher({
  memberships,
  activeOrgId,
  onSwitch,
  onOpenChange,
}: OrgSwitcherProps) {
  const activeName = memberships.find((m) => m.orgId === activeOrgId)?.name ?? 'Organisation'

  return (
    <Select value={activeOrgId ?? undefined} onValueChange={onSwitch} onOpenChange={onOpenChange}>
      <SelectTrigger
        id="org-switcher"
        aria-label={activeName}
        title={activeName}
        size="sm"
        className="h-8 w-full justify-start gap-2 rounded-md border-0 bg-transparent px-2 py-1 shadow-none hover:bg-accent hover:text-accent-foreground dark:bg-transparent dark:hover:bg-accent/50 group-data-[expanded=false]/sidenav:[&_svg]:hidden group-data-[expanded=false]/sidenav:[&_[data-slot=select-value]]:hidden"
      >
        <Avatar alt={activeName} name={activeName} size="sm" aria-hidden />
        <SelectValue placeholder="Select organisation" />
      </SelectTrigger>
      <SelectContent>
        {memberships.map((m) => (
          <SelectItem key={m.orgId} value={m.orgId}>
            {m.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
