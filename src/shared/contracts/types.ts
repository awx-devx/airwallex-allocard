import type { z } from 'zod'

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

/**
 * Per-endpoint contract: method, path, Zod input, Zod output.
 * Handlers and client hooks both consume this — one declaration, both sides.
 */
export type Contract<
  TInput extends z.ZodType = z.ZodType,
  TOutput extends z.ZodType = z.ZodType,
> = {
  method: HttpMethod
  path: string
  input: TInput
  output: TOutput
}

/** Identity helper that preserves literal types for contract objects. */
export function defineContract<const C extends Contract>(contract: C): C {
  return contract
}
