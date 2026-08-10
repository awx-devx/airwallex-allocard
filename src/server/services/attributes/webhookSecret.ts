import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'

/** Opaque webhook secret — returned once on create/rotate; never stored. */
export function generateWebhookSecret(): string {
  return randomBytes(32).toString('base64url')
}

/** SHA-256 hex digest for storage and lookup. */
export function hashWebhookSecret(secret: string): string {
  return createHash('sha256').update(secret).digest('hex')
}

/** Constant-time compare of a plaintext secret against a stored hex digest. */
export function verifyWebhookSecret(secret: string, storedHash: string): boolean {
  const incoming = Buffer.from(hashWebhookSecret(secret), 'utf8')
  const stored = Buffer.from(storedHash, 'utf8')
  if (incoming.length !== stored.length) {
    return false
  }
  return timingSafeEqual(incoming, stored)
}
