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

const adjustFormSchema = z.object({
  amount: z.string().min(1),
  note: z.string().optional(),
})

type AdjustForm = z.infer<typeof adjustFormSchema>

export function AdjustDialog({
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
  onSave: (input: { amount: number; note: string | null }) => Promise<void>
}) {
  const form = useZodForm(adjustFormSchema, {
    defaultValues: { amount: '', note: '' },
  })
  const [alertMessage, setAlertMessage] = useState<string | null>(null)

  async function onSubmit(values: AdjustForm) {
    setAlertMessage(null)
    if (currency.length !== 3) {
      setAlertMessage('Unable to load organisation currency')
      return
    }
    let amount: number
    try {
      amount = parseMoneyInput(values.amount, currency).amount
    } catch {
      form.setError('amount', { type: 'manual', message: 'Enter a valid amount.' })
      return
    }
    if (amount === 0) {
      form.setError('amount', { type: 'manual', message: 'Enter a nonzero amount.' })
      return
    }
    try {
      await onSave({ amount, note: values.note?.trim() ? values.note.trim() : null })
      onOpenChange(false)
    } catch (error) {
      if (isApiError(error) && error.code === ErrorCode.VALIDATION_FAILED) {
        applyServerErrorsFromApiError(form as unknown as UseFormReturn<FieldValues>, error)
        return
      }
      setAlertMessage(isApiError(error) ? error.message : 'Unable to record adjustment')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Record adjustment</DialogTitle>
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
              name="amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Amount</FormLabel>
                  <FormControl>
                    <Input {...field} type="text" inputMode="decimal" autoComplete="off" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="note"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Note</FormLabel>
                  <FormControl>
                    <Textarea {...field} value={field.value ?? ''} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="submit" loading={loading}>
                Save
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
