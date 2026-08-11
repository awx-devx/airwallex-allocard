export const ActivityItemType = {
  TRANSACTION: 'TRANSACTION',
  PURCHASE_REQUEST: 'PURCHASE_REQUEST',
  APPROVAL: 'APPROVAL',
  CARD: 'CARD',
  ACCESS: 'ACCESS',
  RULE_RUN: 'RULE_RUN',
  AUDIT: 'AUDIT',
} as const

export type ActivityItemType = (typeof ActivityItemType)[keyof typeof ActivityItemType]
