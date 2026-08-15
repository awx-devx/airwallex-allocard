'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { signIn, useSession } from 'next-auth/react'
import type { FieldValues, UseFormReturn } from 'react-hook-form'
import { isApiError } from '@/client/api/errors'
import { useSignUp } from '@/client/hooks/useSession'
import { applyServerErrorsFromApiError, useZodForm } from '@/client/lib/forms'
import { buildAuthHref, isSafeCallbackUrl, resolvePostAuthHref } from '@/client/lib/auth'
import { ErrorState } from '@/components/patterns/ErrorState'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { GoogleButton } from '@/app/(auth)/_components/GoogleButton'
import { ErrorCode } from '@/shared/enums/errors'
import { signUpInput } from '@/shared/schemas/user'
import type { z } from 'zod'

type SignUpValues = z.infer<typeof signUpInput>

export function SignUpForm({
  googleEnabled,
  inviteToken,
  returnTo,
}: {
  googleEnabled: boolean
  inviteToken: string | null
  returnTo: string | null
}) {
  const router = useRouter()
  const { update } = useSession()
  const mutation = useSignUp()
  const form = useZodForm(signUpInput, {
    defaultValues: { name: '', email: '', password: '' },
  })
  const [conflict, setConflict] = useState(false)
  const [rateLimited, setRateLimited] = useState<string | null>(null)
  const [destructive, setDestructive] = useState<string | null>(null)

  const googleCallbackUrl = (() => {
    const dest = resolvePostAuthHref({ inviteToken, returnTo, onboarded: false })
    return isSafeCallbackUrl(dest) ? dest : '/onboarding'
  })()

  async function submit(values: SignUpValues) {
    setConflict(false)
    setRateLimited(null)
    setDestructive(null)
    try {
      await mutation.mutateAsync(values)
    } catch (error) {
      if (isApiError(error)) {
        if (error.code === ErrorCode.CONFLICT) {
          setConflict(true)
          return
        }
        if (error.code === ErrorCode.VALIDATION_FAILED) {
          applyServerErrorsFromApiError(form as unknown as UseFormReturn<FieldValues>, error)
          return
        }
        if (error.code === ErrorCode.RATE_LIMITED) {
          setRateLimited(error.message)
          return
        }
        setDestructive(error.message)
        return
      }
      setDestructive('Unable to complete sign-up')
      return
    }

    await signIn('credentials', {
      email: values.email,
      password: values.password,
      redirect: false,
    })
    await update()
    router.push(resolvePostAuthHref({ inviteToken, returnTo, onboarded: false }))
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create an account</CardTitle>
        <CardDescription>Sign up with email or Google to continue.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {conflict ? (
          <Alert variant="default">
            <AlertDescription>Unable to complete sign-up</AlertDescription>
          </Alert>
        ) : null}
        {destructive ? (
          <Alert variant="destructive">
            <AlertDescription>{destructive}</AlertDescription>
          </Alert>
        ) : null}
        {rateLimited ? (
          <ErrorState
            code={ErrorCode.RATE_LIMITED}
            message={rateLimited}
            onRetry={() => void form.handleSubmit(submit)()}
          />
        ) : null}
        <Form {...form}>
          <form className="space-y-4" onSubmit={form.handleSubmit(submit)}>
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input autoComplete="name" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input type="email" autoComplete="email" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Password</FormLabel>
                  <FormControl>
                    <Input
                      type="password"
                      autoComplete="new-password"
                      name="password"
                      value={field.value}
                      onChange={field.onChange}
                      onBlur={field.onBlur}
                      ref={field.ref}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="flex flex-col gap-2">
              <Button type="submit" className="w-full" loading={mutation.isPending}>
                Sign up
              </Button>
              {googleEnabled ? <Separator /> : null}
              <GoogleButton googleEnabled={googleEnabled} callbackUrl={googleCallbackUrl} />
            </div>
          </form>
        </Form>
        <p className="text-sm text-muted-foreground">
          Already have an account?{' '}
          <Link
            href={buildAuthHref('sign-in', { inviteToken, returnTo })}
            className="text-primary underline-offset-4 hover:underline"
          >
            Sign in
          </Link>
        </p>
      </CardContent>
    </Card>
  )
}
