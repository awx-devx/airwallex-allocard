import { ApiError } from '@/client/api/errors'
import { ErrorCode } from '@/shared/enums/errors'

export type ErrorBehaviour =
  | { type: 'redirect'; to: '/sign-in' | '/onboarding'; preserveReturn: boolean }
  | { type: 'inline-permission'; permission?: string }
  | { type: 'not-found' }
  | { type: 'field-errors'; fieldErrors: Record<string, string[]> }
  | { type: 'toast-refetch'; message: string }
  | { type: 'retryable'; message: string }
  | { type: 'toast'; message: string }

function readPermission(details: unknown): string | undefined {
  if (
    typeof details === 'object' &&
    details !== null &&
    'permission' in details &&
    typeof (details as { permission: unknown }).permission === 'string'
  ) {
    return (details as { permission: string }).permission
  }
  return undefined
}

function readFieldErrors(details: unknown): Record<string, string[]> {
  if (
    typeof details === 'object' &&
    details !== null &&
    'fieldErrors' in details &&
    typeof (details as { fieldErrors: unknown }).fieldErrors === 'object' &&
    (details as { fieldErrors: unknown }).fieldErrors !== null
  ) {
    const raw = (details as { fieldErrors: Record<string, unknown> }).fieldErrors
    const out: Record<string, string[]> = {}
    for (const [key, value] of Object.entries(raw)) {
      if (Array.isArray(value) && value.every((v) => typeof v === 'string')) {
        out[key] = value
      } else if (value === undefined) {
        out[key] = []
      }
    }
    return out
  }
  return {}
}

export function resolveErrorBehaviour(error: ApiError): ErrorBehaviour {
  switch (error.code) {
    case ErrorCode.UNAUTHENTICATED:
      return { type: 'redirect', to: '/sign-in', preserveReturn: true }
    case ErrorCode.ONBOARDING_INCOMPLETE:
      return { type: 'redirect', to: '/onboarding', preserveReturn: false }
    case ErrorCode.PERMISSION_DENIED:
      return { type: 'inline-permission', permission: readPermission(error.details) }
    case ErrorCode.NOT_FOUND:
      return { type: 'not-found' }
    case ErrorCode.VALIDATION_FAILED:
      return { type: 'field-errors', fieldErrors: readFieldErrors(error.details) }
    case ErrorCode.CONFLICT:
      return { type: 'toast-refetch', message: error.message }
    case ErrorCode.RATE_LIMITED:
    case ErrorCode.UPSTREAM_ERROR:
    case ErrorCode.INTERNAL:
      return { type: 'retryable', message: error.message }
    case ErrorCode.INVITE_EXPIRED:
    case ErrorCode.INVITE_REVOKED:
    case ErrorCode.INVITE_ALREADY_ACCEPTED:
      return { type: 'toast', message: error.message }
    default: {
      const _exhaustive: never = error.code
      return { type: 'retryable', message: String(_exhaustive) }
    }
  }
}

/** Safe relative path only — rejects protocol-relative and absolute URLs. */
export function isSafeReturnPath(path: string): boolean {
  return path.startsWith('/') && !path.startsWith('//')
}

export function buildSignInHref(returnPath: string): string {
  if (!isSafeReturnPath(returnPath)) {
    return '/sign-in'
  }
  return `/sign-in?returnTo=${encodeURIComponent(returnPath)}`
}
