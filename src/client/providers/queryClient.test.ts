import { describe, expect, it } from 'vitest'
import { ApiError } from '@/client/api/errors'
import { createAppQueryClient, queryRetryPredicate } from '@/client/providers/queryClient'
import { ErrorCode } from '@/shared/enums/errors'

describe('queryRetryPredicate', () => {
  it('does not retry 4xx ApiError', () => {
    const err = new ApiError(ErrorCode.NOT_FOUND, 'missing', 404)
    expect(queryRetryPredicate(0, err)).toBe(false)
  })

  it('retries 5xx ApiError up to twice (failureCount 0 and 1)', () => {
    const err = new ApiError(ErrorCode.INTERNAL, 'boom', 500)
    expect(queryRetryPredicate(0, err)).toBe(true)
    expect(queryRetryPredicate(1, err)).toBe(true)
    expect(queryRetryPredicate(2, err)).toBe(false)
  })

  it('does not retry non-ApiError', () => {
    expect(queryRetryPredicate(0, new Error('network'))).toBe(false)
  })
})

describe('createAppQueryClient', () => {
  it('applies F1 defaults', () => {
    const client = createAppQueryClient()
    const opts = client.getDefaultOptions().queries
    expect(opts?.staleTime).toBe(30_000)
    expect(opts?.gcTime).toBe(5 * 60_000)
    expect(opts?.refetchOnWindowFocus).toBe(true)
  })
})
