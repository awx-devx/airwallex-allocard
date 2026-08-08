export const BudgetEntryType = {
  APPROVAL: 'APPROVAL',
  COMMITMENT: 'COMMITMENT',
  ACTUAL: 'ACTUAL',
  RELEASE: 'RELEASE',
  ADJUSTMENT: 'ADJUSTMENT',
} as const

export type BudgetEntryType = (typeof BudgetEntryType)[keyof typeof BudgetEntryType]
