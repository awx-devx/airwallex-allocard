import { resolveErrorBehaviour } from '@/client/api/errorBehaviour'
import { ApiError } from '@/client/api/errors'
import type { FieldValues, Path, UseFormReturn } from 'react-hook-form'

function readFieldErrors(details: unknown): Record<string, string[]> {
  if (
    typeof details === 'object' &&
    details !== null &&
    'fieldErrors' in details &&
    typeof (details as { fieldErrors: unknown }).fieldErrors === 'object' &&
    (details as { fieldErrors: unknown }).fieldErrors !== null
  ) {
    const raw = (details as { fieldErrors: Record<string, unknown> }).fieldErrors
    const out: Record<string, string[]> = {}
    for (const [key, value] of Object.entries(raw)) {
      if (Array.isArray(value) && value.every((v) => typeof v === 'string')) {
        out[key] = value
      } else if (value === undefined) {
        out[key] = []
      }
    }
    return out
  }
  return {}
}

/** Apply API validation fieldErrors onto a React Hook Form instance. */
export function applyServerErrors(form: UseFormReturn<FieldValues>, details: unknown): void {
  const fieldErrors = readFieldErrors(details)
  for (const [path, messages] of Object.entries(fieldErrors)) {
    form.setError(path as Path<FieldValues>, {
      type: 'server',
      message: messages[0] ?? 'Invalid',
    })
  }
}

/** Resolve ApiError behaviour and apply field errors when type is field-errors. */
export function applyServerErrorsFromApiError(
  form: UseFormReturn<FieldValues>,
  error: ApiError,
): void {
  const behaviour = resolveErrorBehaviour(error)
  if (behaviour.type === 'field-errors') {
    applyServerErrors(form, { fieldErrors: behaviour.fieldErrors })
  }
}
