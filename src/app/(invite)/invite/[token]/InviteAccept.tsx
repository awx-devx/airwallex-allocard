'use client'

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { signOut, useSession } from 'next-auth/react'
import { isApiError } from '@/client/api/errors'
import { useAcceptInvite, useInvitePreview } from '@/client/hooks/useOrganizations'
import { buildAuthHref, inviteErrorCopy, isInviteToken } from '@/client/lib/auth'
import { ErrorState, shouldShowErrorRetry } from '@/components/patterns/ErrorState'
import { LoadingState } from '@/components/patterns/LoadingState'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { formatDate } from '@/lib/dates'
import { ErrorCode } from '@/shared/enums/errors'

export function InviteAccept() {
  const params = useParams()
  const raw = params.token
  const token = typeof raw === 'string' ? raw : Array.isArray(raw) ? (raw[0] ?? '') : ''
  const valid = isInviteToken(token)
  const preview = useInvitePreview(valid ? token : '')
  const accept = useAcceptInvite()
  const { status, update } = useSession()
  const router = useRouter()
  const [acceptAlert, setAcceptAlert] = useState<{
    variant: 'warning' | 'info' | 'destructive'
    message: string
    mismatch: boolean
  } | null>(null)

  if (!valid) {
    return <ErrorState message="This invite is not available." />
  }

  if (preview.isLoading || preview.isPending) {
    return <LoadingState label="Loading invite" />
  }

  if (preview.error) {
    if (isApiError(preview.error) && preview.error.code === ErrorCode.NOT_FOUND) {
      return <ErrorState message="This invite is not available." />
    }
    const code = isApiError(preview.error) ? preview.error.code : undefined
    const retryable = shouldShowErrorRetry(code, true)
    return (
      <ErrorState
        message={
          isApiError(preview.error) ? preview.error.message : 'This invite is not available.'
        }
        code={code}
        onRetry={retryable ? () => void preview.refetch() : undefined}
      />
    )
  }

  if (!preview.data) {
    return <ErrorState message="This invite is not available." />
  }

  const signedIn = status === 'authenticated'

  async function onAccept() {
    setAcceptAlert(null)
    try {
      await accept.mutateAsync({ token })
      await update()
      router.push('/dashboard')
    } catch (error) {
      if (isApiError(error)) {
        const copy = inviteErrorCopy(error.code)
        if (copy) {
          setAcceptAlert({
            ...copy,
            mismatch: error.code === ErrorCode.PERMISSION_DENIED,
          })
          return
        }
      }
      setAcceptAlert({
        variant: 'destructive',
        message: isApiError(error) ? error.message : 'Unable to accept invite',
        mismatch: false,
      })
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{preview.data.orgName}</CardTitle>
        <CardDescription>
          {preview.data.invitedByName} invited you as {preview.data.orgRole}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Expires {formatDate(preview.data.expiresAt)}
        </p>
        {acceptAlert ? (
          <Alert variant={acceptAlert.variant}>
            <AlertDescription>{acceptAlert.message}</AlertDescription>
          </Alert>
        ) : null}
        {status === 'loading' ? (
          <LoadingState label="Checking session" rows={2} />
        ) : signedIn ? (
          <div className="flex flex-col gap-2">
            <Button
              type="button"
              className="w-full"
              loading={accept.isPending}
              onClick={() => void onAccept()}
            >
              Accept invite
            </Button>
            {acceptAlert?.mismatch ? (
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => {
                  void signOut({
                    callbackUrl: buildAuthHref('sign-in', { inviteToken: token }),
                  })
                }}
              >
                Sign in as the invited account
              </Button>
            ) : null}
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <Button asChild className="w-full">
              <a href={buildAuthHref('sign-up', { inviteToken: token })}>Sign up to accept</a>
            </Button>
            <Button asChild variant="outline" className="w-full">
              <a href={buildAuthHref('sign-in', { inviteToken: token })}>Sign in</a>
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
