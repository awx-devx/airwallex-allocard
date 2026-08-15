import { isGoogleAuthEnabled } from '@/server/auth/config'
import { parseAuthSearchParams } from '@/client/lib/auth'
import { SignUpForm } from '@/app/(auth)/sign-up/SignUpForm'

export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<{ invite?: string | string[]; returnTo?: string | string[] }>
}) {
  const parsed = parseAuthSearchParams(await searchParams)
  return (
    <SignUpForm
      googleEnabled={isGoogleAuthEnabled()}
      inviteToken={parsed.inviteToken}
      returnTo={parsed.returnTo}
    />
  )
}
