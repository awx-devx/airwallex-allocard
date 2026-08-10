import { Schema, model, models, type HydratedDocument, type Model } from 'mongoose'
import { AllowedTransactionCount } from '@/shared/enums/allowedTransactionCount'
import { CardPurpose } from '@/shared/enums/cardPurpose'
import { CardStatus } from '@/shared/enums/cardStatus'
import { TransactionLimitInterval } from '@/shared/enums/transactionLimitInterval'
import { baseOptions, tenantScoped } from '@/server/models/base'

export type TransactionLimitEntryFields = {
  interval: TransactionLimitInterval
  /** Integer minor units. */
  amount: number
}

export type TransactionLimitsFields = {
  currency: string
  limits: TransactionLimitEntryFields[]
}

export type BlockedTransactionUsageFields = {
  transactionScope: string
  usageScope: string
}

/**
 * Storage shape for desiredControls / appliedControls.
 * `activeFrom` / `activeTo` are Date in Mongo; toJSON emits ISO.
 * Amounts are integer minor units. Never store PAN/CVV/expiry.
 */
export type CardControlsFields = {
  allowedTransactionCount: AllowedTransactionCount
  transactionLimits: TransactionLimitsFields
  activeFrom: Date | null
  activeTo: Date | null
  allowedCurrencies: string[] | null
  allowedMerchantCategories: string[] | null
  allowedMerchantCountries: string[] | null
  allowedMerchantBrands: string[] | null
  blockedTransactionUsages: BlockedTransactionUsageFields[]
}

export type CardFields = {
  orgId: string
  projectId: string | null
  categoryId: string | null
  cardholderId: string
  airwallexCardId: string
  /** Masked only — never full PAN. */
  maskedNumber: string
  nickName: string
  purpose: CardPurpose
  status: CardStatus
  desiredControls: CardControlsFields
  appliedControls: CardControlsFields
  lastReconciledAt: Date | null
  managedByRuleIds: string[]
  accessList: string[]
  createdAt: Date
  updatedAt: Date
}

const transactionLimitEntrySchema = new Schema<TransactionLimitEntryFields>(
  {
    interval: {
      type: String,
      enum: Object.values(TransactionLimitInterval),
      required: true,
    },
    amount: { type: Number, required: true },
  },
  { _id: false },
)

const transactionLimitsSchema = new Schema<TransactionLimitsFields>(
  {
    currency: { type: String, required: true, maxlength: 3, minlength: 3 },
    limits: { type: [transactionLimitEntrySchema], required: true },
  },
  { _id: false },
)

const blockedTransactionUsageSchema = new Schema<BlockedTransactionUsageFields>(
  {
    transactionScope: { type: String, required: true },
    usageScope: { type: String, required: true },
  },
  { _id: false },
)

const cardControlsSubSchema = new Schema<CardControlsFields>(
  {
    allowedTransactionCount: {
      type: String,
      enum: Object.values(AllowedTransactionCount),
      required: true,
    },
    transactionLimits: { type: transactionLimitsSchema, required: true },
    activeFrom: { type: Date, default: null },
    activeTo: { type: Date, default: null },
    allowedCurrencies: { type: [String], default: null },
    allowedMerchantCategories: { type: [String], default: null },
    allowedMerchantCountries: { type: [String], default: null },
    allowedMerchantBrands: { type: [String], default: null },
    blockedTransactionUsages: {
      type: [blockedTransactionUsageSchema],
      required: true,
      default: [],
    },
  },
  { _id: false },
)

const cardSchema = new Schema<CardFields, Model<CardFields>>(
  {
    orgId: { type: String, required: true, index: true },
    projectId: { type: String, default: null },
    categoryId: { type: String, default: null },
    cardholderId: { type: String, required: true },
    airwallexCardId: { type: String, required: true },
    maskedNumber: { type: String, required: true },
    nickName: { type: String, required: true, trim: true, maxlength: 100 },
    purpose: {
      type: String,
      enum: Object.values(CardPurpose),
      required: true,
    },
    status: {
      type: String,
      enum: Object.values(CardStatus),
      required: true,
      default: CardStatus.PENDING,
    },
    desiredControls: { type: cardControlsSubSchema, required: true },
    appliedControls: { type: cardControlsSubSchema, required: true },
    lastReconciledAt: { type: Date, default: null },
    managedByRuleIds: { type: [String], required: true, default: [] },
    accessList: { type: [String], required: true, default: [] },
  },
  {
    ...baseOptions,
    collection: 'cards',
  },
)

cardSchema.plugin(tenantScoped)
cardSchema.index({ orgId: 1, airwallexCardId: 1 }, { unique: true })
cardSchema.index({ orgId: 1, projectId: 1, status: 1 })
cardSchema.index({ orgId: 1, cardholderId: 1 })

export type CardDoc = HydratedDocument<CardFields>
export const CardModel = (models.Card ?? model<CardFields>('Card', cardSchema)) as Model<CardFields>
