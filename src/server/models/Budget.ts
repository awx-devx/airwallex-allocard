import { Schema, model, models, type HydratedDocument, type Model } from 'mongoose'
import { DEFAULT_BUDGET_THRESHOLD_PCTS } from '@/shared/schemas/budget'
import { baseOptions, tenantScoped } from '@/server/models/base'

export type BudgetCategoryFields = {
  id: string
  name: string
  workstreamId: string | null
  /** Integer minor units. */
  allocated: number
  formula: string | null
}

/**
 * Storage shape. Dates are `Date` in Mongo; `toJSON` / `toDomain` emit ISO strings
 * matching the public `Budget` contract. Amounts are integer minor units.
 */
export type BudgetFields = {
  orgId: string
  projectId: string
  currency: string
  /** Integer minor units. */
  approvedAmount: number
  formula: string | null
  categories: BudgetCategoryFields[]
  thresholdPcts: number[]
  createdAt: Date
  updatedAt: Date
}

const budgetCategorySchema = new Schema<BudgetCategoryFields>(
  {
    id: { type: String, required: true },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    workstreamId: { type: String, default: null },
    allocated: { type: Number, required: true },
    formula: { type: String, default: null },
  },
  { _id: false },
)

const defaultThresholdPcts = (): number[] => [...DEFAULT_BUDGET_THRESHOLD_PCTS]

const budgetSchema = new Schema<BudgetFields, Model<BudgetFields>>(
  {
    orgId: { type: String, required: true, index: true },
    projectId: { type: String, required: true },
    currency: { type: String, required: true, maxlength: 3, minlength: 3 },
    approvedAmount: { type: Number, required: true },
    formula: { type: String, default: null },
    categories: { type: [budgetCategorySchema], required: true, default: [] },
    thresholdPcts: {
      type: [Number],
      required: true,
      default: defaultThresholdPcts,
    },
  },
  {
    ...baseOptions,
    collection: 'budgets',
  },
)

budgetSchema.plugin(tenantScoped)
budgetSchema.index({ orgId: 1, projectId: 1 }, { unique: true })

export type BudgetDoc = HydratedDocument<BudgetFields>
export const BudgetModel = (models.Budget ??
  model<BudgetFields>('Budget', budgetSchema)) as Model<BudgetFields>
