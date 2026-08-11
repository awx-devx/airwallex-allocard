import { z } from 'zod'
import { airwallexWebhookRawInput, webhookEventSchema } from '@/shared/schemas/webhookEvent'

export type WebhookEvent = z.infer<typeof webhookEventSchema>
export type AirwallexWebhookRawInput = z.infer<typeof airwallexWebhookRawInput>
