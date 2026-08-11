import { describe, expect, it, vi } from 'vitest'
import {
  applyServerErrors,
  applyServerErrorsFromApiError,
} from '@/client/lib/forms/applyServerErrors'
import { ApiError } from '@/client/api/errors'
import { ErrorCode } from '@/shared/enums/errors'
import type { FieldValues, UseFormReturn } from 'react-hook-form'

function mockForm() {
  const setError = vi.fn()
  const form = { setError } as unknown as UseFormReturn<FieldValues>
  return { form, setError }
}

describe('client/lib/forms/applyServerErrors', () => {
  it('sets errors from fieldErrors details', () => {
    const { form, setError } = mockForm()
    applyServerErrors(form, {
      fieldErrors: {
        name: ['Name is required'],
        'cardStructure.shared': ['Invalid'],
      },
    })
    expect(setError).toHaveBeenCalledWith('name', {
      type: 'server',
      message: 'Name is required',
    })
    expect(setError).toHaveBeenCalledWith('cardStructure.shared', {
      type: 'server',
      message: 'Invalid',
    })
  })

  it('supports nested dot paths and array indices', () => {
    const { form, setError } = mockForm()
    applyServerErrors(form, {
      fieldErrors: {
        'desiredControls.transactionLimits.limits.0.amount': ['Must be positive'],
      },
    })
    expect(setError).toHaveBeenCalledWith('desiredControls.transactionLimits.limits.0.amount', {
      type: 'server',
      message: 'Must be positive',
    })
  })

  it('uses Invalid when messages array is empty', () => {
    const { form, setError } = mockForm()
    applyServerErrors(form, { fieldErrors: { code: [] } })
    expect(setError).toHaveBeenCalledWith('code', { type: 'server', message: 'Invalid' })
  })

  it('applyServerErrorsFromApiError applies VALIDATION_FAILED errors', () => {
    const { form, setError } = mockForm()
    const error = new ApiError(ErrorCode.VALIDATION_FAILED, 'Validation failed', 422, {
      fieldErrors: { name: ['Too short'] },
    })
    applyServerErrorsFromApiError(form, error)
    expect(setError).toHaveBeenCalledWith('name', { type: 'server', message: 'Too short' })
  })

  it('applyServerErrorsFromApiError ignores non-field-errors', () => {
    const { form, setError } = mockForm()
    const error = new ApiError(ErrorCode.NOT_FOUND, 'Not found', 404)
    applyServerErrorsFromApiError(form, error)
    expect(setError).not.toHaveBeenCalled()
  })
})
