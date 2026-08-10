import { z } from 'zod'
import { CardholderStatus } from '@/shared/enums/cardholderStatus'
import { CardholderType } from '@/shared/enums/cardholderType'
import { idSchema, isoDateSchema } from '@/shared/schemas/base'

export const cardholderSchema = z.object({
  id: idSchema,
  orgId: idSchema,
  /** Null for DELEGATE cardholders not tied to a user. */
  userId: idSchema.nullable(),
  airwallexCardholderId: z.string().min(1),
  type: z.enum(CardholderType),
  status: z.enum(CardholderStatus),
  createdAt: isoDateSchema,
  updatedAt: isoDateSchema,
})

/**
 * INDIVIDUAL requires userId; DELEGATE may omit (stored as null).
 */
export const createCardholderInput = z
  .object({
    userId: idSchema.optional(),
    type: z.enum(CardholderType),
  })
  .superRefine((value, ctx) => {
    if (value.type === CardholderType.INDIVIDUAL && value.userId === undefined) {
      ctx.addIssue({
        code: 'custom',
        path: ['userId'],
        message: 'userId is required for INDIVIDUAL cardholders',
      })
    }
  })

export const listCardholdersQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
})

export const cardholderListSchema = z.object({
  items: z.array(cardholderSchema),
  page: z.number().int().min(1),
  pageSize: z.number().int().min(1),
  total: z.number().int().min(0),
})
