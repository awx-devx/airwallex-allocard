import { Schema, model, models, type HydratedDocument, type Model } from 'mongoose'
import { baseOptions } from '@/server/models/base'

/** Nested settings stored on the organisation document. */
export type OrganizationSettingsFields = {
  defaultApprovalPolicy: string | null
  notifications: Record<string, boolean>
}

/**
 * Storage shape. `createdBy` is model-internal (not on the public organization
 * contract); repositories may expose it when needed.
 */
export type OrganizationFields = {
  name: string
  slug: string
  country: string
  baseCurrency: string
  costCentres: string[]
  settings: OrganizationSettingsFields
  airwallexAccountId: string | null
  createdBy: string
  createdAt: Date
  updatedAt: Date
}

const organizationSettingsSchema = new Schema<OrganizationSettingsFields>(
  {
    defaultApprovalPolicy: { type: String, default: null },
    notifications: { type: Schema.Types.Mixed, default: {} },
  },
  { _id: false },
)

const organizationSchema = new Schema<OrganizationFields, Model<OrganizationFields>>(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      maxlength: 64,
    },
    country: { type: String, required: true, uppercase: true, minlength: 2, maxlength: 2 },
    baseCurrency: { type: String, required: true, uppercase: true, minlength: 3, maxlength: 3 },
    costCentres: { type: [String], required: true, default: [] },
    settings: {
      type: organizationSettingsSchema,
      required: true,
      default: () => ({ defaultApprovalPolicy: null, notifications: {} }),
    },
    airwallexAccountId: { type: String, default: null },
    createdBy: { type: String, required: true },
  },
  {
    ...baseOptions,
    collection: 'organizations',
  },
)

export type OrganizationDoc = HydratedDocument<OrganizationFields>
export const OrganizationModel = (models.Organization ??
  model<OrganizationFields>('Organization', organizationSchema)) as Model<OrganizationFields>
