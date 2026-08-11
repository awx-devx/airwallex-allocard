import { describe, expect, it } from 'vitest'
import { ApiError, isApiError } from '@/client/api/errors'
import { ErrorCode } from '@/shared/enums/errors'

describe('ApiError', () => {
  it('fromResponse parses a valid envelope', () => {
    const err = ApiError.fromResponse(403, {
      error: {
        code: ErrorCode.PERMISSION_DENIED,
        message: 'Missing card.create',
        details: { permission: 'card.create' },
      },
    })
    expect(err).toBeInstanceOf(ApiError)
    expect(err.code).toBe(ErrorCode.PERMISSION_DENIED)
    expect(err.message).toBe('Missing card.create')
    expect(err.status).toBe(403)
    expect(err.details).toEqual({ permission: 'card.create' })
  })

  it('fromResponse falls back to INTERNAL on bad body', () => {
    const err = ApiError.fromResponse(502, { nope: true })
    expect(err.code).toBe(ErrorCode.INTERNAL)
    expect(err.message).toBe('Internal error')
    expect(err.status).toBe(502)
  })

  it('fromResponse uses 500 when status is 0 and body invalid', () => {
    const err = ApiError.fromResponse(0, null)
    expect(err.status).toBe(500)
  })

  it('isApiError narrows', () => {
    expect(isApiError(new ApiError(ErrorCode.NOT_FOUND, 'x', 404))).toBe(true)
    expect(isApiError(new Error('x'))).toBe(false)
  })
})
