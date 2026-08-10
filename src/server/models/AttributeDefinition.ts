import { Schema, model, models, type HydratedDocument, type Model } from 'mongoose'
import { AttributeScope } from '@/shared/enums/attributeScope'
import { AttributeSource } from '@/shared/enums/attributeSource'
import { AttributeType } from '@/shared/enums/attributeType'
import { baseOptionsOmitting, tenantScoped } from '@/server/models/base'

/**
 * Registry entry. Dates are `Date` in Mongo; `toJSON` / `toDomain` emit ISO strings.
 * `webhookSecretHash` is `select: false` and stripped from `toJSON` — the plaintext
 * secret never returns; `hasWebhookSecret` is the public signal.
 */
export type AttributeDefinitionFields = {
  orgId: string
  key: string
  label: string
  type: AttributeType
  unit: string | null
  scope: AttributeScope
  source: AttributeSource
  connectorId: string | null
  refreshIntervalSec: number | null
  enumValues: string[] | null
  hasWebhookSecret: boolean
  webhookSecretHash: string | null
  createdAt: Date
  updatedAt: Date
}

const attributeDefinitionSchema = new Schema<
  AttributeDefinitionFields,
  Model<AttributeDefinitionFields>
>(
  {
    orgId: { type: String, required: true, index: true },
    key: { type: String, required: true, trim: true, maxlength: 120 },
    label: { type: String, required: true, trim: true, maxlength: 120 },
    type: {
      type: String,
      enum: Object.values(AttributeType),
      required: true,
    },
    unit: { type: String, default: null },
    scope: {
      type: String,
      enum: Object.values(AttributeScope),
      required: true,
    },
    source: {
      type: String,
      enum: Object.values(AttributeSource),
      required: true,
    },
    connectorId: { type: String, default: null },
    refreshIntervalSec: { type: Number, default: null },
    enumValues: { type: [String], default: null },
    hasWebhookSecret: { type: Boolean, required: true, default: false },
    webhookSecretHash: { type: String, default: null, select: false },
  },
  {
    ...baseOptionsOmitting(['webhookSecretHash']),
    collection: 'attributeDefinitions',
  },
)

attributeDefinitionSchema.plugin(tenantScoped)
attributeDefinitionSchema.index({ orgId: 1, key: 1 }, { unique: true })
attributeDefinitionSchema.index({ orgId: 1, scope: 1 })
attributeDefinitionSchema.index({ orgId: 1, source: 1 })

export type AttributeDefinitionDoc = HydratedDocument<AttributeDefinitionFields>
export const AttributeDefinitionModel = (models.AttributeDefinition ??
  model<AttributeDefinitionFields>(
    'AttributeDefinition',
    attributeDefinitionSchema,
  )) as Model<AttributeDefinitionFields>
