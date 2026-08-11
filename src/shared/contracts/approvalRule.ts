import { z } from 'zod'
import { defineContract } from '@/shared/contracts/types'
import { approvalRuleListSchema, putApprovalRulesInput } from '@/shared/schemas/approvalRule'

export const approvalRuleContracts = {
  list: defineContract({
    method: 'GET',
    path: '/api/projects/:id/approval-rules',
    input: z.void(),
    output: approvalRuleListSchema,
  }),
  put: defineContract({
    method: 'PUT',
    path: '/api/projects/:id/approval-rules',
    input: putApprovalRulesInput,
    output: approvalRuleListSchema,
  }),
} as const

export type ApprovalRuleContracts = typeof approvalRuleContracts
