import { z } from 'zod'
import { defineContract } from '@/shared/contracts/types'
import {
  cardExplainSchema,
  listRuleRunsQuery,
  ruleRunListSchema,
  ruleRunSchema,
} from '@/shared/schemas/ruleRun'

export const ruleRunContracts = {
  list: defineContract({
    method: 'GET',
    path: '/api/rule-runs',
    input: listRuleRunsQuery,
    output: ruleRunListSchema,
  }),
  get: defineContract({
    method: 'GET',
    path: '/api/rule-runs/:id',
    input: z.void(),
    output: ruleRunSchema,
  }),
} as const

export type RuleRunContracts = typeof ruleRunContracts

/** Card explainer lives under cards but is a B6 contract. */
export const cardExplainContracts = {
  explain: defineContract({
    method: 'GET',
    path: '/api/cards/:id/explain',
    input: z.void(),
    output: cardExplainSchema,
  }),
} as const

export type CardExplainContracts = typeof cardExplainContracts
