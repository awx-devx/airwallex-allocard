'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { useForm, type FieldValues, type UseFormProps, type UseFormReturn } from 'react-hook-form'
import type { ZodType } from 'zod'

/** Pure config helper — test without React. */
export function createZodFormConfig<TValues extends FieldValues>(schema: ZodType<TValues>) {
  return { resolver: zodResolver(schema as never) }
}

/**
 * React Hook Form wired to a shared Zod schema.
 * Callers import schemas from `@/shared/schemas/*` — never redefine shapes here.
 */
export function useZodForm<TValues extends FieldValues>(
  schema: ZodType<TValues>,
  options?: Omit<UseFormProps<TValues>, 'resolver'>,
): UseFormReturn<TValues> {
  return useForm<TValues>({
    ...options,
    resolver: zodResolver(schema as never),
  })
}
