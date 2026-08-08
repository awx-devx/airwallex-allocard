import { z } from 'zod'
import { ActorType } from '@/shared/enums/audit'
import { BudgetChangeRequestStatus } from '@/shared/enums/budgetChangeRequestStatus'
import { BudgetEntrySourceType } from '@/shared/enums/budgetEntrySourceType'
import { BudgetEntryType } from '@/shared/enums/budgetEntryType'
import { idSchema, isoDateSchema } from '@/shared/schemas/base'

/** Default utilisation % boundaries for threshold crossing. */
export const DEFAULT_BUDGET_THRESHOLD_PCTS = [80, 90, 100] as const

export const budgetCategorySchema = z.object({
  id: idSchema,
  name: z.string().min(1).max(120),
  workstreamId: idSchema.nullable().optional(),
  /** Integer minor units. */
  allocated: z.number().int().nonnegative(),
  formula: z.string().nullable().optional(),
})

/**
 * Project budget header + embedded categories.
 * Amounts are integer minor units; currency is ISO 4217.
 */
export const budgetSchema = z.object({
  id: idSchema,
  orgId: idSchema,
  projectId: idSchema,
  currency: z.string().length(3),
  /** Integer minor units. */
  approvedAmount: z.number().int().nonnegative(),
  formula: z.string().nullable().optional(),
  categories: z.array(budgetCategorySchema),
  /** Utilisation % boundaries; default [80, 90, 100]. */
  thresholdPcts: z.array(z.number().int().min(1).max(1000)),
  createdAt: isoDateSchema,
  updatedAt: isoDateSchema,
})

/**
 * Derived ledger projection.
 * `remaining` may be negative; never clamp.
 * `utilisationPct` = floor((committed+actual)*100/approved); if approved===0
 * then (committed+actual>0 ? 100 : 0).
 */
export const budgetProjectionSchema = z.object({
  approved: z.number().int(),
  committed: z.number().int(),
  actual: z.number().int(),
  remaining: z.number().int(),
  utilisationPct: z.number().int().nonnegative(),
  overCommitted: z.boolean(),
  updatedAt: isoDateSchema,
})

/** Same shape as projection — stored on Project until first ledger write is null. */
export const budgetSnapshotSchema = budgetProjectionSchema

/** GET budget response. `budget` is null before the first PUT. */
export const budgetDetailSchema = z.object({
  budget: budgetSchema.nullable(),
  projection: budgetProjectionSchema,
})

export const putBudgetInput = z.object({
  currency: z.string().length(3),
  approvedAmount: z.number().int().nonnegative(),
  formula: z.string().nullable().optional(),
  thresholdPcts: z.array(z.number().int().min(1).max(1000)).optional(),
})

/**
 * Create category. If both `allocated` and `formula` are set, the service
 * evaluates the formula and writes the result into `allocated`.
 */
export const createBudgetCategoryInput = z.object({
  name: z.string().min(1).max(120),
  workstreamId: idSchema.nullable().optional(),
  allocated: z.number().int().nonnegative(),
  formula: z.string().nullable().optional(),
})

export const updateBudgetCategoryInput = z
  .object({
    name: z.string().min(1).max(120).optional(),
    workstreamId: idSchema.nullable().optional(),
    allocated: z.number().int().nonnegative().optional(),
    formula: z.string().nullable().optional(),
  })
  .refine(
    (value) =>
      value.name !== undefined ||
      value.workstreamId !== undefined ||
      value.allocated !== undefined ||
      value.formula !== undefined,
    { message: 'At least one field is required' },
  )

/**
 * Append-only ledger entry.
 * `amount` may be signed for ADJUSTMENT; APPROVAL/COMMITMENT/ACTUAL/RELEASE
 * are nonnegative at the service layer. `lifecycleId` is null until B8.
 */
export const budgetEntrySchema = z.object({
  id: idSchema,
  orgId: idSchema,
  projectId: idSchema,
  categoryId: idSchema.nullable(),
  type: z.enum(BudgetEntryType),
  amount: z.number().int(),
  currency: z.string().length(3),
  sourceType: z.enum(BudgetEntrySourceType),
  sourceId: idSchema,
  lifecycleId: idSchema.nullable(),
  createdBy: idSchema,
  note: z.string().nullable(),
  createdAt: isoDateSchema,
})

export const listBudgetEntriesQuery = z.object({
  type: z.enum(BudgetEntryType).optional(),
  from: isoDateSchema.optional(),
  to: isoDateSchema.optional(),
  /** Coerced — GET query params arrive as strings. */
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
})

export const budgetEntryListSchema = z.object({
  items: z.array(budgetEntrySchema),
  page: z.number().int().min(1),
  pageSize: z.number().int().min(1),
  total: z.number().int().min(0),
})

/**
 * Public manual adjustment only — service forces type=ADJUSTMENT, sourceType=MANUAL.
 * Contract intentionally omits `type` so COMMITMENT/ACTUAL cannot be posted.
 */
export const createBudgetEntryInput = z.object({
  amount: z.number().int(),
  note: z.string().nullable().optional(),
  categoryId: idSchema.nullable().optional(),
})

export const budgetChangeRequestSchema = z.object({
  id: idSchema,
  orgId: idSchema,
  projectId: idSchema,
  requestedBy: idSchema,
  /** Nonzero integer minor units; may be negative. */
  deltaAmount: z.number().int(),
  reason: z.string().min(1).max(2000),
  status: z.enum(BudgetChangeRequestStatus),
  decidedBy: idSchema.nullable(),
  decidedAt: isoDateSchema.nullable(),
  createdAt: isoDateSchema,
  updatedAt: isoDateSchema,
})

export const createBudgetChangeRequestInput = z.object({
  deltaAmount: z
    .number()
    .int()
    .refine((n) => n !== 0, { message: 'deltaAmount must be nonzero' }),
  reason: z.string().min(1).max(2000),
})

export const decideBudgetChangeRequestInput = z.object({
  decision: z.enum(['APPROVE', 'REJECT']),
  note: z.string().nullable().optional(),
})

export const validateFormulaInput = z.object({
  expression: z.string().max(500),
  context: z.record(z.string(), z.number().int()).optional(),
})

export const validateFormulaOutput = z.discriminatedUnion('ok', [
  z.object({
    ok: z.literal(true),
    value: z.number().int(),
  }),
  z.object({
    ok: z.literal(false),
    error: z.string(),
  }),
])

/**
 * Audit-derived history row — mirrors `projectHistoryEntrySchema` (`at`, not createdAt).
 */
export const budgetHistoryEntrySchema = z.object({
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
