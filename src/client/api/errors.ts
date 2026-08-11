import { ErrorCode } from '@/shared/enums/errors'
import { errorEnvelopeSchema } from '@/shared/schemas/error'

export class ApiError extends Error {
  readonly code: ErrorCode
  readonly details?: unknown
  readonly status: number

  constructor(code: ErrorCode, message: string, status: number, details?: unknown) {
    super(message)
    this.name = 'ApiError'
    this.code = code
    this.status = status
    this.details = details
  }

  static fromResponse(status: number, body: unknown): ApiError {
    const parsed = errorEnvelopeSchema.safeParse(body)
    if (!parsed.success) {
      return new ApiError(ErrorCode.INTERNAL, 'Internal error', status || 500)
    }
    const { code, message, details } = parsed.data.error
    return new ApiError(code, message, status, details)
  }
}

export function isApiError(e: unknown): e is ApiError {
  return e instanceof ApiError
}
