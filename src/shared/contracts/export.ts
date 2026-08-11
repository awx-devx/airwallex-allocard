import { z } from 'zod'
import { defineContract } from '@/shared/contracts/types'
import { exportInput } from '@/shared/schemas/export'

/**
 * Export contracts use `output: z.void()`.
 * Handlers return streamed `text/csv` (ReadableStream), not a JSON body.
 */
export const exportContracts = {
  budget: defineContract({
    method: 'POST',
    path: '/api/exports/budget',
    input: exportInput,
    output: z.void(),
  }),
  transactions: defineContract({
    method: 'POST',
    path: '/api/exports/transactions',
    input: exportInput,
    output: z.void(),
  }),
  cards: defineContract({
    method: 'POST',
    path: '/api/exports/cards',
    input: exportInput,
    output: z.void(),
  }),
  audit: defineContract({
    method: 'POST',
    path: '/api/exports/audit',
    input: exportInput,
    output: z.void(),
  }),
} as const

export type ExportContracts = typeof exportContracts
