'use client'

export type OrgSwitcherProps = {
  memberships: { orgId: string; name: string; slug: string }[]
  activeOrgId: string | null
  onSwitch: (orgId: string) => void
}

export function OrgSwitcher({ memberships, activeOrgId, onSwitch }: OrgSwitcherProps) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 14 }}>
      <span>Organisation</span>
      <select
        value={activeOrgId ?? ''}
        onChange={(e) => {
          if (e.target.value) onSwitch(e.target.value)
        }}
      >
        {memberships.map((m) => (
          <option key={m.orgId} value={m.orgId}>
            {m.name}
          </option>
        ))}
      </select>
    </label>
  )
}
