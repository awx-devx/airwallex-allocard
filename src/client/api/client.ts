import type { z } from 'zod'
import { ZodVoid } from 'zod'
import { ApiError } from '@/client/api/errors'
import { buildUrl } from '@/client/api/path'
import type { Contract } from '@/shared/contracts/types'

export type CallArgs<C extends Contract> = {
  params?: Record<string, string>
  input?: z.infer<C['input']>
  /** Active org for tenancy — sent as `x-org-id`. Omit when none. */
  orgId?: string
  signal?: AbortSignal
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function appendQuery(url: string, input: Record<string, unknown>): string {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(input)) {
    if (value === undefined) continue
    if (value === null) {
      search.set(key, 'null')
      continue
    }
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      search.set(key, String(value))
      continue
    }
    search.set(key, JSON.stringify(value))
  }
  const qs = search.toString()
  return qs ? `${url}?${qs}` : url
}

export async function call<C extends Contract>(
  contract: C,
  args?: CallArgs<C>,
): Promise<z.infer<C['output']>> {
  let url = buildUrl(contract.path, args?.params)
  const method = contract.method
  const headers: Record<string, string> = {}
  let body: string | undefined

  const input = args?.input
  const hasBodyMethod = method === 'POST' || method === 'PUT' || method === 'PATCH'
  const hasQueryMethod = method === 'GET' || method === 'DELETE'

  if (hasQueryMethod && isPlainObject(input)) {
    url = appendQuery(url, input)
  }

  if (hasBodyMethod && input !== undefined) {
    headers['Content-Type'] = 'application/json'
    body = JSON.stringify(input)
  }

  if (args?.orgId) {
    headers['x-org-id'] = args.orgId
  }

  const res = await fetch(url, {
    method,
    headers,
    body,
    credentials: 'include',
    signal: args?.signal,
  })

  if (!res.ok) {
    const errBody = await res.json().catch(() => null)
    throw ApiError.fromResponse(res.status, errBody)
  }

  if (res.status === 204 || contract.output instanceof ZodVoid) {
    return undefined as z.infer<C['output']>
  }

  const data: unknown = await res.json()

  if (process.env.NODE_ENV !== 'production') {
    const parsed = contract.output.safeParse(data)
    if (!parsed.success) {
      throw new Error(
        `Contract output mismatch for ${contract.method} ${contract.path}: ${parsed.error.message}`,
      )
    }
    return parsed.data as z.infer<C['output']>
  }

  return data as z.infer<C['output']>
}
