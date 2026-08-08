/**
 * Canonical API error codes. Status mapping lives in `server/http/errors.ts`.
 */
export enum ErrorCode {
  UNAUTHENTICATED = 'UNAUTHENTICATED',
  ONBOARDING_INCOMPLETE = 'ONBOARDING_INCOMPLETE',
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  NOT_FOUND = 'NOT_FOUND',
  CONFLICT = 'CONFLICT',
  /** Invite past `expiresAt` (or status EXPIRED). */
  INVITE_EXPIRED = 'INVITE_EXPIRED',
  /** Invite was revoked before acceptance. */
  INVITE_REVOKED = 'INVITE_REVOKED',
  /** Invite was already consumed. */
  INVITE_ALREADY_ACCEPTED = 'INVITE_ALREADY_ACCEPTED',
  VALIDATION_FAILED = 'VALIDATION_FAILED',
  RATE_LIMITED = 'RATE_LIMITED',
  UPSTREAM_ERROR = 'UPSTREAM_ERROR',
  INTERNAL = 'INTERNAL',
}
