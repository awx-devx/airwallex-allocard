import { z } from 'zod'
import { CardPurpose } from '@/shared/enums/cardPurpose'
import { ConditionOperator } from '@/shared/enums/conditionOperator'
import { DesiredCardStatus } from '@/shared/enums/desiredCardStatus'
import { RuleActionType } from '@/shared/enums/ruleActionType'
import { RuleScopeLevel } from '@/shared/enums/ruleScopeLevel'
import { RuleTargetSelect } from '@/shared/enums/ruleTargetSelect'
import { TransactionLimitInterval } from '@/shared/enums/transactionLimitInterval'
import { idSchema, isoDateSchema } from '@/shared/schemas/base'
import { attributeLiteralSchema } from '@/shared/schemas/attribute'
import { allowlistSchema, blockedTransactionUsageSchema } from '@/shared/schemas/cardControls'

/** Literal or reference to another attribute (`{ attr: '…' }`). */
export const conditionValueSchema = z.union([
  attributeLiteralSchema,
  z.array(attributeLiteralSchema),
  z.object({ attr: z.string().min(1) }),
])

type Condition = {
  all?: Condition[]
  any?: Condition[]
  not?: Condition
  attr?: string
  op?: ConditionOperator
  value?: z.infer<typeof conditionValueSchema>
  expr?: string
}

/**
 * Recursive condition tree (RULES-ENGINE §3).
 * Exactly one branch key present: all | any | not | attr+op | expr.
 */
export const conditionSchema: z.ZodType<Condition> = z.lazy(() =>
  z
    .object({
      all: z.array(conditionSchema).min(1).optional(),
      any: z.array(conditionSchema).min(1).optional(),
      not: conditionSchema.optional(),
      attr: z.string().min(1).optional(),
      op: z.enum(ConditionOperator).optional(),
      value: conditionValueSchema.optional(),
      expr: z.string().min(1).max(500).optional(),
    })
    .superRefine((value, ctx) => {
      const keys = [
        value.all !== undefined,
        value.any !== undefined,
        value.not !== undefined,
        value.attr !== undefined || value.op !== undefined,
        value.expr !== undefined,
      ].filter(Boolean).length
      if (keys !== 1) {
        ctx.addIssue({
          code: 'custom',
          message: 'Condition must be exactly one of: all, any, not, attr+op, expr',
        })
        return
      }
      if (value.attr !== undefined || value.op !== undefined) {
        if (!value.attr || !value.op) {
          ctx.addIssue({
            code: 'custom',
            message: 'attr conditions require both attr and op',
            path: ['attr'],
          })
        }
        if (value.value === undefined) {
          ctx.addIssue({
            code: 'custom',
            message: 'attr conditions require value',
            path: ['value'],
          })
        }
      }
    }),
)

export const ruleScopeSchema = z
  .object({
    level: z.enum(RuleScopeLevel),
    projectId: idSchema.optional(),
  })
  .superRefine((value, ctx) => {
    if (value.level === RuleScopeLevel.PROJECT && !value.projectId) {
      ctx.addIssue({
        code: 'custom',
        message: 'projectId required when scope.level is PROJECT',
        path: ['projectId'],
      })
    }
    if (value.level === RuleScopeLevel.ORG && value.projectId !== undefined) {
      ctx.addIssue({
        code: 'custom',
        message: 'projectId must be omitted when scope.level is ORG',
        path: ['projectId'],
      })
    }
  })

export const ruleTriggerSchema = z
  .object({
    events: z.array(z.string().min(1)).min(1).optional(),
    /** Cron expression; optional backstop schedule. */
    schedule: z.string().min(1).max(120).optional(),
    debounceSec: z.number().int().nonnegative().optional(),
  })
  .refine((value) => value.events !== undefined || value.schedule !== undefined, {
    message: 'trigger requires events and/or schedule',
  })

export const cardFilterSchema = z.object({
  purpose: z.enum(CardPurpose).optional(),
  memberRole: z.string().min(1).optional(),
  roleKeys: z.array(z.string().min(1)).min(1).optional(),
  cardIds: z.array(idSchema).min(1).optional(),
})

export const memberFilterSchema = z.object({
  roleKeys: z.array(z.string().min(1)).min(1).optional(),
  memberIds: z.array(idSchema).min(1).optional(),
})

/**
 * Action target (RULES-ENGINE §3).
 * Discriminated loosely by `select`; extra fields validated per select.
 */
export const ruleTargetSchema = z
  .object({
    select: z.enum(RuleTargetSelect),
    filter: z.union([cardFilterSchema, memberFilterSchema]).optional(),
    memberIds: z.array(idSchema).min(1).optional(),
    roleKeys: z.array(z.string().min(1)).min(1).optional(),
    cardId: idSchema.optional(),
  })
  .superRefine((value, ctx) => {
    if (value.select === RuleTargetSelect.CARD && !value.cardId) {
      ctx.addIssue({
        code: 'custom',
        message: 'cardId required when select is CARD',
        path: ['cardId'],
      })
    }
  })

/**
 * Formula string or resolved literal.
 * Money amounts that are numbers are integer **minor units** (ARCHITECTURE §4).
 */
export const formulaOrIntSchema = z.union([z.string().min(1).max(500), z.number().int()])
export const formulaOrAllowlistSchema = z.union([allowlistSchema, z.string().min(1).max(500)])
/** ISO datetime or formula / attribute identifier (e.g. project.startDate). */
export const formulaOrDateSchema = z.union([isoDateSchema, z.string().min(1).max(500)])

export const ruleTransactionLimitEntrySchema = z.object({
  interval: z.enum(TransactionLimitInterval),
  amount: formulaOrIntSchema,
})

export const ruleTransactionLimitsSchema = z.object({
  /** ISO 4217 code or formula / attribute identifier. */
  currency: z.string().min(1).max(500),
  limits: z.array(ruleTransactionLimitEntrySchema).min(1),
})

/**
 * Params for card.setControls / card.create — formulas allowed on amount/date/allowlist fields.
 * `cardStatus` is not set here; freeze/unfreeze/close actions set status.
 */
export const ruleControlsParamsSchema = z.object({
  formFactor: z.enum(['VIRTUAL', 'PHYSICAL']).optional(),
  purpose: z.enum(CardPurpose).optional(),
  allowedTransactionCount: z.enum(['SINGLE', 'MULTIPLE']).optional(),
  transactionLimits: ruleTransactionLimitsSchema.optional(),
  activeFrom: formulaOrDateSchema.nullable().optional(),
  activeTo: formulaOrDateSchema.nullable().optional(),
  allowedCurrencies: formulaOrAllowlistSchema.optional(),
  allowedMerchantCategories: formulaOrAllowlistSchema.optional(),
  allowedMerchantCountries: formulaOrAllowlistSchema.optional(),
  allowedMerchantBrands: formulaOrAllowlistSchema.optional(),
  blockedTransactionUsages: z.array(blockedTransactionUsageSchema).optional(),
  reason: z.string().min(1).max(500).optional(),
  template: z.string().min(1).max(120).optional(),
  recompute: z.boolean().optional(),
  when: z.string().min(1).max(500).optional(),
})

export const ruleActionSchema = z.object({
  action: z.enum(RuleActionType),
  target: ruleTargetSchema,
  params: ruleControlsParamsSchema.default({}),
})

export const ruleSchema = z.object({
  id: idSchema,
  orgId: idSchema,
  scope: ruleScopeSchema,
  name: z.string().min(1).max(200),
  description: z.string().max(2000).nullable(),
  enabled: z.boolean(),
  /** Lower number = higher precedence on merge ties / freeze-last (RULES-ENGINE §6 B). */
  priority: z.number().int(),
  trigger: ruleTriggerSchema,
  when: conditionSchema,
  then: z.array(ruleActionSchema).min(1),
  else: z.array(ruleActionSchema).optional(),
  createdBy: idSchema,
  version: z.number().int().positive(),
  createdAt: isoDateSchema,
  updatedAt: isoDateSchema,
})

export const createRuleInput = z.object({
  scope: ruleScopeSchema,
  name: z.string().min(1).max(200),
  description: z.string().max(2000).nullable().optional(),
  enabled: z.boolean().optional(),
  priority: z.number().int().optional(),
  trigger: ruleTriggerSchema,
  when: conditionSchema,
  then: z.array(ruleActionSchema).min(1),
  else: z.array(ruleActionSchema).optional(),
})

export const updateRuleInput = z
  .object({
    scope: ruleScopeSchema.optional(),
    name: z.string().min(1).max(200).optional(),
    description: z.string().max(2000).nullable().optional(),
    priority: z.number().int().optional(),
    trigger: ruleTriggerSchema.optional(),
    when: conditionSchema.optional(),
    then: z.array(ruleActionSchema).min(1).optional(),
    else: z.array(ruleActionSchema).nullable().optional(),
  })
  .refine(
    (value) =>
      value.scope !== undefined ||
      value.name !== undefined ||
      value.description !== undefined ||
      value.priority !== undefined ||
      value.trigger !== undefined ||
      value.when !== undefined ||
      value.then !== undefined ||
      value.else !== undefined,
    { message: 'At least one field is required' },
  )

export const enableRuleInput = z.object({
  enabled: z.boolean(),
})

export const listRulesQuery = z.object({
  projectId: idSchema.optional(),
  enabled: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === 'true')),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
})

export const ruleListSchema = z.object({
  items: z.array(ruleSchema),
  page: z.number().int().min(1),
  pageSize: z.number().int().min(1),
  total: z.number().int().min(0),
})

/** Builder validation — accepts a partial or full DSL body. */
export const validateRuleInput = z.object({
  scope: ruleScopeSchema.optional(),
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).nullable().optional(),
  enabled: z.boolean().optional(),
  priority: z.number().int().optional(),
  trigger: ruleTriggerSchema.optional(),
  when: conditionSchema.optional(),
  then: z.array(ruleActionSchema).min(1).optional(),
  else: z.array(ruleActionSchema).optional(),
})

export const validateRuleOutput = z.discriminatedUnion('ok', [
  z.object({
    ok: z.literal(true),
  }),
  z.object({
    ok: z.literal(false),
    errors: z.array(
      z.object({
        path: z.string(),
        message: z.string(),
      }),
    ),
  }),
])

/** Re-export for consumers that need desired status on merge/explain. */
export { DesiredCardStatus }
