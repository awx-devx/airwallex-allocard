/** Immutable after card create. VENDOR/ONE_TIME → SINGLE; SHARED/MEMBER → MULTIPLE. */
export const AllowedTransactionCount = {
  SINGLE: 'SINGLE',
  MULTIPLE: 'MULTIPLE',
} as const

export type AllowedTransactionCount =
  (typeof AllowedTransactionCount)[keyof typeof AllowedTransactionCount]
