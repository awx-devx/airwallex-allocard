export const CardholderStatus = {
  INCOMPLETE: 'INCOMPLETE',
  PENDING: 'PENDING',
  READY: 'READY',
  DISABLED: 'DISABLED',
  DELETED: 'DELETED',
} as const

export type CardholderStatus = (typeof CardholderStatus)[keyof typeof CardholderStatus]
