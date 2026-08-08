import { createHash, randomBytes } from 'node:crypto'

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000

/** Opaque invite token — returned once on create; never stored. */
export function generateInviteToken(): string {
  return randomBytes(32).toString('base64url')
}

/** SHA-256 hex digest for storage and lookup. */
export function hashInviteToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

export function inviteExpiresAt(from = new Date()): Date {
  return new Date(from.getTime() + INVITE_TTL_MS)
}
