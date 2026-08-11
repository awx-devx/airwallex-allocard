import { z } from 'zod'
import { ActivityItemType } from '@/shared/enums/activityItemType'
import { ActorType } from '@/shared/enums/audit'
import { cursorPageSchema, idSchema, isoDateSchema } from '@/shared/schemas/base'

/**
 * Unified activity feed row. `payload` holds small denormalised facts for the UI;
 * do not dump full domain documents here.
 */
export const activityItemSchema = z.object({
  id: idSchema,
  orgId: idSchema,
  projectId: idSchema.nullable(),
  type: z.enum(ActivityItemType),
  at: isoDateSchema,
  actorType: z.nativeEnum(ActorType),
  actorId: idSchema,
  subjectType: z.string().min(1),
  subjectId: idSchema,
  summary: z.string().min(1).max(500),
  payload: z.record(z.string(), z.unknown()),
})

/**
 * Activity list filters. Cursor is an opaque `{ at, id }` base64url encoding —
 * never an offset. `limit` coerced for GET query params.
 */
export const listActivityQuery = z.object({
  type: z.enum(ActivityItemType).optional(),
  actorId: idSchema.optional(),
  projectId: idSchema.optional(),
  from: isoDateSchema.optional(),
  to: isoDateSchema.optional(),
  cursor: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
})

export const activityPageSchema = cursorPageSchema(activityItemSchema)
