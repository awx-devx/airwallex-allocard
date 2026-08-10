import { z } from 'zod'
import {
  cardFilterSchema,
  conditionSchema,
  conditionValueSchema,
  createRuleInput,
  enableRuleInput,
  listRulesQuery,
  memberFilterSchema,
  ruleActionSchema,
  ruleControlsParamsSchema,
  ruleListSchema,
  ruleSchema,
  ruleScopeSchema,
  ruleTargetSchema,
  ruleTransactionLimitEntrySchema,
  ruleTransactionLimitsSchema,
  ruleTriggerSchema,
  updateRuleInput,
  validateRuleInput,
  validateRuleOutput,
} from '@/shared/schemas/rule'

export type ConditionValue = z.infer<typeof conditionValueSchema>
export type Condition = z.infer<typeof conditionSchema>
export type RuleScope = z.infer<typeof ruleScopeSchema>
export type RuleTrigger = z.infer<typeof ruleTriggerSchema>
export type CardFilter = z.infer<typeof cardFilterSchema>
export type MemberFilter = z.infer<typeof memberFilterSchema>
export type RuleTarget = z.infer<typeof ruleTargetSchema>
export type RuleTransactionLimitEntry = z.infer<typeof ruleTransactionLimitEntrySchema>
export type RuleTransactionLimits = z.infer<typeof ruleTransactionLimitsSchema>
export type RuleControlsParams = z.infer<typeof ruleControlsParamsSchema>
export type RuleAction = z.infer<typeof ruleActionSchema>
export type Rule = z.infer<typeof ruleSchema>
export type CreateRuleInput = z.infer<typeof createRuleInput>
export type UpdateRuleInput = z.infer<typeof updateRuleInput>
export type EnableRuleInput = z.infer<typeof enableRuleInput>
export type ListRulesQuery = z.infer<typeof listRulesQuery>
export type RuleList = z.infer<typeof ruleListSchema>
export type ValidateRuleInput = z.infer<typeof validateRuleInput>
export type ValidateRuleOutput = z.infer<typeof validateRuleOutput>
