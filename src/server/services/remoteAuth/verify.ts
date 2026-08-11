/**
 * Airwallex remote-auth request signature (x-nonce + x-signature).
 * HMAC-SHA256 of the nonce, Base64-encoded — not the same as webhook HMAC.
 */
import { createHmac, timingSafeEqual } from 'node:crypto'

export const REMOTE_AUTH_NONCE_HEADER = 'x-nonce'
export const REMOTE_AUTH_SIGNATURE_HEADER = 'x-signature'
export const REMOTE_AUTH_MAX_AGE_MS = 5 * 60_000

export type VerifyRemoteAuthResult =
  { ok: true } | { ok: false; reason: 'missing_headers' | 'invalid_signature' | 'stale_timestamp' }

function safeEqualBase64(a: string, b: string): boolean {
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

export function computeRemoteAuthSignature(secret: string, nonce: string): string {
  return createHmac('sha256', secret).update(nonce).digest('base64')
}

export function verifyRemoteAuthSignature(input: {
  nonce: string | null
  signature: string | null
  secret: string
  nowMs?: number
  maxAgeMs?: number
}): VerifyRemoteAuthResult {
  const { nonce, signature, secret } = input
  if (!nonce || !signature) {
    return { ok: false, reason: 'missing_headers' }
  }

  const timestampPart = nonce.split('.')[0]
  const ts = Number(timestampPart)
  if (!Number.isFinite(ts)) {
    return { ok: false, reason: 'stale_timestamp' }
  }

  const nowMs = input.nowMs ?? Date.now()
  const maxAgeMs = input.maxAgeMs ?? REMOTE_AUTH_MAX_AGE_MS
  if (nowMs - ts > maxAgeMs || ts - nowMs > maxAgeMs) {
    return { ok: false, reason: 'stale_timestamp' }
  }

  const expected = computeRemoteAuthSignature(secret, nonce)
  if (!safeEqualBase64(signature, expected)) {
    return { ok: false, reason: 'invalid_signature' }
  }

  return { ok: true }
}
