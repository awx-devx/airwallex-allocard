import { z } from 'zod'
import { defineContract } from '@/shared/contracts/types'
import { airwallexWebhookRawInput } from '@/shared/schemas/webhookEvent'

/**
 * Webhook ingest. Handler MUST `req.text()` + HMAC before any JSON parse;
 * this contract documents the endpoint only — do not withValidation(body).
 */
export const webhookContracts = {
  airwallex: defineContract({
    method: 'POST',
    path: '/api/webhooks/airwallex',
    input: airwallexWebhookRawInput,
    output: z.void(),
  }),
} as const

export type WebhookContracts = typeof webhookContracts
