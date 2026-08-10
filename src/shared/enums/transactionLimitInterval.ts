export const TransactionLimitInterval = {
  PER_TRANSACTION: 'PER_TRANSACTION',
  DAILY: 'DAILY',
  WEEKLY: 'WEEKLY',
  MONTHLY: 'MONTHLY',
  QUARTERLY: 'QUARTERLY',
  YEARLY: 'YEARLY',
  ALL_TIME: 'ALL_TIME',
} as const

export type TransactionLimitInterval =
  (typeof TransactionLimitInterval)[keyof typeof TransactionLimitInterval]
