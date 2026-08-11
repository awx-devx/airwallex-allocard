import { z } from 'zod'
import {
  approvalRuleBodySchema,
  approvalRuleListSchema,
  approvalRuleSchema,
  approverSelectorSchema,
  putApprovalRulesInput,
} from '@/shared/schemas/approvalRule'

export type ApproverSelector = z.infer<typeof approverSelectorSchema>
export type ApprovalRule = z.infer<typeof approvalRuleSchema>
export type ApprovalRuleBody = z.infer<typeof approvalRuleBodySchema>
export type PutApprovalRulesInput = z.infer<typeof putApprovalRulesInput>
export type ApprovalRuleList = z.infer<typeof approvalRuleListSchema>
