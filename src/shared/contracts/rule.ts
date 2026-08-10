import { z } from 'zod'
import { defineContract } from '@/shared/contracts/types'
import {
  createRuleInput,
  enableRuleInput,
  listRulesQuery,
  ruleListSchema,
  ruleSchema,
  updateRuleInput,
  validateRuleInput,
  validateRuleOutput,
} from '@/shared/schemas/rule'
import { simulateRulesInput, simulateRulesOutput } from '@/shared/schemas/ruleRun'

export const ruleContracts = {
  list: defineContract({
    method: 'GET',
    path: '/api/rules',
    input: listRulesQuery,
    output: ruleListSchema,
  }),
  create: defineContract({
    method: 'POST',
    path: '/api/rules',
    input: createRuleInput,
    output: ruleSchema,
  }),
  update: defineContract({
    method: 'PATCH',
    path: '/api/rules/:id',
    input: updateRuleInput,
    output: ruleSchema,
  }),
  delete: defineContract({
    method: 'DELETE',
    path: '/api/rules/:id',
    input: z.void(),
    output: z.void(),
  }),
  enable: defineContract({
    method: 'POST',
    path: '/api/rules/:id/enable',
    input: enableRuleInput,
    output: ruleSchema,
  }),
  validate: defineContract({
    method: 'POST',
    path: '/api/rules/validate',
    input: validateRuleInput,
    output: validateRuleOutput,
  }),
  simulate: defineContract({
    method: 'POST',
    path: '/api/rules/simulate',
    input: simulateRulesInput,
    output: simulateRulesOutput,
  }),
} as const

export type RuleContracts = typeof ruleContracts
