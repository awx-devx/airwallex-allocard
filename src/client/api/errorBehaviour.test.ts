import { describe, expect, it } from 'vitest'
import { ApiError } from '@/client/api/errors'
import { buildSignInHref, resolveErrorBehaviour } from '@/client/api/errorBehaviour'
import { ErrorCode } from '@/shared/enums/errors'

describe('resolveErrorBehaviour', () => {
  it('covers every ErrorCode', () => {
    const cases: Array<{ code: ErrorCode; status: number; expectType: string }> = [
      { code: ErrorCode.UNAUTHENTICATED, status: 401, expectType: 'redirect' },
      { code: ErrorCode.ONBOARDING_INCOMPLETE, status: 403, expectType: 'redirect' },
      { code: ErrorCode.PERMISSION_DENIED, status: 403, expectType: 'inline-permission' },
      { code: ErrorCode.NOT_FOUND, status: 404, expectType: 'not-found' },
      { code: ErrorCode.VALIDATION_FAILED, status: 422, expectType: 'field-errors' },
      { code: ErrorCode.CONFLICT, status: 409, expectType: 'toast-refetch' },
      { code: ErrorCode.RATE_LIMITED, status: 429, expectType: 'retryable' },
      { code: ErrorCode.UPSTREAM_ERROR, status: 502, expectType: 'retryable' },
      { code: ErrorCode.INTERNAL, status: 500, expectType: 'retryable' },
      { code: ErrorCode.INVITE_EXPIRED, status: 409, expectType: 'toast' },
      { code: ErrorCode.INVITE_REVOKED, status: 409, expectType: 'toast' },
      { code: ErrorCode.INVITE_ALREADY_ACCEPTED, status: 409, expectType: 'toast' },
    ]

    for (const { code, status, expectType } of cases) {
      const behaviour = resolveErrorBehaviour(new ApiError(code, `msg-${code}`, status))
      expect(behaviour.type).toBe(expectType)
    }
  })

  it('reads permission and fieldErrors from details', () => {
    expect(
      resolveErrorBehaviour(
        new ApiError(ErrorCode.PERMISSION_DENIED, 'Missing x', 403, { permission: 'x' }),
      ),
    ).toEqual({ type: 'inline-permission', permission: 'x' })

    expect(
      resolveErrorBehaviour(
        new ApiError(ErrorCode.VALIDATION_FAILED, 'Validation failed', 422, {
          fieldErrors: { name: ['required'] },
        }),
      ),
    ).toEqual({ type: 'field-errors', fieldErrors: { name: ['required'] } })
  })
})

describe('buildSignInHref', () => {
  it('preserves safe relative paths', () => {
    expect(buildSignInHref('/dashboard')).toBe('/sign-in?returnTo=%2Fdashboard')
  })

  it('rejects open redirects', () => {
    expect(buildSignInHref('//evil.com')).toBe('/sign-in')
    expect(buildSignInHref('https://evil.com')).toBe('/sign-in')
    expect(buildSignInHref('dashboard')).toBe('/sign-in')
  })
})
