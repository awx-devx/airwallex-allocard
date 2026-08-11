import { Schema, model, models, type HydratedDocument, type Model } from 'mongoose'
import { WebhookEventStatus } from '@/shared/enums/webhookEventStatus'
import { baseOptions } from '@/server/models/base'

/**
 * Airwallex webhook envelope. Not tenant-scoped: one shared Airwallex account
 * (ARCHITECTURE D1) delivers events for every org; routing to org happens when
 * processing payload → card mirror. Idempotency is global on `eventId`.
 *
 * Dates are `Date` in Mongo; `toJSON` / `toDomain` emit ISO strings.
 */
export type WebhookEventFields = {
  eventId: string
  name: string
  accountId: string | null
  payload: Record<string, unknown>
  receivedAt: Date
  processedAt: Date | null
  status: WebhookEventStatus
  attempts: number
  error: string | null
  createdAt: Date
  updatedAt: Date
}

const webhookEventSchema = new Schema<WebhookEventFields, Model<WebhookEventFields>>(
  {
    eventId: { type: String, required: true },
    name: { type: String, required: true },
    accountId: { type: String, default: null },
    payload: { type: Schema.Types.Mixed, required: true },
    receivedAt: { type: Date, required: true },
    processedAt: { type: Date, default: null },
    status: {
      type: String,
      enum: Object.values(WebhookEventStatus),
      required: true,
      default: WebhookEventStatus.RECEIVED,
    },
    attempts: { type: Number, required: true, default: 0 },
    error: { type: String, default: null },
  },
  {
    ...baseOptions,
    collection: 'webhookEvents',
  },
)

webhookEventSchema.index({ eventId: 1 }, { unique: true })
webhookEventSchema.index({ status: 1, receivedAt: -1 })

export type WebhookEventDoc = HydratedDocument<WebhookEventFields>
export const WebhookEventModel = (models.WebhookEvent ??
  model<WebhookEventFields>('WebhookEvent', webhookEventSchema)) as Model<WebhookEventFields>
