import { z } from 'zod'
import { ActorType } from '@/shared/enums/audit'
import { ProjectStatus } from '@/shared/enums/projectStatus'
import { idSchema, isoDateSchema, moneySchema } from '@/shared/schemas/base'
import { budgetSnapshotSchema } from '@/shared/schemas/budget'

export const workstreamSchema = z.object({
  id: idSchema,
  name: z.string().min(1).max(120),
})

export const cardStructureSchema = z.object({
  shared: z.boolean(),
  perMember: z.boolean(),
  vendor: z.boolean(),
  oneTime: z.boolean(),
})

/**
 * Public project.
 * Drafts may leave owner/dates/cost centre null until the wizard fills them;
 * `projectReadyForApproval` enforces those at → PENDING_APPROVAL.
 */
export const projectSchema = z.object({
  id: idSchema,
  orgId: idSchema,
  name: z.string().min(1).max(120),
  code: z
    .string()
    .min(1)
    .max(64)
    .regex(/^[A-Za-z0-9]+(?:-[A-Za-z0-9]+)*$/, 'Code must be alphanumeric with hyphens'),
  description: z.string().max(2000),
  status: z.enum(ProjectStatus),
  ownerId: idSchema.nullable(),
  costCentre: z.string().min(1).nullable(),
  startDate: isoDateSchema.nullable(),
  endDate: isoDateSchema.nullable(),
  workstreams: z.array(workstreamSchema),
  cardStructure: cardStructureSchema,
  /**
   * Denormalised ledger projection. Null until the first budget ledger write.
   * Recomputed on every append; never sum the ledger on the hot path.
   */
  budgetSnapshot: budgetSnapshotSchema.nullable(),
  approvedAt: isoDateSchema.nullable(),
  launchedAt: isoDateSchema.nullable(),
  closedAt: isoDateSchema.nullable(),
  createdAt: isoDateSchema,
  updatedAt: isoDateSchema,
})

/** Overview counts for the workspace header / A3 overview — zeros/nulls until B3–B5/B7. */
export const projectOverviewSchema = z.object({
  memberCount: z.number().int().min(0),
  activeCardCount: z.number().int().min(0),
  pendingApprovalCount: z.number().int().min(0),
  alertCount: z.number().int().min(0),
  /** null until B4 budget exists */
  budgetRemaining: moneySchema.nullable(),
  budgetSpent: moneySchema.nullable(),
})

export const projectDetailSchema = projectSchema.extend({
  overview: projectOverviewSchema,
})

export const createProjectInput = z.object({
  name: z.string().min(1).max(120),
  code: projectSchema.shape.code,
  description: z.string().max(2000).optional(),
  ownerId: idSchema.optional(),
  costCentre: z.string().min(1).optional(),
  startDate: isoDateSchema.optional(),
  endDate: isoDateSchema.optional(),
  cardStructure: cardStructureSchema.partial().optional(),
})

/** Permissive wizard saves — status and workstreams change via their own endpoints. */
export const updateProjectInput = projectSchema
  .pick({
    name: true,
    code: true,
    description: true,
    costCentre: true,
    startDate: true,
    endDate: true,
    cardStructure: true,
  })
  .partial()
  .refine(
    (value) =>
      value.name !== undefined ||
      value.code !== undefined ||
      value.description !== undefined ||
      value.costCentre !== undefined ||
      value.startDate !== undefined ||
      value.endDate !== undefined ||
      value.cardStructure !== undefined,
    { message: 'At least one field is required' },
  )

/**
 * Strict readiness for DRAFT → PENDING_APPROVAL only.
 * Soft budget: `hasBudget` must be true; service stubs true until B4. TODO(B4) harden.
 */
export const projectReadyForApproval = z
  .object({
    name: z.string().min(1).max(120),
    ownerId: idSchema,
    startDate: isoDateSchema,
    endDate: isoDateSchema,
    /** Soft stand-in until B4 provides a real budget presence check. */
    hasBudget: z.boolean(),
  })
  .refine((value) => value.hasBudget, {
    message: 'Budget is required before submitting for approval',
    path: ['hasBudget'],
  })
  .refine((value) => value.endDate >= value.startDate, {
    message: 'endDate must be on or after startDate',
    path: ['endDate'],
  })

export const transitionProjectInput = z.object({
  to: z.enum(ProjectStatus),
  reason: z.string().max(500).optional(),
})

export const projectSortSchema = z.enum([
  'updatedAt',
  '-updatedAt',
  'name',
  '-name',
  'createdAt',
  '-createdAt',
  'startDate',
  '-startDate',
  'status',
  '-status',
])

export const listProjectsQuery = z.object({
  status: z.enum(ProjectStatus).optional(),
  ownerId: idSchema.optional(),
  costCentre: z.string().min(1).optional(),
  /** Coerced — GET query params arrive as strings. */
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  sort: projectSortSchema.optional(),
})

export const projectListSchema = z.object({
  items: z.array(projectSchema),
  page: z.number().int().min(1),
  pageSize: z.number().int().min(1),
  total: z.number().int().min(0),
})

export const createWorkstreamInput = z.object({
  name: z.string().min(1).max(120),
})

export const updateWorkstreamInput = z.object({
  name: z.string().min(1).max(120),
})

export const changeOwnerInput = z.object({
  ownerId: idSchema,
})

/** Audit-derived history row for a project. */
export const projectHistoryEntrySchema = z.object({
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
