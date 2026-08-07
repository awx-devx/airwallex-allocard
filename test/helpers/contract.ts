import { expect } from 'vitest'
import type { z } from 'zod'

/**
 * Assert a response body parses against a contract output schema.
 * Clones the response so callers can still read the body.
 */
export async function expectMatchesContract<T extends z.ZodType>(
  res: Response,
  schema: T,
): Promise<z.infer<T>> {
  const body: unknown = await res.clone().json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    expect.fail(`Contract mismatch: ${JSON.stringify(parsed.error.issues, null, 2)}`)
  }
  return parsed.data
}
