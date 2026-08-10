import { z } from 'zod'
import {
  allowlistSchema,
  blockedTransactionUsageSchema,
  cardControlsSchema,
  createCardControlsInput,
  transactionLimitEntrySchema,
  transactionLimitsSchema,
  updateCardControlsInput,
} from '@/shared/schemas/cardControls'

export type Allowlist = z.infer<typeof allowlistSchema>
export type BlockedTransactionUsage = z.infer<typeof blockedTransactionUsageSchema>
export type TransactionLimitEntry = z.infer<typeof transactionLimitEntrySchema>
export type TransactionLimits = z.infer<typeof transactionLimitsSchema>
export type CardControls = z.infer<typeof cardControlsSchema>
export type CreateCardControlsInput = z.infer<typeof createCardControlsInput>
export type UpdateCardControlsInput = z.infer<typeof updateCardControlsInput>
