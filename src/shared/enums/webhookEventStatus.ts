/**
 * Ingest lifecycle for persisted webhook events.
 * RECEIVED on accept; PROCESSED after consumer success; FAILED after exhausted attempts.
 */
export const WebhookEventStatus = {
  RECEIVED: 'RECEIVED',
  PROCESSED: 'PROCESSED',
  FAILED: 'FAILED',
} as const

export type WebhookEventStatus = (typeof WebhookEventStatus)[keyof typeof WebhookEventStatus]
