/**
 * Typed Airwallex client errors. Never include response bodies in messages
 * (may contain card data).
 */
export class AirwallexError extends Error {
  readonly status: number
  readonly code: string
  readonly retryable: boolean

  constructor(opts: { status: number; code: string; message: string; retryable?: boolean }) {
    super(opts.message)
    this.name = 'AirwallexError'
    this.status = opts.status
    this.code = opts.code
    this.retryable = opts.retryable ?? (opts.status === 429 || opts.status >= 500)
  }
}

export class AirwallexFixtureNotFoundError extends Error {
  readonly method: string
  readonly path: string
  readonly requestId?: string

  constructor(method: string, path: string, requestId?: string) {
    const suffix = requestId ? ` request_id=${requestId}` : ''
    super(
      `Airwallex fixture missing for ${method} ${path}${suffix}. Record a fixture; do not call the network.`,
    )
    this.name = 'AirwallexFixtureNotFoundError'
    this.method = method
    this.path = path
    this.requestId = requestId
  }
}
