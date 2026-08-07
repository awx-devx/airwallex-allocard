import { setSessionResolver } from '@/server/http/withAuth'
import type { AuthSession } from '@/server/http/types'
import type { TestMember } from './factories'

const sessionByRequest = new WeakMap<Request, AuthSession | null>()
const paramsByRequest = new WeakMap<Request, Record<string, string>>()

export type BuildRequestOptions = {
  method?: string
  path?: string
  session?: AuthSession | TestMember | null
  body?: unknown
  query?: Record<string, string | number | boolean | undefined>
  params?: Record<string, string>
  headers?: Record<string, string>
}

function isTestMember(session: AuthSession | TestMember): session is TestMember {
  return 'user' in session && 'org' in session
}

function toAuthSession(session: AuthSession | TestMember): AuthSession {
  if (isTestMember(session)) {
    return {
      userId: session.userId,
      orgId: session.orgId,
      orgRole: session.orgRole,
      onboarded: true,
    }
  }
  return session
}

/** Install the WeakMap-backed session resolver used by `buildRequest`. */
export function installTestSessionResolver(): void {
  setSessionResolver(async (req) => {
    if (!sessionByRequest.has(req)) {
      return null
    }
    return sessionByRequest.get(req) ?? null
  })
}

/**
 * Build a `Request` for invoking route handlers directly.
 * When `session` is set, `withAuth` resolves it via the test session resolver.
 */
export function buildRequest(options: BuildRequestOptions = {}): Request {
  const method = (options.method ?? (options.body !== undefined ? 'POST' : 'GET')).toUpperCase()
  const path = options.path ?? '/api/test'
  const url = new URL(path, 'http://localhost')

  if (options.query) {
    for (const [key, value] of Object.entries(options.query)) {
      if (value !== undefined) {
        url.searchParams.set(key, String(value))
      }
    }
  }

  const headers = new Headers(options.headers)
  let body: string | undefined
  if (options.body !== undefined && method !== 'GET' && method !== 'HEAD') {
    headers.set('content-type', 'application/json')
    body = JSON.stringify(options.body)
  }

  const request = new Request(url, { method, headers, body })

  if (options.session === null) {
    sessionByRequest.set(request, null)
  } else if (options.session !== undefined) {
    sessionByRequest.set(request, toAuthSession(options.session))
  }

  if (options.params) {
    paramsByRequest.set(request, options.params)
  }

  return request
}

export function getRequestParams(req: Request): Record<string, string> {
  return paramsByRequest.get(req) ?? {}
}

/** Typed JSON body reader for a Response. */
export async function readBody<T = unknown>(res: Response): Promise<T> {
  return (await res.json()) as T
}
