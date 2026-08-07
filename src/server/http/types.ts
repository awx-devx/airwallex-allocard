import type { OrgRole } from '@/shared/enums/orgRole'

export type { OrgRole } from '@/shared/enums/orgRole'

export type OrgContext = {
  orgId: string
  userId: string
  orgRole: OrgRole
}

/** Session shape resolved before OrgContext is built. */
export type AuthSession = {
  userId: string
  orgId: string | null
  orgRole: OrgRole | null
  /** Derived: true iff the user has ≥1 ACTIVE membership. */
  onboarded: boolean
}
