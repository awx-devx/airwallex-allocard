import { z } from 'zod'
import { AccessReviewResolution, AccessReviewStatus } from '@/shared/enums/accessReviewStatus'
import { idSchema, isoDateSchema } from '@/shared/schemas/base'

/**
 * Minimal access-review item.
 * Flagged by rules (`flag.review`) or stale-scope heuristics; resolve confirms,
 * revokes, or dismisses. Subject is typically a project member.
 */
export const accessReviewSchema = z.object({
  id: idSchema,
  orgId: idSchema,
  projectId: idSchema,
  status: z.enum(AccessReviewStatus),
  /** Why this was flagged — human-readable. */
  reason: z.string().min(1).max(500),
  subjectType: z.literal('projectMember'),
  subjectId: idSchema,
  /** Denormalised for list UI — the member's userId. */
  userId: idSchema,
  flaggedAt: isoDateSchema,
  /** Null when raised by a rule/system. */
  flaggedBy: idSchema.nullable(),
  resolvedAt: isoDateSchema.nullable(),
  resolvedBy: idSchema.nullable(),
  resolution: z.enum(AccessReviewResolution).nullable(),
})

export const resolveAccessReviewInput = z.object({
  resolution: z.enum(AccessReviewResolution),
  note: z.string().max(500).optional(),
})

export const listAccessReviewsQuery = z.object({
  status: z.enum(AccessReviewStatus).optional(),
  projectId: idSchema.optional(),
})
