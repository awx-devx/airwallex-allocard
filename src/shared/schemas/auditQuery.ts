import { z } from 'zod'
import { ActorType } from '@/shared/enums/audit'
import { cursorPageSchema, idSchema, isoDateSchema } from '@/shared/schemas/base'

/**
 * Public audit list wire shape — distinct from the internal AuditLog model.
 * `before`/`after` are opaque diffs for the UI; `actorType` distinguishes RULE vs USER.
 */
export const auditEntrySchema = z.object({
  id: idSchema,
  orgId: idSchema,
  projectId: idSchema.nullable(),
  actorType: z.nativeEnum(ActorType),
  actorId: idSchema,
  action: z.string().min(1),
  subjectType: z.string().min(1),
  subjectId: idSchema,
  before: z.unknown().nullable(),
  after: z.unknown().nullable(),
  metadata: z.record(z.string(), z.unknown()),
  at: isoDateSchema,
})

/**
 * Audit list filters. Cursor is an opaque `{ at, id }` base64url encoding —
 * never an offset. `limit` coerced for GET query params.
 */
export const listAuditQuery = z.object({
  subjectType: z.string().min(1).optional(),
  subjectId: idSchema.optional(),
  actorId: idSchema.optional(),
  action: z.string().min(1).optional(),
  projectId: idSchema.optional(),
  from: isoDateSchema.optional(),
  to: isoDateSchema.optional(),
  cursor: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
})

export const auditPageSchema = cursorPageSchema(auditEntrySchema)
