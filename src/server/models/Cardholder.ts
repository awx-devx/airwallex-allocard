import { Schema, model, models, type HydratedDocument, type Model } from 'mongoose'
import { CardholderStatus } from '@/shared/enums/cardholderStatus'
import { CardholderType } from '@/shared/enums/cardholderType'
import { baseOptions, tenantScoped } from '@/server/models/base'

/**
 * Storage shape. Dates are `Date` in Mongo; `toJSON` / `toDomain` emit ISO strings
 * matching the public `Cardholder` contract.
 */
export type CardholderFields = {
  orgId: string
  /** Null for DELEGATE cardholders not tied to a user. */
  userId: string | null
  airwallexCardholderId: string
  type: CardholderType
  status: CardholderStatus
  createdAt: Date
  updatedAt: Date
}

const cardholderSchema = new Schema<CardholderFields, Model<CardholderFields>>(
  {
    orgId: { type: String, required: true, index: true },
    userId: { type: String, default: null },
    airwallexCardholderId: { type: String, required: true },
    type: {
      type: String,
      enum: Object.values(CardholderType),
      required: true,
    },
    status: {
      type: String,
      enum: Object.values(CardholderStatus),
      required: true,
      default: CardholderStatus.PENDING,
    },
  },
  {
    ...baseOptions,
    collection: 'cardholders',
  },
)

cardholderSchema.plugin(tenantScoped)
cardholderSchema.index(
  { orgId: 1, userId: 1 },
  { unique: true, partialFilterExpression: { userId: { $type: 'string' } } },
)
cardholderSchema.index({ orgId: 1, airwallexCardholderId: 1 }, { unique: true })

export type CardholderDoc = HydratedDocument<CardholderFields>
export const CardholderModel = (models.Cardholder ??
  model<CardholderFields>('Cardholder', cardholderSchema)) as Model<CardholderFields>
