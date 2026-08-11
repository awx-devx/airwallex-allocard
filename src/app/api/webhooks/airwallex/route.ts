import { loadServerEnv } from '@/server/env'
import { ingestVerifiedWebhook } from '@/server/services/webhooks/ingest'
import {
  WEBHOOK_SIGNATURE_HEADER,
  WEBHOOK_TEST_SECRET_HEADER,
  WEBHOOK_TIMESTAMP_HEADER,
  resolveWebhookSecret,
  verifyWebhookSignature,
} from '@/server/services/webhooks/verify'

/**
 * POST /api/webhooks/airwallex
 * Four non-negotiables: raw body HMAC, verify before parse, 200 immediately,
 * dedupe on event.id. No withAuth / no Zod body parse.
 */
export async function POST(req: Request): Promise<Response> {
  const raw = await req.text()
  const timestamp = req.headers.get(WEBHOOK_TIMESTAMP_HEADER)
  const signature = req.headers.get(WEBHOOK_SIGNATURE_HEADER)
  const testSecret = req.headers.get(WEBHOOK_TEST_SECRET_HEADER)

  const env = loadServerEnv()
  const secret = resolveWebhookSecret(env.AIRWALLEX_WEBHOOK_SECRET, testSecret)
  const verified = verifyWebhookSignature({
    rawBody: raw,
    timestamp,
    signature,
    secret,
  })

  if (!verified.ok) {
    const message =
      verified.reason === 'stale_timestamp'
        ? 'stale'
        : verified.reason === 'missing_headers'
          ? 'missing signature headers'
          : 'invalid signature'
    return new Response(message, { status: 400 })
  }

  let payload: Record<string, unknown>
  try {
    const parsed: unknown = JSON.parse(raw)
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return new Response('invalid payload', { status: 400 })
    }
    payload = parsed as Record<string, unknown>
  } catch {
    return new Response('invalid payload', { status: 400 })
  }

  if (typeof payload.id !== 'string' || payload.id.length < 1) {
    return new Response('missing event id', { status: 400 })
  }

  await ingestVerifiedWebhook(payload)
  return new Response('ok', { status: 200 })
}
