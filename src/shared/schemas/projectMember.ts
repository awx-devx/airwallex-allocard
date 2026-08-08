import { z } from 'zod'
import { ActorType } from '@/shared/enums/audit'
import { accessScopeSchema } from '@/shared/schemas/accessScope'
import { idSchema, isoDateSchema } from '@/shared/schemas/base'
import { permissionSchema, roleSummarySchema } from '@/shared/schemas/role'
import { userSummarySchema } from '@/shared/schemas/user'

export const projectMemberSchema = z.object({
  id: idSchema,
  orgId: idSchema,
  projectId: idSchema,
  userId: idSchema,
  roleId: idSchema,
  scope: accessScopeSchema,
  /** Materialised cache — recomputed wholesale on role/scope/role-def changes. */
  effectivePermissions: z.array(permissionSchema),
  addedBy: idSchema,
  addedAt: isoDateSchema,
  removedAt: isoDateSchema.nullable().optional(),
})

/** List / detail row with populated role and user summaries. */
export const projectMemberDetailSchema = projectMemberSchema.extend({
  role: roleSummarySchema,
  user: userSummarySchema,
})

export const addProjectMemberInput = z.object({
  userId: idSchema,
  roleId: idSchema,
  scope: accessScopeSchema,
})

/** Named distinctly from org-membership `updateMemberInput`. */
export const updateProjectMemberInput = z
  .object({
    roleId: idSchema.optional(),
    scope: accessScopeSchema.optional(),
  })
  .refine((value) => value.roleId !== undefined || value.scope !== undefined, {
    message: 'At least one field is required',
  })

export const previewProjectMemberInput = z.object({
  roleId: idSchema,
  scope: accessScopeSchema,
})

/**
 * Structured reasons for every grant/denial — powers the preview UI and
 * makes 403s debuggable. Same shape as `computeEffectivePermissions` output.
 */
export const permissionReasonSchema = z.object({
  permission: permissionSchema,
  allowed: z.boolean(),
  message: z.string().min(1),
})

export const previewProjectMemberOutput = z.object({
  permissions: z.array(permissionSchema),
  scope: accessScopeSchema,
  reasons: z.array(permissionReasonSchema),
})

/** Audit-derived access-history row for a project (membership changes). */
export const accessHistoryEntrySchema = z.object({
  id: idSchema,
  action: z.string().min(1),
  actorType: z.nativeEnum(ActorType),
  actorId: idSchema,
  subjectType: z.string().min(1),
  subjectId: idSchema,
  before: z.unknown().optional(),
  after: z.unknown().optional(),
  metadata: z.record(z.string(), z.unknown()),
  at: isoDateSchema,
})
