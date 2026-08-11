import { z } from 'zod'
import { WebhookEventStatus } from '@/shared/enums/webhookEventStatus'
import { idSchema, isoDateSchema } from '@/shared/schemas/base'

/**
 * Persisted Airwallex webhook envelope.
 * Tenancy: keyed by eventId globally (shared Airwallex account — ARCHITECTURE D1);
 * org routing happens when processing payload → card mirror.
 */
export const webhookEventSchema = z.object({
  id: idSchema,
  /** Airwallex `event.id` — unique; Redis SET NX + unique index. */
  eventId: z.string().min(1),
  name: z.string().min(1),
  accountId: z.string().min(1).nullable(),
  payload: z.record(z.string(), z.unknown()),
  receivedAt: isoDateSchema,
  processedAt: isoDateSchema.nullable(),
  status: z.enum(WebhookEventStatus),
  attempts: z.number().int().nonnegative(),
  error: z.string().nullable(),
})

/**
 * POST /api/webhooks/airwallex — body is raw text; HMAC before JSON.parse.
 * Contract uses unknown so handlers do not Zod-parse the body first.
 */
export const airwallexWebhookRawInput = z.unknown()
