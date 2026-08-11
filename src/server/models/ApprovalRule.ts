import { Schema, model, models, type HydratedDocument, type Model } from 'mongoose'
import { ApproverSelection } from '@/shared/enums/approverSelection'
import { baseOptions, tenantScoped } from '@/server/models/base'

/**
 * Storage shape for approver / escalate-to resolution.
 * Payload fields are present only for the matching type; validated at the service boundary.
 */
export type ApproverSelectorFields = {
  type: ApproverSelection
  roleKey?: string
  userIds?: string[]
}

/**
 * Threshold rule. `projectId` null = org-wide default.
 * `threshold` is integer minor units.
 */
export type ApprovalRuleFields = {
  orgId: string
  projectId: string | null
  threshold: number
  approverSelection: ApproverSelectorFields
  requiredCount: number
  escalationAfterMins: number
  escalateTo: ApproverSelectorFields
  createdAt: Date
  updatedAt: Date
}

const approverSelectorSubSchema = new Schema<ApproverSelectorFields>(
  {
    type: {
      type: String,
      enum: Object.values(ApproverSelection),
      required: true,
    },
    roleKey: { type: String },
    /** Omit when unused — avoid defaulting to [] which would pollute ROLE / PROJECT_OWNER shapes. */
    userIds: { type: [String], default: undefined },
  },
  { _id: false },
)

const approvalRuleSchema = new Schema<ApprovalRuleFields, Model<ApprovalRuleFields>>(
  {
    orgId: { type: String, required: true, index: true },
    projectId: { type: String, default: null },
    threshold: { type: Number, required: true },
    approverSelection: { type: approverSelectorSubSchema, required: true },
    requiredCount: { type: Number, required: true },
    escalationAfterMins: { type: Number, required: true },
    escalateTo: { type: approverSelectorSubSchema, required: true },
  },
  {
    ...baseOptions,
    collection: 'approvalRules',
  },
)

approvalRuleSchema.plugin(tenantScoped)
approvalRuleSchema.index({ orgId: 1, projectId: 1 })

export type ApprovalRuleDoc = HydratedDocument<ApprovalRuleFields>
export const ApprovalRuleModel = (models.ApprovalRule ??
  model<ApprovalRuleFields>('ApprovalRule', approvalRuleSchema)) as Model<ApprovalRuleFields>
