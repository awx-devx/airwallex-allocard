import { loadServerEnv, type ServerEnv } from '@/server/env'
import { getAccessToken, invalidateAccessToken, type AuthDeps } from '@/server/airwallex/auth'
import { AirwallexError } from '@/server/airwallex/errors'
import { loadFixture } from '@/server/airwallex/fixtures/load'
import { logAirwallexRequest } from '@/server/airwallex/logging'

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

export type AirwallexRequestOptions = {
  method: HttpMethod
  /** Absolute API path, e.g. `/api/v1/issuing/cards/create`. */
  path: string
  body?: unknown
  requestId?: string
  query?: Record<string, string | undefined>
  accountId: string | null
}

export type HttpDeps = AuthDeps & {
  fetchImpl?: typeof fetch
  sleep?: (ms: number) => Promise<void>
  maxRetries?: number
}

function resolveEnv(env?: ServerEnv): ServerEnv {
  return env ?? loadServerEnv()
}

function buildUrl(
  baseUrl: string,
  apiPath: string,
  query?: AirwallexRequestOptions['query'],
): string {
  const url = new URL(apiPath, baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`)
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined) {
        url.searchParams.set(key, value)
      }
    }
  }
  return url.toString()
}

function backoffMs(attempt: number): number {
  const base = Math.min(8_000, 200 * 2 ** attempt)
  const jitter = Math.floor(Math.random() * 100)
  return base + jitter
}

async function defaultSleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms))
}

type ErrorBody = {
  code?: string
  message?: string
}

/**
 * Low-level Airwallex HTTP helper.
 * Fixture mode never touches the network. Live mode retries 429/5xx with
 * backoff+jitter, and retries once on credentials_expired after token invalidate.
 */
export async function airwallexRequest<T>(
  opts: AirwallexRequestOptions,
  deps: HttpDeps = {},
): Promise<T> {
  const env = resolveEnv(deps.env)
  const useFixtures = deps.useFixtures ?? env.AIRWALLEX_USE_FIXTURES

  if (useFixtures) {
    const started = Date.now()
    try {
      const body = loadFixture<T>({
        method: opts.method,
        path: opts.path,
        requestId: opts.requestId,
      })
      logAirwallexRequest({
        method: opts.method,
        endpoint: opts.path,
        request_id: opts.requestId,
        status: 200,
        durationMs: Date.now() - started,
        accountId: opts.accountId,
      })
      return body
    } catch (error) {
      logAirwallexRequest({
        method: opts.method,
        endpoint: opts.path,
        request_id: opts.requestId,
        status: 0,
        durationMs: Date.now() - started,
        accountId: opts.accountId,
      })
      throw error
    }
  }

  const fetchImpl = deps.fetchImpl ?? fetch
  const sleep = deps.sleep ?? defaultSleep
  const maxRetries = deps.maxRetries ?? 3
  let credentialsRetried = false
  let attempt = 0

  while (true) {
    const token = await getAccessToken(opts.accountId, deps)
    const started = Date.now()
    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'x-api-version': env.AIRWALLEX_API_VERSION,
    }
    if (opts.accountId) {
      headers['x-on-behalf-of'] = opts.accountId
    }
    if (opts.requestId) {
      headers['x-request-id'] = opts.requestId
    }

    const res = await fetchImpl(buildUrl(env.AIRWALLEX_BASE_URL, opts.path, opts.query), {
      method: opts.method,
      headers,
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
    })

    logAirwallexRequest({
      method: opts.method,
      endpoint: opts.path,
      request_id: opts.requestId,
      status: res.status,
      durationMs: Date.now() - started,
      accountId: opts.accountId,
    })

    if (res.ok) {
      if (res.status === 204) {
        return undefined as T
      }
      return (await res.json()) as T
    }

    let code = `http_${res.status}`
    let message = `Airwallex ${opts.method} ${opts.path} failed with status ${res.status}`
    try {
      const errBody = (await res.json()) as ErrorBody
      if (typeof errBody.code === 'string') {
        code = errBody.code
      }
      if (typeof errBody.message === 'string') {
        message = errBody.message
      }
    } catch {
      // ignore parse errors — never log bodies
    }

    if (res.status === 401 && code === 'credentials_expired' && !credentialsRetried) {
      credentialsRetried = true
      await invalidateAccessToken(opts.accountId, deps)
      continue
    }

    const retryable = res.status === 429 || res.status >= 500
    if (retryable && attempt < maxRetries) {
      await sleep(backoffMs(attempt))
      attempt += 1
      continue
    }

    throw new AirwallexError({
      status: res.status,
      code,
      message,
      retryable,
    })
  }
}
