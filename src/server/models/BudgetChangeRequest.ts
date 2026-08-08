import { Schema, model, models, type HydratedDocument, type Model } from 'mongoose'
import { BudgetChangeRequestStatus } from '@/shared/enums/budgetChangeRequestStatus'
import { baseOptions, tenantScoped } from '@/server/models/base'

/**
 * Storage shape. Dates are `Date` in Mongo; `toJSON` / `toDomain` emit ISO strings.
 * `deltaAmount` is a nonzero integer minor unit (may be negative) — enforced at service.
 */
export type BudgetChangeRequestFields = {
  orgId: string
  projectId: string
  requestedBy: string
  deltaAmount: number
  reason: string
  status: BudgetChangeRequestStatus
  decidedBy: string | null
  decidedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

const budgetChangeRequestSchema = new Schema<
  BudgetChangeRequestFields,
  Model<BudgetChangeRequestFields>
>(
  {
    orgId: { type: String, required: true, index: true },
    projectId: { type: String, required: true },
    requestedBy: { type: String, required: true },
    deltaAmount: { type: Number, required: true },
    reason: { type: String, required: true, maxlength: 2000 },
    status: {
      type: String,
      enum: Object.values(BudgetChangeRequestStatus),
      required: true,
      default: BudgetChangeRequestStatus.PENDING,
    },
    decidedBy: { type: String, default: null },
    decidedAt: { type: Date, default: null },
  },
  {
    ...baseOptions,
    collection: 'budgetChangeRequests',
  },
)

budgetChangeRequestSchema.plugin(tenantScoped)
budgetChangeRequestSchema.index({ orgId: 1, projectId: 1, status: 1, createdAt: -1 })

export type BudgetChangeRequestDoc = HydratedDocument<BudgetChangeRequestFields>
export const BudgetChangeRequestModel = (models.BudgetChangeRequest ??
  model<BudgetChangeRequestFields>(
    'BudgetChangeRequest',
    budgetChangeRequestSchema,
  )) as Model<BudgetChangeRequestFields>
