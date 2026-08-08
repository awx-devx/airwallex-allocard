import type { z } from 'zod'
import { AppError, serializeError, type FieldErrors } from '@/server/http/errors'

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
 * Public route wrapper: validate body/query, catch `AppError`, no session required.
 */
export function withPublicValidation<TSchema extends z.ZodType>(
  schema: TSchema,
  handler: (input: z.infer<TSchema>, req: Request) => Response | Promise<Response>,
): (req: Request) => Promise<Response> {
  return async (req) => {
    try {
      const raw = await readRawInput(req)
      const parsed = schema.safeParse(raw)
      if (!parsed.success) {
        throw AppError.validationFailed(zodToFieldErrors(parsed.error))
      }
      return await handler(parsed.data, req)
    } catch (error) {
      const { status, body } = serializeError(error)
      return Response.json(body, { status })
    }
  }
}
