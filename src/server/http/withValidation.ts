import type { z } from 'zod'
import { AppError, type FieldErrors } from '@/server/http/errors'
import type { OrgContext } from '@/server/http/types'

function zodToFieldErrors(error: z.ZodError): FieldErrors {
  const fieldErrors: FieldErrors = {}
  for (const issue of error.issues) {
    const key = issue.path.length > 0 ? issue.path.join('.') : '_root'
    const existing = fieldErrors[key] ?? []
    fieldErrors[key] = [...existing, issue.message]
  }
  return fieldErrors
}

async function readRawInput(req: Request): Promise<unknown> {
  const method = req.method.toUpperCase()
  if (method === 'GET' || method === 'HEAD') {
    const url = new URL(req.url)
    return Object.fromEntries(url.searchParams.entries())
  }

  const text = await req.text()
  if (!text) {
    return {}
  }

  try {
    return JSON.parse(text) as unknown
  } catch {
    throw AppError.validationFailed({ _root: ['Invalid JSON body'] })
  }
}

/**
 * Parse body (or query for GET) against `schema`, then call the handler with typed input.
 * Context type defaults to `OrgContext`; use with `withAuth(..., { requireOnboarded: false })`
 * by passing `AuthSession` as `TCtx`.
 */
export function withValidation<TSchema extends z.ZodType, TCtx = OrgContext>(
  schema: TSchema,
  handler: (ctx: TCtx, input: z.infer<TSchema>, req: Request) => Response | Promise<Response>,
): (ctx: TCtx, req: Request) => Promise<Response> {
  return async (ctx, req) => {
    const raw = await readRawInput(req)
    const parsed = schema.safeParse(raw)
    if (!parsed.success) {
      throw AppError.validationFailed(zodToFieldErrors(parsed.error))
    }
    return handler(ctx, parsed.data, req)
  }
}
