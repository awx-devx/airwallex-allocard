/**
 * Mirrors Airwallex card-transaction status (lifecycle model / v2).
 * AUTHORIZED is non-terminal; all others are terminal.
 * @see https://www.airwallex.com/docs/issuing/transactions/transaction-lifecycle
 */
export const TransactionStatus = {
  AUTHORIZED: 'AUTHORIZED',
  VERIFIED: 'VERIFIED',
  CLEARED: 'CLEARED',
  REVERSED: 'REVERSED',
  EXPIRED: 'EXPIRED',
  DECLINED: 'DECLINED',
} as const

export type TransactionStatus = (typeof TransactionStatus)[keyof typeof TransactionStatus]
