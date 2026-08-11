export const ExportKind = {
  BUDGET: 'BUDGET',
  TRANSACTIONS: 'TRANSACTIONS',
  CARDS: 'CARDS',
  AUDIT: 'AUDIT',
} as const

export type ExportKind = (typeof ExportKind)[keyof typeof ExportKind]
