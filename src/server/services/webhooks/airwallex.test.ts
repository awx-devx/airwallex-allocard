import { createHmac } from 'node:crypto'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { useTestDb } from '../../../../test/helpers/db'
import { WEBHOOKS_STREAM, getEventStream, resetEventStream } from '@/server/events/stream'
import { DomainEventType } from '@/server/events/types'
import { WebhookEventModel } from '@/server/models/WebhookEvent'
import { getRedis, redisKeys, resetRedis } from '@/server/redis'
import * as webhookEvents from '@/server/repositories/webhookEvents'
import { POST } from '@/app/api/webhooks/airwallex/route'
import {
  WEBHOOK_SIGNATURE_HEADER,
  WEBHOOK_TEST_SECRET_HEADER,
  WEBHOOK_TIMESTAMP_HEADER,
  WEBHOOK_MAX_AGE_MS,
  computeWebhookSignature,
  verifyWebhookSignature,
} from '@/server/services/webhooks/verify'

const SECRET = 'test-webhook-secret'

function sign(rawBody: string, timestamp: string, secret = SECRET): string {
  return computeWebhookSignature(secret, timestamp, rawBody)
}

function buildWebhookRequest(
  body: string,
  options: {
    timestamp?: string
    signature?: string | null
    secret?: string
    testSecretHeader?: string
  } = {},
): Request {
  const timestamp = options.timestamp ?? String(Date.now())
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    [WEBHOOK_TIMESTAMP_HEADER]: timestamp,
  }
  if (options.signature === null) {
    // omit signature
  } else {
    headers[WEBHOOK_SIGNATURE_HEADER] =
      options.signature ?? sign(body, timestamp, options.secret ?? SECRET)
  }
  if (options.testSecretHeader !== undefined) {
    headers[WEBHOOK_TEST_SECRET_HEADER] = options.testSecretHeader
  }
  return new Request('http://localhost/api/webhooks/airwallex', {
    method: 'POST',
    headers,
    body,
  })
}

describe('webhooks/airwallex', () => {
  useTestDb()

  beforeEach(async () => {
    resetRedis()
    getRedis({ url: null })
    resetEventStream()
    await WebhookEventModel.syncIndexes()
  })

  afterEach(() => {
    resetRedis()
    resetEventStream()
  })

  describe('verifyWebhookSignature', () => {
    it('accepts raw body and rejects re-serialised body', () => {
      // Whitespace / key order differ after parse+stringify.
      const raw = '{ "id" : "evt_1", "z":1, "a":2, "name":"issuing.card_transaction.authorized" }'
      const timestamp = String(Date.now())
      const signature = sign(raw, timestamp)

      expect(
        verifyWebhookSignature({
          rawBody: raw,
          timestamp,
          signature,
          secret: SECRET,
        }).ok,
      ).toBe(true)

      const reserialised = JSON.stringify(JSON.parse(raw))
      expect(reserialised).not.toBe(raw)
      expect(
        verifyWebhookSignature({
          rawBody: reserialised,
          timestamp,
          signature,
          secret: SECRET,
        }),
      ).toEqual({ ok: false, reason: 'invalid_signature' })
    })

    it('rejects stale timestamps', () => {
      const raw = '{"id":"evt_stale"}'
      const timestamp = String(Date.now() - WEBHOOK_MAX_AGE_MS - 1)
      const signature = sign(raw, timestamp)
      expect(
        verifyWebhookSignature({
          rawBody: raw,
          timestamp,
          signature,
          secret: SECRET,
        }),
      ).toEqual({ ok: false, reason: 'stale_timestamp' })
    })
  })

  describe('POST /api/webhooks/airwallex', () => {
    it('returns 400 and persists nothing on invalid signature', async () => {
      const raw = '{"id":"evt_bad","name":"issuing.transaction.succeeded"}'
      const res = await POST(buildWebhookRequest(raw, { signature: 'deadbeef' }))
      expect(res.status).toBe(400)
      expect(await res.text()).toBe('invalid signature')
      expect(await webhookEvents.findWebhookEventByEventId('evt_bad')).toBeNull()
    })

    it('returns 400 for stale timestamp', async () => {
      const raw = '{"id":"evt_old","name":"issuing.transaction.succeeded"}'
      const timestamp = String(Date.now() - WEBHOOK_MAX_AGE_MS - 5_000)
      const res = await POST(buildWebhookRequest(raw, { timestamp }))
      expect(res.status).toBe(400)
      expect(await res.text()).toBe('stale')
      expect(await webhookEvents.findWebhookEventByEventId('evt_old')).toBeNull()
    })

    it('persists, enqueues, and returns 200 for a valid event', async () => {
      const raw =
        '{"id":"evt_ok","name":"issuing.card_transaction.authorized","account_id":"acct_1"}'
      const res = await POST(buildWebhookRequest(raw))
      expect(res.status).toBe(200)
      expect(await res.text()).toBe('ok')

      const stored = await webhookEvents.findWebhookEventByEventId('evt_ok')
      expect(stored).toMatchObject({
        eventId: 'evt_ok',
        name: 'issuing.card_transaction.authorized',
        accountId: 'acct_1',
      })
      expect(await getRedis().get(redisKeys.webhook('evt_ok'))).toBe('1')

      const entries = await getEventStream().readGroup({
        stream: WEBHOOKS_STREAM,
        group: 'test',
        consumer: 'c1',
        blockMs: -1,
      })
      expect(entries).toHaveLength(1)
      expect(entries[0]?.event.type).toBe(DomainEventType.AIRWALLEX_WEBHOOK)
      expect(entries[0]?.event.payload).toMatchObject({ eventId: 'evt_ok' })
    })

    it('deduplicates on event.id — processes exactly once', async () => {
      const raw = '{"id":"evt_dup","name":"issuing.transaction.succeeded"}'
      const first = await POST(buildWebhookRequest(raw))
      const second = await POST(buildWebhookRequest(raw))
      expect(first.status).toBe(200)
      expect(second.status).toBe(200)

      const count = await WebhookEventModel.countDocuments({ eventId: 'evt_dup' })
      expect(count).toBe(1)

      const entries = await getEventStream().readGroup({
        stream: WEBHOOKS_STREAM,
        group: 'test-dup',
        consumer: 'c1',
        blockMs: -1,
      })
      expect(entries).toHaveLength(1)
    })

    it('uses client-secret-key header for sandbox test events', async () => {
      const testSecret = 'sandbox-test-secret'
      const raw = '{"id":"evt_test","name":"issuing.transaction.succeeded"}'
      const timestamp = String(Date.now())
      const signature = createHmac('sha256', testSecret).update(`${timestamp}${raw}`).digest('hex')

      const res = await POST(
        buildWebhookRequest(raw, {
          timestamp,
          signature,
          testSecretHeader: testSecret,
        }),
      )
      expect(res.status).toBe(200)
      expect(await webhookEvents.findWebhookEventByEventId('evt_test')).not.toBeNull()
    })

    it('accepts the event without running ledger processing inline', async () => {
      // Processing is the worker's job (B8.4). Ingest only persists + XADD.
      const raw = '{"id":"evt_fast","name":"issuing.transaction.succeeded"}'
      const res = await POST(buildWebhookRequest(raw))
      expect(res.status).toBe(200)
      expect(await webhookEvents.findWebhookEventByEventId('evt_fast')).not.toBeNull()
      // No transaction rows — processing has not run.
      const { TransactionModel } = await import('@/server/models/Transaction')
      expect(await TransactionModel.countDocuments({}).setOptions({ allowCrossTenant: true })).toBe(
        0,
      )
    })
  })
})
