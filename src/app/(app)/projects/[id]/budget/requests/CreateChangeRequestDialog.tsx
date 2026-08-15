'use client'

import { useState } from 'react'
import type { FieldValues, UseFormReturn } from 'react-hook-form'
import { z } from 'zod'
import { isApiError } from '@/client/api/errors'
import { applyServerErrorsFromApiError, useZodForm } from '@/client/lib/forms'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { parseMoneyInput } from '@/lib/money'
import { ErrorCode } from '@/shared/enums/errors'

const createChangeRequestSchema = z.object({
  deltaAmount: z.string().min(1),
  reason: z.string().min(1).max(2000),
})

type CreateChangeRequestForm = z.infer<typeof createChangeRequestSchema>

export function CreateChangeRequestDialog({
  open,
  onOpenChange,
  currency,
  loading,
  onSave,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  currency: string
  loading: boolean
  onSave: (input: { deltaAmount: number; reason: string }) => Promise<void>
}) {
  const form = useZodForm(createChangeRequestSchema, {
    defaultValues: { deltaAmount: '', reason: '' },
  })
  const [alertMessage, setAlertMessage] = useState<string | null>(null)

  async function onSubmit(values: CreateChangeRequestForm) {
    setAlertMessage(null)
    if (currency.length !== 3) {
      setAlertMessage('Unable to load organisation currency')
      return
    }
    let deltaAmount: number
    try {
      deltaAmount = parseMoneyInput(values.deltaAmount, currency).amount
    } catch {
      form.setError('deltaAmount', { type: 'manual', message: 'Enter a valid amount.' })
      return
    }
    if (deltaAmount === 0) {
      form.setError('deltaAmount', { type: 'manual', message: 'Delta must be nonzero.' })
      return
    }
    const reason = values.reason.trim()
    if (reason.length < 1 || reason.length > 2000) {
      form.setError('reason', { type: 'manual', message: 'Enter a reason.' })
      return
    }
    try {
      await onSave({ deltaAmount, reason })
      onOpenChange(false)
    } catch (error) {
      if (isApiError(error) && error.code === ErrorCode.VALIDATION_FAILED) {
        applyServerErrorsFromApiError(form as unknown as UseFormReturn<FieldValues>, error)
        return
      }
      setAlertMessage(isApiError(error) ? error.message : 'Unable to request a budget change')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Request change</DialogTitle>
        </DialogHeader>
        {alertMessage ? (
          <Alert variant="destructive">
            <AlertDescription>{alertMessage}</AlertDescription>
          </Alert>
        ) : null}
        <Form {...form}>
          <form
            className="flex flex-col gap-4"
            onSubmit={form.handleSubmit((values) => void onSubmit(values))}
          >
            <FormField
              control={form.control}
              name="deltaAmount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Delta</FormLabel>
                  <FormControl>
                    <Input {...field} type="text" inputMode="decimal" autoComplete="off" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="reason"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Reason</FormLabel>
                  <FormControl>
                    <Textarea {...field} maxLength={2000} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="submit" loading={loading}>
                Submit
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
