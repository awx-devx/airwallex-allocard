/**
 * Airwallex webhook HMAC verification — raw body only, never re-serialised JSON.
 * @see docs/AIRWALLEX-INTEGRATION.md §6
 */
import { createHmac, timingSafeEqual } from 'node:crypto'

/** Reject timestamps older than this (Airwallex integration doc). */
export const WEBHOOK_MAX_AGE_MS = 5 * 60_000

/** Redis dedupe TTL — ARCHITECTURE §10. */
export const WEBHOOK_DEDUPE_TTL_MS = 24 * 60 * 60_000

export const WEBHOOK_TIMESTAMP_HEADER = 'x-timestamp'
export const WEBHOOK_SIGNATURE_HEADER = 'x-signature'
/** Sandbox test events send the HMAC secret in this header. */
export const WEBHOOK_TEST_SECRET_HEADER = 'client-secret-key'

export type VerifyWebhookResult =
  { ok: true } | { ok: false; reason: 'missing_headers' | 'invalid_signature' | 'stale_timestamp' }

function safeEqualHex(a: string, b: string): boolean {
  try {
    const left = Buffer.from(a, 'utf8')
    const right = Buffer.from(b, 'utf8')
    if (left.length !== right.length) {
      return false
    }
    return timingSafeEqual(left, right)
  } catch {
    return false
  }
}

export function computeWebhookSignature(
  secret: string,
  timestamp: string,
  rawBody: string,
): string {
  return createHmac('sha256', secret).update(`${timestamp}${rawBody}`).digest('hex')
}

/**
 * Verify HMAC(timestamp + rawBody) and freshness.
 * `secret` is AIRWALLEX_WEBHOOK_SECRET, or the test-event header override.
 */
export function verifyWebhookSignature(input: {
  rawBody: string
  timestamp: string | null
  signature: string | null
  secret: string
  nowMs?: number
  maxAgeMs?: number
}): VerifyWebhookResult {
  const { rawBody, timestamp, signature, secret } = input
  if (!timestamp || !signature) {
    return { ok: false, reason: 'missing_headers' }
  }

  const ts = Number(timestamp)
  if (!Number.isFinite(ts)) {
    return { ok: false, reason: 'stale_timestamp' }
  }

  const nowMs = input.nowMs ?? Date.now()
  const maxAgeMs = input.maxAgeMs ?? WEBHOOK_MAX_AGE_MS
  if (nowMs - ts > maxAgeMs || ts - nowMs > maxAgeMs) {
    return { ok: false, reason: 'stale_timestamp' }
  }

  const expected = computeWebhookSignature(secret, timestamp, rawBody)
  if (!safeEqualHex(signature, expected)) {
    return { ok: false, reason: 'invalid_signature' }
  }

  return { ok: true }
}

/** Resolve HMAC secret: test-event header wins when present. */
export function resolveWebhookSecret(
  configuredSecret: string,
  testSecretHeader: string | null,
): string {
  if (testSecretHeader && testSecretHeader.length > 0) {
    return testSecretHeader
  }
  return configuredSecret
}
