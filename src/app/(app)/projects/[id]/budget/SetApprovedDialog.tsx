'use client'

import { useState } from 'react'
import type { FieldValues, UseFormReturn } from 'react-hook-form'
import { z } from 'zod'
import { isApiError } from '@/client/api/errors'
import { applyServerErrorsFromApiError, useZodForm } from '@/client/lib/forms'
import { minorToInputString } from '@/client/lib/budget'
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
import { parseMoneyInput } from '@/lib/money'
import { ErrorCode } from '@/shared/enums/errors'

const setApprovedFormSchema = z.object({
  approvedAmount: z.string().min(1),
})

type SetApprovedForm = z.infer<typeof setApprovedFormSchema>

export function SetApprovedDialog({
  open,
  onOpenChange,
  currency,
  currentApproved,
  loading,
  onSave,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  currency: string
  currentApproved: number
  loading: boolean
  onSave: (approvedAmount: number) => Promise<void>
}) {
  const form = useZodForm(setApprovedFormSchema, {
    defaultValues: {
      approvedAmount: currency.length === 3 ? minorToInputString(currentApproved, currency) : '',
    },
  })
  const [alertMessage, setAlertMessage] = useState<string | null>(null)

  async function onSubmit(values: SetApprovedForm) {
    setAlertMessage(null)
    if (currency.length !== 3) {
      setAlertMessage('Unable to load organisation currency')
      return
    }
    let amount: number
    try {
      amount = parseMoneyInput(values.approvedAmount, currency).amount
    } catch {
      form.setError('approvedAmount', { type: 'manual', message: 'Enter a valid amount.' })
      return
    }
    if (amount < 0) {
      form.setError('approvedAmount', { type: 'manual', message: 'Enter a valid amount.' })
      return
    }
    if (amount === currentApproved) {
      onOpenChange(false)
      return
    }
    try {
      await onSave(amount)
      onOpenChange(false)
    } catch (error) {
      if (isApiError(error) && error.code === ErrorCode.VALIDATION_FAILED) {
        applyServerErrorsFromApiError(form as unknown as UseFormReturn<FieldValues>, error)
        return
      }
      setAlertMessage(isApiError(error) ? error.message : 'Unable to save budget')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Set approved amount</DialogTitle>
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
              name="approvedAmount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Approved amount</FormLabel>
                  <FormControl>
                    <Input {...field} type="text" inputMode="decimal" autoComplete="off" />
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
