export const ClosureBlockingKind = {
  OPEN_TRANSACTION: 'OPEN_TRANSACTION',
  PENDING_AUTHORIZATION: 'PENDING_AUTHORIZATION',
  PENDING_REQUEST: 'PENDING_REQUEST',
  ACTIVE_CARD: 'ACTIVE_CARD',
  ACTIVE_ACCESS: 'ACTIVE_ACCESS',
} as const

export type ClosureBlockingKind = (typeof ClosureBlockingKind)[keyof typeof ClosureBlockingKind]
