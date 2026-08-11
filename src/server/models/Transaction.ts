import { Schema, model, models, type HydratedDocument, type Model } from 'mongoose'
import { TransactionStatus } from '@/shared/enums/transactionStatus'
import { TransactionType } from '@/shared/enums/transactionType'
import { baseOptions, tenantScoped } from '@/server/models/base'

/**
 * Local transaction / card-transaction-event mirror.
 * Amounts are integer minor units. Never store PAN/CVV/expiry.
 * Dates are `Date` in Mongo; `toJSON` / `toDomain` emit ISO strings.
 */
export type TransactionMerchantFields = {
  name: string
  mcc: string
  country: string
}

export type TransactionFields = {
  orgId: string
  cardId: string
  projectId: string
  airwallexTransactionId: string
  cardTransactionId: string
  lifecycleId: string
  type: TransactionType
  status: TransactionStatus
  amount: number
  currency: string
  billingAmount: number
  billingCurrency: string
  merchant: TransactionMerchantFields
  failureReason: string | null
  receiptFileId: string | null
  transactedAt: Date
  createdAt: Date
  updatedAt: Date
}

const merchantSubSchema = new Schema<TransactionMerchantFields>(
  {
    name: { type: String, required: true, maxlength: 500 },
    mcc: { type: String, required: true, maxlength: 8 },
    country: { type: String, required: true, maxlength: 3 },
  },
  { _id: false },
)

const transactionSchema = new Schema<TransactionFields, Model<TransactionFields>>(
  {
    orgId: { type: String, required: true, index: true },
    cardId: { type: String, required: true },
    projectId: { type: String, required: true },
    airwallexTransactionId: { type: String, required: true },
    cardTransactionId: { type: String, required: true },
    lifecycleId: { type: String, required: true },
    type: {
      type: String,
      enum: Object.values(TransactionType),
      required: true,
    },
    status: {
      type: String,
      enum: Object.values(TransactionStatus),
      required: true,
    },
    amount: { type: Number, required: true },
    currency: { type: String, required: true, maxlength: 3, minlength: 3 },
    billingAmount: { type: Number, required: true },
    billingCurrency: { type: String, required: true, maxlength: 3, minlength: 3 },
    merchant: { type: merchantSubSchema, required: true },
    failureReason: { type: String, default: null },
    receiptFileId: { type: String, default: null },
    transactedAt: { type: Date, required: true },
  },
  {
    ...baseOptions,
    collection: 'transactions',
  },
)

transactionSchema.plugin(tenantScoped)
transactionSchema.index({ orgId: 1, airwallexTransactionId: 1 }, { unique: true })
transactionSchema.index({ orgId: 1, cardId: 1, transactedAt: -1 })
transactionSchema.index({ orgId: 1, projectId: 1, transactedAt: -1 })
transactionSchema.index({ orgId: 1, lifecycleId: 1 })
transactionSchema.index({ orgId: 1, status: 1, transactedAt: -1 })

export type TransactionDoc = HydratedDocument<TransactionFields>
export const TransactionModel = (models.Transaction ??
  model<TransactionFields>('Transaction', transactionSchema)) as Model<TransactionFields>
