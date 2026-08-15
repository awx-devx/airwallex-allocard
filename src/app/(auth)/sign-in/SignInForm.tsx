'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { signIn, useSession } from 'next-auth/react'
import { GoogleButton } from '@/app/(auth)/_components/GoogleButton'
import { isSafeReturnPath } from '@/client/api/errorBehaviour'
import {
  buildAuthHref,
  invitePath,
  isInviteToken,
  isSafeCallbackUrl,
  resolvePostAuthHref,
  signInFormSchema,
} from '@/client/lib/auth'
import { useZodForm } from '@/client/lib/forms'
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

function googleSignInCallbackUrl(opts: {
  inviteToken: string | null
  returnTo: string | null
}): string {
  if (opts.inviteToken && isInviteToken(opts.inviteToken)) {
    return invitePath(opts.inviteToken)
  }
  if (opts.returnTo && isSafeReturnPath(opts.returnTo)) {
    return opts.returnTo
  }
  const fallback = '/onboarding'
  return isSafeCallbackUrl(fallback) ? fallback : '/onboarding'
}

export function SignInForm({
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
  const form = useZodForm(signInFormSchema, {
    defaultValues: { email: '', password: '' },
  })
  const [credentialsError, setCredentialsError] = useState(false)
  const [pending, setPending] = useState(false)

  async function submit(values: { email: string; password: string }) {
    setCredentialsError(false)
    setPending(true)
    try {
      const result = await signIn('credentials', {
        email: values.email,
        password: values.password,
        redirect: false,
      })
      if (result?.error) {
        setCredentialsError(true)
        return
      }
      const session = await update()
      const onboarded = session?.onboarded === true
      router.push(resolvePostAuthHref({ inviteToken, returnTo, onboarded }))
    } finally {
      setPending(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Sign in</CardTitle>
        <CardDescription>Use your email and password, or Google.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {credentialsError ? (
          <Alert variant="destructive">
            <AlertDescription>Email or password is incorrect</AlertDescription>
          </Alert>
        ) : null}
        <Form {...form}>
          <form className="space-y-4" onSubmit={form.handleSubmit(submit)}>
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
                      autoComplete="current-password"
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
              <Button type="submit" className="w-full" loading={pending}>
                Sign in
              </Button>
              {googleEnabled ? <Separator /> : null}
              <GoogleButton
                googleEnabled={googleEnabled}
                callbackUrl={googleSignInCallbackUrl({ inviteToken, returnTo })}
              />
            </div>
          </form>
        </Form>
        <p className="text-sm text-muted-foreground">
          Need an account?{' '}
          <Link
            href={buildAuthHref('sign-up', { inviteToken, returnTo })}
            className="text-primary underline-offset-4 hover:underline"
          >
            Sign up
          </Link>
        </p>
      </CardContent>
    </Card>
  )
}
