import { afterAll, beforeAll } from 'vitest'
import { installTestSessionResolver } from './helpers/request'

const originalFetch = globalThis.fetch

/** Ensure Airwallex client can load env under Vitest (fixtures never hit the network). */
beforeAll(() => {
  process.env.AIRWALLEX_CLIENT_ID ??= 'test-client-id'
  process.env.AIRWALLEX_API_KEY ??= 'test-api-key'
  process.env.AIRWALLEX_WEBHOOK_SECRET ??= 'test-webhook-secret'
  process.env.AIRWALLEX_USE_FIXTURES ??= 'true'
  process.env.AUTH_SECRET ??= 'test-auth-secret'
  process.env.MONGODB_URI ??= 'mongodb://127.0.0.1:27017/allocard'
})

/**
 * Fail any outbound HTTP. Airwallex and other upstreams must use fixtures.
 */
function installNetworkGuard(): void {
  globalThis.fetch = ((input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    return Promise.reject(new Error(`Network disabled in tests. Attempted fetch: ${url}`))
  }) as typeof fetch
}

beforeAll(() => {
  installNetworkGuard()
  installTestSessionResolver()
})

afterAll(() => {
  globalThis.fetch = originalFetch
})
