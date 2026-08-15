'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import type { FieldValues, UseFormReturn } from 'react-hook-form'
import { isApiError } from '@/client/api/errors'
import { useCreateOrganization } from '@/client/hooks/useOrganizations'
import { applyServerErrorsFromApiError, useZodForm } from '@/client/lib/forms'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Combobox } from '@/components/ui/combobox'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { countryOptions, currencyOptions } from '@/shared/constants/geo'
import { ErrorCode } from '@/shared/enums/errors'
import { createOrganizationInput } from '@/shared/schemas/organization'

export function CreateOrganizationForm() {
  const router = useRouter()
  const { update } = useSession()
  const mutation = useCreateOrganization()
  const form = useZodForm(createOrganizationInput, {
    mode: 'onChange',
    defaultValues: { name: '', country: '', baseCurrency: '', costCentres: [] },
  })
  const [centreDraft, setCentreDraft] = useState('')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const countries = countryOptions()
  const currencies = currencyOptions()
  const costCentres = form.watch('costCentres') ?? []

  async function submit(values: {
    name: string
    country: string
    baseCurrency: string
    costCentres?: string[]
  }) {
    setErrorMessage(null)
    try {
      await mutation.mutateAsync({
        name: values.name,
        country: values.country,
        baseCurrency: values.baseCurrency,
        costCentres: values.costCentres ?? [],
      })
      await update()
      router.push('/dashboard')
    } catch (error) {
      if (isApiError(error) && error.code === ErrorCode.VALIDATION_FAILED) {
        applyServerErrorsFromApiError(form as unknown as UseFormReturn<FieldValues>, error)
        return
      }
      setErrorMessage(isApiError(error) ? error.message : 'Unable to create organisation')
    }
  }

  function addCostCentre() {
    const next = centreDraft.trim()
    if (next.length < 1) {
      return
    }
    form.setValue('costCentres', [...costCentres, next], { shouldValidate: true })
    setCentreDraft('')
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create organisation</CardTitle>
        <CardDescription>You&apos;ll be the owner. You can invite people after.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {errorMessage ? (
          <Alert variant="destructive">
            <AlertDescription>{errorMessage}</AlertDescription>
          </Alert>
        ) : null}
        <Form {...form}>
          <form className="flex flex-col gap-4" onSubmit={form.handleSubmit(submit)}>
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="country"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Country</FormLabel>
                  <FormControl>
                    <Combobox
                      options={countries}
                      value={field.value || null}
                      onChange={(value) => field.onChange(value ?? '')}
                      placeholder="Select country"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="baseCurrency"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Base currency</FormLabel>
                  <FormControl>
                    <Combobox
                      options={currencies}
                      value={field.value || null}
                      onChange={(value) => field.onChange(value ?? '')}
                      placeholder="Select currency"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="space-y-2">
              <FormLabel>Cost centres</FormLabel>
              <div className="flex flex-col gap-2">
                <Input
                  value={centreDraft}
                  onChange={(event) => setCentreDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault()
                      addCostCentre()
                    }
                  }}
                />
                <Button type="button" variant="outline" onClick={addCostCentre}>
                  Add
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {costCentres.map((centre, index) => (
                  <Button
                    key={`${centre}-${index}`}
                    type="button"
                    size="sm"
                    variant="outline"
                    aria-label={`Remove ${centre}`}
                    onClick={() => {
                      form.setValue(
                        'costCentres',
                        costCentres.filter((_, i) => i !== index),
                        { shouldValidate: true },
                      )
                    }}
                  >
                    {centre}
                  </Button>
                ))}
              </div>
            </div>
            <Button
              type="submit"
              className="w-full"
              loading={mutation.isPending}
              disabled={!form.formState.isValid}
            >
              Create organisation
            </Button>
          </form>
        </Form>
        <Link
          href="/onboarding"
          className="text-sm text-primary underline-offset-4 hover:underline"
        >
          Back
        </Link>
      </CardContent>
    </Card>
  )
}
