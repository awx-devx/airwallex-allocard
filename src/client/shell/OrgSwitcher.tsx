'use client'

import { Label } from '@/components/ui/label'
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
}

export function OrgSwitcher({ memberships, activeOrgId, onSwitch }: OrgSwitcherProps) {
  return (
    <div className="flex flex-col gap-1">
      <Label htmlFor="org-switcher">Organisation</Label>
      <Select value={activeOrgId ?? undefined} onValueChange={onSwitch}>
        <SelectTrigger id="org-switcher" className="w-full" size="sm">
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
    </div>
  )
}
