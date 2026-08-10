import { z } from 'zod'
import {
  actionResultSchema,
  attributeOverrideSchema,
  cardControlsDiffSchema,
  cardExplainSchema,
  desiredCardStateSchema,
  desiredStateSchema,
  governingRuleSchema,
  listRuleRunsQuery,
  mergeConflictSchema,
  mergeExplanationEntrySchema,
  ruleRunDiffSchema,
  ruleRunInputValueSchema,
  ruleRunListSchema,
  ruleRunSchema,
  simulateRulesInput,
  simulateRulesOutput,
} from '@/shared/schemas/ruleRun'

export type RuleRunInputValue = z.infer<typeof ruleRunInputValueSchema>
export type DesiredCardState = z.infer<typeof desiredCardStateSchema>
export type DesiredState = z.infer<typeof desiredStateSchema>
export type CardControlsDiff = z.infer<typeof cardControlsDiffSchema>
export type RuleRunDiff = z.infer<typeof ruleRunDiffSchema>
export type MergeConflict = z.infer<typeof mergeConflictSchema>
export type ActionResult = z.infer<typeof actionResultSchema>
export type RuleRun = z.infer<typeof ruleRunSchema>
export type ListRuleRunsQuery = z.infer<typeof listRuleRunsQuery>
export type RuleRunList = z.infer<typeof ruleRunListSchema>
export type AttributeOverride = z.infer<typeof attributeOverrideSchema>
export type SimulateRulesInput = z.infer<typeof simulateRulesInput>
export type SimulateRulesOutput = z.infer<typeof simulateRulesOutput>
export type MergeExplanationEntry = z.infer<typeof mergeExplanationEntrySchema>
export type GoverningRule = z.infer<typeof governingRuleSchema>
export type CardExplain = z.infer<typeof cardExplainSchema>
