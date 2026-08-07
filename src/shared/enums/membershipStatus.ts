export const MembershipStatus = {
  ACTIVE: 'ACTIVE',
  SUSPENDED: 'SUSPENDED',
} as const

export type MembershipStatus = (typeof MembershipStatus)[keyof typeof MembershipStatus]
