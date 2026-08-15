import { isGoogleAuthEnabled } from '@/server/auth/config'
import { parseAuthSearchParams } from '@/client/lib/auth'
import { SignInForm } from '@/app/(auth)/sign-in/SignInForm'

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ invite?: string | string[]; returnTo?: string | string[] }>
}) {
  const parsed = parseAuthSearchParams(await searchParams)
  return (
    <SignInForm
      googleEnabled={isGoogleAuthEnabled()}
      inviteToken={parsed.inviteToken}
      returnTo={parsed.returnTo}
    />
  )
}
