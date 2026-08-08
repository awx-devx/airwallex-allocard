import { Schema, model, models, type HydratedDocument, type Model } from 'mongoose'
import { BudgetEntrySourceType } from '@/shared/enums/budgetEntrySourceType'
import { BudgetEntryType } from '@/shared/enums/budgetEntryType'
import { baseOptions, tenantScoped } from '@/server/models/base'

/**
 * Storage shape. Dates are `Date` in Mongo; `toJSON` / `toDomain` emit ISO strings.
 * `amount` is an integer minor unit (signed allowed for ADJUSTMENT).
 * `lifecycleId` exists from day one; null until B8 populates it.
 */
export type BudgetEntryFields = {
  orgId: string
  projectId: string
  categoryId: string | null
  type: BudgetEntryType
  amount: number
  currency: string
  sourceType: BudgetEntrySourceType
  sourceId: string
  lifecycleId: string | null
  createdBy: string
  note: string | null
  createdAt: Date
  updatedAt: Date
}

const budgetEntrySchema = new Schema<BudgetEntryFields, Model<BudgetEntryFields>>(
  {
    orgId: { type: String, required: true, index: true },
    projectId: { type: String, required: true },
    categoryId: { type: String, default: null },
    type: {
      type: String,
      enum: Object.values(BudgetEntryType),
      required: true,
    },
    amount: { type: Number, required: true },
    currency: { type: String, required: true, maxlength: 3, minlength: 3 },
    sourceType: {
      type: String,
      enum: Object.values(BudgetEntrySourceType),
      required: true,
    },
    sourceId: { type: String, required: true },
    lifecycleId: { type: String, default: null },
    createdBy: { type: String, required: true },
    note: { type: String, default: null },
  },
  {
    ...baseOptions,
    collection: 'budgetEntries',
  },
)

budgetEntrySchema.plugin(tenantScoped)
budgetEntrySchema.index({ orgId: 1, projectId: 1, createdAt: -1 })
budgetEntrySchema.index({ orgId: 1, projectId: 1, type: 1, createdAt: -1 })
budgetEntrySchema.index(
  { orgId: 1, lifecycleId: 1 },
  { partialFilterExpression: { lifecycleId: { $type: 'string' } } },
)

export type BudgetEntryDoc = HydratedDocument<BudgetEntryFields>
export const BudgetEntryModel = (models.BudgetEntry ??
  model<BudgetEntryFields>('BudgetEntry', budgetEntrySchema)) as Model<BudgetEntryFields>
