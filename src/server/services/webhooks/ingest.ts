/**
 * Persist + enqueue Airwallex webhooks. Processing happens in the worker (B8.4).
 */
import { DomainEventType } from '@/server/events/types'
import { WEBHOOKS_STREAM, getEventStream } from '@/server/events/stream'
import { getRedis, redisKeys } from '@/server/redis'
import * as webhookEvents from '@/server/repositories/webhookEvents'
import { WEBHOOK_DEDUPE_TTL_MS } from '@/server/services/webhooks/verify'

export type IngestWebhookResult = {
  /** False when Redis NX or unique eventId says we already saw this. */
  accepted: boolean
  eventId: string
}

function readEventId(payload: Record<string, unknown>): string | null {
  const id = payload.id
  if (typeof id === 'string' && id.length > 0) {
    return id
  }
  return null
}

function readEventName(payload: Record<string, unknown>): string {
  if (typeof payload.name === 'string' && payload.name.length > 0) {
    return payload.name
  }
  if (typeof payload.type === 'string' && payload.type.length > 0) {
    return payload.type
  }
  return 'unknown'
}

function readAccountId(payload: Record<string, unknown>): string | null {
  const accountId = payload.account_id
  if (typeof accountId === 'string' && accountId.length > 0) {
    return accountId
  }
  return null
}

/**
 * After signature verification: Redis SET NX → persist → XADD webhooks stream.
 * Always safe to call; duplicates are no-ops that still return quickly.
 */
export async function ingestVerifiedWebhook(
  payload: Record<string, unknown>,
  receivedAt: Date = new Date(),
): Promise<IngestWebhookResult> {
  const eventId = readEventId(payload)
  if (!eventId) {
    throw new Error('Webhook payload missing event id')
  }

  const redis = getRedis()
  const claimed = await redis.set(redisKeys.webhook(eventId), '1', {
    nx: true,
    px: WEBHOOK_DEDUPE_TTL_MS,
  })

  if (!claimed) {
    return { accepted: false, eventId }
  }

  const { event, created } = await webhookEvents.insertWebhookEvent({
    eventId,
    name: readEventName(payload),
    accountId: readAccountId(payload),
    payload,
    receivedAt,
  })

  if (!created) {
    return { accepted: false, eventId }
  }

  await getEventStream().publish(WEBHOOKS_STREAM, {
    type: DomainEventType.AIRWALLEX_WEBHOOK,
    orgId: '_airwallex',
    subjectType: 'webhookEvent',
    subjectId: event.id,
    payload: { eventId: event.eventId, name: event.name },
    emittedAt: receivedAt,
  })

  return { accepted: true, eventId }
}
