'use client'

import { signIn } from 'next-auth/react'
import { isSafeReturnPath } from '@/client/api/errorBehaviour'
import { Button } from '@/components/ui/button'

export function GoogleButton({
  googleEnabled,
  callbackUrl,
}: {
  googleEnabled: boolean
  callbackUrl: string
}) {
  if (!googleEnabled) {
    return null
  }
  const safeCallbackUrl = isSafeReturnPath(callbackUrl) ? callbackUrl : '/onboarding'
  return (
    <Button
      type="button"
      variant="outline"
      className="w-full"
      onClick={() => {
        void signIn('google', { callbackUrl: safeCallbackUrl })
      }}
    >
      Continue with Google
    </Button>
  )
}
