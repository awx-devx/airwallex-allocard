import { z } from 'zod'
import { ActionResultStatus } from '@/shared/enums/actionResultStatus'
import { ActorType } from '@/shared/enums/audit'
import { DesiredCardStatus } from '@/shared/enums/desiredCardStatus'
import { MergeStrategy } from '@/shared/enums/mergeStrategy'
import { RuleActionType } from '@/shared/enums/ruleActionType'
import { RuleRunStatus } from '@/shared/enums/ruleRunStatus'
import { AttributeSubjectType } from '@/shared/enums/attributeSubjectType'
import { idSchema, isoDateSchema } from '@/shared/schemas/base'
import { attributeLiteralSchema, attributeValueSchema } from '@/shared/schemas/attribute'
import { cardControlsSchema } from '@/shared/schemas/cardControls'
import { createRuleInput, ruleSchema } from '@/shared/schemas/rule'

/** One attribute snapshot consumed during evaluation (keyed inputs on RuleRun). */
export const ruleRunInputValueSchema = z.object({
  key: z.string().min(1),
  subjectType: z.enum(AttributeSubjectType),
  subjectId: idSchema,
  value: attributeLiteralSchema,
  observedAt: isoDateSchema,
  ttlSec: z.number().int().positive().nullable(),
  /** True when observedAt + ttlSec is before evaluation start. */
  stale: z.boolean(),
})

/**
 * Desired controls+status for one card after merge (RULES-ENGINE §4).
 * Controls are fully resolved literals (no formulas) in minor units.
 */
export const desiredCardStateSchema = z.object({
  cardId: idSchema,
  controls: cardControlsSchema.partial().optional(),
  cardStatus: z.enum(DesiredCardStatus).optional(),
  /**
   * Set when a `card.close` contribution carried `allowDestructive: true`.
   * Apply refuses CLOSED unless this is true (B9 / Airwallex lock).
   */
  allowDestructiveClose: z.boolean().optional(),
})

export const desiredStateSchema = z.object({
  cards: z.array(desiredCardStateSchema),
})

/** Per-field before/after for one card. */
export const cardControlsDiffSchema = z.object({
  cardId: idSchema,
  before: z.object({
    controls: cardControlsSchema.nullable(),
    cardStatus: z.enum(DesiredCardStatus).nullable(),
  }),
  after: z.object({
    controls: cardControlsSchema.partial().nullable(),
    cardStatus: z.enum(DesiredCardStatus).nullable(),
  }),
  changed: z.boolean(),
})

export const ruleRunDiffSchema = z.object({
  cards: z.array(cardControlsDiffSchema),
})

export const mergeConflictSchema = z.object({
  kind: z.enum([
    'EMPTY_CURRENCY_INTERSECTION',
    'EMPTY_MCC_INTERSECTION',
    'EMPTY_COUNTRY_INTERSECTION',
    'EMPTY_BRAND_INTERSECTION',
    'ACTIVE_WINDOW_INVERTED',
    'OTHER',
  ]),
  message: z.string().min(1),
  cardId: idSchema.optional(),
  field: z.string().optional(),
})

export const actionResultSchema = z.object({
  action: z.enum(RuleActionType),
  targetId: idSchema.nullable(),
  status: z.enum(ActionResultStatus),
  message: z.string().nullable(),
  details: z.record(z.string(), z.unknown()).optional(),
})

/**
 * Persisted (or dry-run) evaluation record (ARCHITECTURE §5).
 * Stale attribute → status SKIPPED + skipReason naming the key.
 * Missing attribute → status FAILED + failureReason naming the key.
 * Impossible merge → status PARTIAL + conflicts[]; no Airwallex push.
 */
export const ruleRunSchema = z.object({
  id: idSchema,
  orgId: idSchema,
  ruleId: idSchema,
  /** Actor that caused the run (user id, `system`, or rule id). */
  triggeredBy: idSchema,
  triggeredByType: z.nativeEnum(ActorType),
  triggerEvent: z.string().min(1),
  inputs: z.array(ruleRunInputValueSchema),
  matched: z.boolean(),
  desiredState: desiredStateSchema,
  diff: ruleRunDiffSchema,
  actions: z.array(actionResultSchema),
  conflicts: z.array(mergeConflictSchema),
  status: z.enum(RuleRunStatus),
  /** Set when status is SKIPPED — e.g. `stale input: campaign.roas`. */
  skipReason: z.string().nullable(),
  /** Set when status is FAILED — e.g. `missing attribute: project.budget.remaining`. */
  failureReason: z.string().nullable(),
  durationMs: z.number().int().nonnegative(),
  startedAt: isoDateSchema,
  finishedAt: isoDateSchema,
})

export const listRuleRunsQuery = z.object({
  ruleId: idSchema.optional(),
  cardId: idSchema.optional(),
  projectId: idSchema.optional(),
  status: z.enum(RuleRunStatus).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
})

export const ruleRunListSchema = z.object({
  items: z.array(ruleRunSchema),
  page: z.number().int().min(1),
  pageSize: z.number().int().min(1),
  total: z.number().int().min(0),
})

export const attributeOverrideSchema = z.object({
  key: z.string().min(1),
  subjectType: z.enum(AttributeSubjectType),
  subjectId: idSchema,
  value: attributeLiteralSchema,
})

/**
 * Dry-run pipeline through step 6 (RULES-ENGINE §4 / B6 simulate).
 * Zero Airwallex calls; zero DB/Redis writes; runs returned with status DRY_RUN.
 */
export const simulateRulesInput = z
  .object({
    /** Limit to these rules; omit = all enabled rules in scope. */
    ruleIds: z.array(idSchema).min(1).optional(),
    /** Scope hint when selecting enabled rules. */
    projectId: idSchema.optional(),
    /** Optional draft body for builder preview (not persisted). */
    draftRule: createRuleInput.optional(),
    attributeOverrides: z.array(attributeOverrideSchema).optional(),
  })
  .refine(
    (value) =>
      value.ruleIds !== undefined ||
      value.draftRule !== undefined ||
      value.projectId !== undefined ||
      value.attributeOverrides !== undefined,
    { message: 'Provide ruleIds, draftRule, projectId, and/or attributeOverrides' },
  )

export const simulateRulesOutput = z.object({
  runs: z.array(ruleRunSchema),
  cardDiffs: z.array(cardControlsDiffSchema),
  conflicts: z.array(mergeConflictSchema),
})

export const mergeExplanationEntrySchema = z.object({
  field: z.string().min(1),
  strategy: z.enum(MergeStrategy),
  contributions: z.array(
    z.object({
      ruleId: idSchema,
      ruleName: z.string().min(1),
      priority: z.number().int(),
      value: z.unknown(),
    }),
  ),
  result: z.unknown(),
})

export const governingRuleSchema = z.object({
  ruleId: idSchema,
  name: z.string().min(1),
  priority: z.number().int(),
  version: z.number().int().positive(),
  matched: z.boolean(),
  contribution: desiredCardStateSchema.omit({ cardId: true }).optional(),
})

/**
 * GET /api/cards/:id/explain — why this card's limits/status are what they are.
 */
export const cardExplainSchema = z.object({
  cardId: idSchema,
  projectId: idSchema.nullable(),
  finalControls: cardControlsSchema,
  finalStatus: z.enum(DesiredCardStatus),
  governingRules: z.array(governingRuleSchema),
  attributeValues: z.array(attributeValueSchema),
  merge: z.array(mergeExplanationEntrySchema),
  conflicts: z.array(mergeConflictSchema),
  lastRuleRunId: idSchema.nullable(),
  lastEvaluatedAt: isoDateSchema.nullable(),
})

/** Convenience re-exports for contracts. */
export { ruleSchema }
