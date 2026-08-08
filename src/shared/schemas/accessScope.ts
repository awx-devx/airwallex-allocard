import { z } from 'zod'
import { AccessScopeLevel } from '@/shared/enums/accessScopeLevel'
import { idSchema, isoDateSchema } from '@/shared/schemas/base'

/**
 * Access scope on the wire — dates are ISO 8601.
 * Scope narrows which subjects a permission covers; it never adds permissions.
 */
export const accessScopeSchema = z.object({
  level: z.enum(AccessScopeLevel),
  workstreamIds: z.array(idSchema).optional(),
  categoryIds: z.array(idSchema).optional(),
  cardIds: z.array(idSchema).optional(),
  memberIds: z.array(idSchema).optional(),
  validFrom: isoDateSchema.optional(),
  validTo: isoDateSchema.optional(),
})
