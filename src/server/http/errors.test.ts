import { describe, expect, it } from 'vitest'
import { ErrorCode } from '@/shared/enums/errors'
import { AppError, serializeError } from '@/server/http/errors'

const EXPECTED_STATUS: Record<ErrorCode, number> = {
  [ErrorCode.UNAUTHENTICATED]: 401,
  [ErrorCode.ONBOARDING_INCOMPLETE]: 403,
  [ErrorCode.PERMISSION_DENIED]: 403,
  [ErrorCode.NOT_FOUND]: 404,
  [ErrorCode.CONFLICT]: 409,
  [ErrorCode.VALIDATION_FAILED]: 422,
  [ErrorCode.RATE_LIMITED]: 429,
  [ErrorCode.UPSTREAM_ERROR]: 502,
  [ErrorCode.INTERNAL]: 500,
}

describe('serializeError', () => {
  it('maps every ErrorCode to the right status', () => {
    for (const code of Object.values(ErrorCode)) {
      const { status, body } = serializeError(new AppError(code, `msg-${code}`))
      expect(status).toBe(EXPECTED_STATUS[code])
      expect(body).toEqual({
        error: { code, message: `msg-${code}` },
      })
    }
  })

  it('includes details when present', () => {
    const { body } = serializeError(AppError.permissionDenied('card.create'))
    expect(body).toEqual({
      error: {
        code: ErrorCode.PERMISSION_DENIED,
        message: 'Missing card.create',
        details: { permission: 'card.create' },
      },
    })
  })

  it('turns unknown errors into INTERNAL without leaking a stack', () => {
    const boom = new Error('secret stack material')
    const { status, body } = serializeError(boom)

    expect(status).toBe(500)
    expect(body).toEqual({
      error: {
        code: ErrorCode.INTERNAL,
        message: 'Internal error',
      },
    })
    expect(JSON.stringify(body)).not.toContain('secret stack material')
    expect(JSON.stringify(body)).not.toContain('stack')
  })
})

describe('AppError constructors', () => {
  it('builds the listed factory errors', () => {
    expect(AppError.unauthenticated().code).toBe(ErrorCode.UNAUTHENTICATED)
    expect(AppError.permissionDenied('x').details).toEqual({ permission: 'x' })
    expect(AppError.notFound().code).toBe(ErrorCode.NOT_FOUND)
    expect(AppError.conflict('dup').message).toBe('dup')
    expect(AppError.validationFailed({ name: ['required'] }).details).toEqual({
      fieldErrors: { name: ['required'] },
    })
    expect(AppError.upstreamError('awx down').code).toBe(ErrorCode.UPSTREAM_ERROR)
  })
})
