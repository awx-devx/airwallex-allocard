export const BudgetChangeRequestStatus = {
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
} as const

export type BudgetChangeRequestStatus =
  (typeof BudgetChangeRequestStatus)[keyof typeof BudgetChangeRequestStatus]
