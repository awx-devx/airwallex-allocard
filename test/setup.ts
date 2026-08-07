import { afterAll, beforeAll } from 'vitest'
import { installTestSessionResolver } from './helpers/request'

const originalFetch = globalThis.fetch

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
