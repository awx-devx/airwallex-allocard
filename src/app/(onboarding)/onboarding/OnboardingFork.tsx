'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { isApiError } from '@/client/api/errors'
import { useOnboardingStatus } from '@/client/hooks/useSession'
import { EmptyState } from '@/components/patterns/EmptyState'
import { ErrorState, shouldShowErrorRetry } from '@/components/patterns/ErrorState'
import { LoadingState } from '@/components/patterns/LoadingState'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { formatDate } from '@/lib/dates'

export function OnboardingFork() {
  const router = useRouter()
  const status = useOnboardingStatus()

  useEffect(() => {
    if (status.data?.onboarded === true) {
      router.replace('/dashboard')
    }
  }, [router, status.data?.onboarded])

  if (status.isLoading || status.isPending) {
    return <LoadingState label="Loading onboarding" />
  }

  if (status.error) {
    const code = isApiError(status.error) ? status.error.code : undefined
    const retryable = shouldShowErrorRetry(code, true)
    return (
      <ErrorState
        message={isApiError(status.error) ? status.error.message : 'Unable to load onboarding'}
        code={code}
        onRetry={retryable ? () => void status.refetch() : undefined}
      />
    )
  }

  if (status.data?.onboarded === true) {
    return <LoadingState label="Redirecting" rows={1} />
  }

  const pending = status.data?.pendingInvites ?? []

  if (pending.length > 0) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-lg font-semibold">You&apos;ve been invited</h1>
        {pending.map((invite, index) => (
          <Card key={`${invite.orgName}-${invite.expiresAt}-${index}`}>
            <CardHeader>
              <CardTitle>{invite.orgName}</CardTitle>
              <CardDescription>
                {invite.invitedByName} invited you as {invite.orgRole}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Expires {formatDate(invite.expiresAt)}
              </p>
            </CardContent>
          </Card>
        ))}
        <Alert variant="info">
          <AlertDescription>
            Open the invite link that was sent to your email to join. Creating an organisation is
            optional.
          </AlertDescription>
        </Alert>
        <Button
          type="button"
          variant="outline"
          className="w-full"
          onClick={() => router.push('/onboarding/create-organization')}
        >
          Create an organisation instead
        </Button>
      </div>
    )
  }

  return (
    <EmptyState
      title="Create your organisation"
      description="You'll be the owner. You can invite people after."
      action={{
        label: 'Create organisation',
        onClick: () => router.push('/onboarding/create-organization'),
      }}
    />
  )
}
