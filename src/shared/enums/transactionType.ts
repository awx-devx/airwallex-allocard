/**
 * Domain transaction / card-transaction-event types.
 * Core three match ARCHITECTURE §5; ledger-mapping subtypes from
 * AIRWALLEX-INTEGRATION §5 are included so B8.4 can switch without inventing strings.
 */
export const TransactionType = {
  AUTHORIZATION: 'AUTHORIZATION',
  CLEARING: 'CLEARING',
  REVERSAL_AUTH: 'REVERSAL_AUTH',
  INCREMENTAL_AUTHORIZATION: 'INCREMENTAL_AUTHORIZATION',
  PARTIAL_REVERSAL: 'PARTIAL_REVERSAL',
  PARTIAL_CLEARING: 'PARTIAL_CLEARING',
  EXPIRED_AUTHORIZATION: 'EXPIRED_AUTHORIZATION',
  CLEARING_REVERSAL: 'CLEARING_REVERSAL',
} as const

export type TransactionType = (typeof TransactionType)[keyof typeof TransactionType]
