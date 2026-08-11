import { z } from 'zod'
import { ApproverSelection } from '@/shared/enums/approverSelection'
import { idSchema, isoDateSchema } from '@/shared/schemas/base'

/**
 * Resolver for who may approve (or who receives escalation).
 * Payload fields are required only for the matching type.
 */
export const approverSelectorSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal(ApproverSelection.ROLE),
    roleKey: z
      .string()
      .min(1)
      .max(64)
      .regex(
        /^[a-z0-9]+(?:[_-][a-z0-9]+)*$/,
        'Key must be lowercase alphanumeric with hyphens or underscores',
      ),
  }),
  z.object({
    type: z.literal(ApproverSelection.NAMED_USERS),
    userIds: z.array(idSchema).min(1),
  }),
  z.object({
    type: z.literal(ApproverSelection.PROJECT_OWNER),
  }),
])

/**
 * Threshold rule for a project (or org default when projectId is null).
 * `threshold` is integer minor units — amounts at or above require this rule's approvers.
 */
export const approvalRuleSchema = z.object({
  id: idSchema,
  orgId: idSchema,
  /** Null = org-wide default rule. */
  projectId: idSchema.nullable(),
  /** Integer minor units; nonnegative. */
  threshold: z.number().int().nonnegative(),
  approverSelection: approverSelectorSchema,
  /** Distinct approvers required; same user twice does not count twice. */
  requiredCount: z.number().int().min(1),
  escalationAfterMins: z.number().int().min(1),
  escalateTo: approverSelectorSchema,
  createdAt: isoDateSchema,
  updatedAt: isoDateSchema,
})

/** Body for PUT replace-all — projectId/orgId come from the route/context. */
export const approvalRuleBodySchema = z.object({
  threshold: z.number().int().nonnegative(),
  approverSelection: approverSelectorSchema,
  requiredCount: z.number().int().min(1),
  escalationAfterMins: z.number().int().min(1),
  escalateTo: approverSelectorSchema,
})

export const putApprovalRulesInput = z.array(approvalRuleBodySchema)

export const approvalRuleListSchema = z.array(approvalRuleSchema)
