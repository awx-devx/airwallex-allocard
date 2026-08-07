import { ErrorCode } from '@/shared/enums/errors'

export type FieldErrors = Record<string, string[] | undefined>

export class AppError extends Error {
  readonly code: ErrorCode
  readonly details?: unknown

  constructor(code: ErrorCode, message: string, details?: unknown) {
    super(message)
    this.name = 'AppError'
    this.code = code
    this.details = details
  }

  static unauthenticated(message = 'Unauthenticated'): AppError {
    return new AppError(ErrorCode.UNAUTHENTICATED, message)
  }

  static onboardingIncomplete(message = 'Onboarding incomplete'): AppError {
    return new AppError(ErrorCode.ONBOARDING_INCOMPLETE, message)
  }

  static permissionDenied(permission: string): AppError {
    return new AppError(ErrorCode.PERMISSION_DENIED, `Missing ${permission}`, { permission })
  }

  static notFound(message = 'Not found'): AppError {
    return new AppError(ErrorCode.NOT_FOUND, message)
  }

  static conflict(message = 'Conflict'): AppError {
    return new AppError(ErrorCode.CONFLICT, message)
  }

  static validationFailed(fieldErrors: FieldErrors): AppError {
    return new AppError(ErrorCode.VALIDATION_FAILED, 'Validation failed', { fieldErrors })
  }

  static rateLimited(message = 'Rate limited'): AppError {
    return new AppError(ErrorCode.RATE_LIMITED, message)
  }

  static upstreamError(message = 'Upstream error', details?: unknown): AppError {
    return new AppError(ErrorCode.UPSTREAM_ERROR, message, details)
  }

  static internal(message = 'Internal error'): AppError {
    return new AppError(ErrorCode.INTERNAL, message)
  }
}

const STATUS_BY_CODE: Record<ErrorCode, number> = {
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

export type ErrorEnvelope = {
  error: {
    code: ErrorCode
    message: string
    details?: unknown
  }
}

export type SerializedError = {
  status: number
  body: ErrorEnvelope
}

/** Map any thrown value to the standard error envelope. Never leaks a stack. */
export function serializeError(error: unknown): SerializedError {
  if (error instanceof AppError) {
    const body: ErrorEnvelope = {
      error: {
        code: error.code,
        message: error.message,
      },
    }
    if (error.details !== undefined) {
      body.error.details = error.details
    }
    return {
      status: STATUS_BY_CODE[error.code],
      body,
    }
  }

  return {
    status: STATUS_BY_CODE[ErrorCode.INTERNAL],
    body: {
      error: {
        code: ErrorCode.INTERNAL,
        message: 'Internal error',
      },
    },
  }
}
