import { Schema, model, models, type HydratedDocument, type Model } from 'mongoose'
import { ApprovalDecision } from '@/shared/enums/approvalDecision'
import { PolicyOutcome } from '@/shared/enums/policyOutcome'
import { PurchaseRequestStatus } from '@/shared/enums/purchaseRequestStatus'
import { baseOptions, tenantScoped } from '@/server/models/base'

/**
 * Storage shape. Dates are `Date` in Mongo; `toJSON` / `toDomain` emit ISO strings.
 * Amounts are integer minor units.
 */
export type PolicyDecisionFields = {
  outcome: PolicyOutcome
  reasons: string[]
  requiredApprovals: number
}

export type ApprovalEntryFields = {
  approverId: string
  decision: ApprovalDecision
  reason: string | null
  at: Date
}

export type PurchaseRequestFields = {
  orgId: string
  projectId: string
  requestedBy: string
  amount: number
  currency: string
  categoryId: string | null
  vendor: string
  description: string
  justification: string
  policyDecision: PolicyDecisionFields | null
  status: PurchaseRequestStatus
  cardId: string | null
  approvals: ApprovalEntryFields[]
  escalatedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

const policyDecisionSubSchema = new Schema<PolicyDecisionFields>(
  {
    outcome: {
      type: String,
      enum: Object.values(PolicyOutcome),
      required: true,
    },
    reasons: { type: [String], required: true, default: [] },
    requiredApprovals: { type: Number, required: true },
  },
  { _id: false },
)

const approvalEntrySubSchema = new Schema<ApprovalEntryFields>(
  {
    approverId: { type: String, required: true },
    decision: {
      type: String,
      enum: Object.values(ApprovalDecision),
      required: true,
    },
    reason: { type: String, default: null },
    at: { type: Date, required: true },
  },
  { _id: false },
)

const purchaseRequestSchema = new Schema<PurchaseRequestFields, Model<PurchaseRequestFields>>(
  {
    orgId: { type: String, required: true, index: true },
    projectId: { type: String, required: true },
    requestedBy: { type: String, required: true },
    amount: { type: Number, required: true },
    currency: { type: String, required: true, maxlength: 3 },
    categoryId: { type: String, default: null },
    vendor: { type: String, required: true, maxlength: 200 },
    description: { type: String, required: true, maxlength: 2000 },
    justification: { type: String, required: true, maxlength: 2000 },
    policyDecision: { type: policyDecisionSubSchema, default: null },
    status: {
      type: String,
      enum: Object.values(PurchaseRequestStatus),
      required: true,
      default: PurchaseRequestStatus.DRAFT,
    },
    cardId: { type: String, default: null },
    approvals: { type: [approvalEntrySubSchema], default: [] },
    escalatedAt: { type: Date, default: null },
  },
  {
    ...baseOptions,
    collection: 'purchaseRequests',
  },
)

purchaseRequestSchema.plugin(tenantScoped)
purchaseRequestSchema.index({ orgId: 1, projectId: 1, status: 1, createdAt: -1 })
purchaseRequestSchema.index({ orgId: 1, requestedBy: 1, createdAt: -1 })
purchaseRequestSchema.index({ orgId: 1, status: 1, updatedAt: 1 })

export type PurchaseRequestDoc = HydratedDocument<PurchaseRequestFields>
export const PurchaseRequestModel = (models.PurchaseRequest ??
  model<PurchaseRequestFields>(
    'PurchaseRequest',
    purchaseRequestSchema,
  )) as Model<PurchaseRequestFields>
