export const PurchaseRequestStatus = {
  DRAFT: 'DRAFT',
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  EXPIRED: 'EXPIRED',
  CANCELLED: 'CANCELLED',
} as const

export type PurchaseRequestStatus =
  (typeof PurchaseRequestStatus)[keyof typeof PurchaseRequestStatus]
