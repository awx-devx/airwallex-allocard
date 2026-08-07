export const InviteStatus = {
  PENDING: 'PENDING',
  ACCEPTED: 'ACCEPTED',
  REVOKED: 'REVOKED',
  EXPIRED: 'EXPIRED',
} as const

export type InviteStatus = (typeof InviteStatus)[keyof typeof InviteStatus]
