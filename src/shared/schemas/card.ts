import { z } from 'zod'
import { CardPurpose } from '@/shared/enums/cardPurpose'
import { CardStatus } from '@/shared/enums/cardStatus'
import { TransactionLimitInterval } from '@/shared/enums/transactionLimitInterval'
import { idSchema, isoDateSchema } from '@/shared/schemas/base'
import {
  cardControlsSchema,
  createCardControlsInput,
  updateCardControlsInput,
} from '@/shared/schemas/cardControls'

/**
 * Local card mirror. Never includes PAN, CVV, or expiry — only maskedNumber.
 * Amounts inside controls are integer minor units.
 */
export const cardSchema = z.object({
  id: idSchema,
  orgId: idSchema,
  projectId: idSchema.nullable(),
  categoryId: idSchema.nullable(),
  cardholderId: idSchema,
  airwallexCardId: z.string().min(1),
  /** Masked only, e.g. ************1234 — never a full PAN. */
  maskedNumber: z.string().min(1),
  nickName: z.string().min(1).max(100),
  purpose: z.enum(CardPurpose),
  status: z.enum(CardStatus),
  desiredControls: cardControlsSchema,
  appliedControls: cardControlsSchema,
  lastReconciledAt: isoDateSchema.nullable(),
  managedByRuleIds: z.array(idSchema),
  accessList: z.array(idSchema),
  createdAt: isoDateSchema,
  updatedAt: isoDateSchema,
})

export const createCardInput = z.object({
  purpose: z.enum(CardPurpose),
  cardholderId: idSchema,
  nickName: z.string().min(1).max(100).optional(),
  categoryId: idSchema.nullable().optional(),
  accessList: z.array(idSchema).optional(),
  desiredControls: createCardControlsInput,
})

export const updateCardInput = z
  .object({
    nickName: z.string().min(1).max(100).optional(),
    accessList: z.array(idSchema).optional(),
    desiredControls: updateCardControlsInput.optional(),
  })
  .refine(
    (value) =>
      value.nickName !== undefined ||
      value.accessList !== undefined ||
      value.desiredControls !== undefined,
    { message: 'At least one field is required' },
  )

/** Close requires explicit confirmation. */
export const closeCardInput = z.object({
  confirm: z.literal(true),
})

/** Short-lived Airwallex pantoken for the secure iframe — never includes PAN/CVV/expiry. */
export const panTokenOutput = z.object({
  token: z.string().min(1),
  expiresAt: isoDateSchema,
})

export const cardLimitEntrySchema = z.object({
  interval: z.enum(TransactionLimitInterval),
  /** Integer minor units. */
  amount: z.number().int().nonnegative(),
  /** Integer minor units remaining. */
  remaining: z.number().int(),
})

/** Live limits from Airwallex, converted to minor units for the client. */
export const cardLimitsOutput = z.object({
  currency: z.string().length(3),
  limits: z.array(cardLimitEntrySchema),
  cachedAt: isoDateSchema,
})

export const listCardsQuery = z.object({
  projectId: idSchema.optional(),
  status: z.enum(CardStatus).optional(),
  purpose: z.enum(CardPurpose).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
})

/** Project-scoped list — projectId is in the path, not the query. */
export const listProjectCardsQuery = z.object({
  status: z.enum(CardStatus).optional(),
  purpose: z.enum(CardPurpose).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
})

export const cardListSchema = z.object({
  items: z.array(cardSchema),
  page: z.number().int().min(1),
  pageSize: z.number().int().min(1),
  total: z.number().int().min(0),
})
