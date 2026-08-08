export const BudgetEntrySourceType = {
  PURCHASE_REQUEST: 'PURCHASE_REQUEST',
  AUTHORIZATION: 'AUTHORIZATION',
  TRANSACTION: 'TRANSACTION',
  MANUAL: 'MANUAL',
  RULE: 'RULE',
} as const

export type BudgetEntrySourceType =
  (typeof BudgetEntrySourceType)[keyof typeof BudgetEntrySourceType]
