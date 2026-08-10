import { Schema, model, models, type HydratedDocument, type Model } from 'mongoose'
import { AttributeSource } from '@/shared/enums/attributeSource'
import { AttributeSubjectType } from '@/shared/enums/attributeSubjectType'
import { baseOptions, tenantScoped } from '@/server/models/base'

/**
 * One current value per (orgId, key, subjectType, subjectId).
 * `observedAt` is a `Date` in Mongo; `toDomain` emits ISO. `value` is Mixed —
 * number, string, boolean, or null. Staleness is derived from `observedAt + ttlSec`
 * at read time; a stale value is never rewritten to zero.
 */
export type AttributeValueFields = {
  orgId: string
  key: string
  subjectType: AttributeSubjectType
  subjectId: string
  value: unknown
  observedAt: Date
  source: AttributeSource
  ttlSec: number | null
  createdAt: Date
  updatedAt: Date
}

const attributeValueSchema = new Schema<AttributeValueFields, Model<AttributeValueFields>>(
  {
    orgId: { type: String, required: true, index: true },
    key: { type: String, required: true, trim: true, maxlength: 120 },
    subjectType: {
      type: String,
      enum: Object.values(AttributeSubjectType),
      required: true,
    },
    subjectId: { type: String, required: true },
    value: { type: Schema.Types.Mixed, default: null },
    observedAt: { type: Date, required: true },
    source: {
      type: String,
      enum: Object.values(AttributeSource),
      required: true,
    },
    ttlSec: { type: Number, default: null },
  },
  {
    ...baseOptions,
    collection: 'attributeValues',
  },
)

attributeValueSchema.plugin(tenantScoped)
attributeValueSchema.index({ orgId: 1, key: 1, subjectType: 1, subjectId: 1 }, { unique: true })
attributeValueSchema.index({ orgId: 1, subjectType: 1, subjectId: 1 })

export type AttributeValueDoc = HydratedDocument<AttributeValueFields>
export const AttributeValueModel = (models.AttributeValue ??
  model<AttributeValueFields>(
    'AttributeValue',
    attributeValueSchema,
  )) as Model<AttributeValueFields>
