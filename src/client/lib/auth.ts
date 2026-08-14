/**
 * Auth screen helpers (A1). Pure — no React.
 *
 * `signInFormSchema` mirrors `credentialsSchema` in `src/server/auth/config.ts`
 * (`email` + `password` min 1) and adds `.max(128)` on password. Do not import
 * the server file.
 */
import { z } from 'zod'
import { isSafeReturnPath } from '@/client/api/errorBehaviour'
import { ErrorCode } from '@/shared/enums/errors'

const INVITE_TOKEN_RE = /^[A-Za-z0-9_-]{16,128}$/
const INVITE_CALLBACK_RE = /^\/invite\/[A-Za-z0-9_-]{16,128}$/

export const signInFormSchema = z.object({
  email: z.email(),
  password: z.string().min(1).max(128),
})

export type SignInFormValues = z.infer<typeof signInFormSchema>

export function isInviteToken(value: string): boolean {
  return INVITE_TOKEN_RE.test(value)
}

export function invitePath(token: string): string {
  if (!isInviteToken(token)) {
    throw new Error('Invalid invite token')
  }
  return `/invite/${token}`
}

function firstParam(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) {
    return value[0]
  }
  return value
}

export function parseAuthSearchParams(input: {
  invite?: string | string[] | undefined
  returnTo?: string | string[] | undefined
}): { inviteToken: string | null; returnTo: string | null } {
  const inviteRaw = firstParam(input.invite)
  const returnToRaw = firstParam(input.returnTo)
  return {
    inviteToken: inviteRaw !== undefined && isInviteToken(inviteRaw) ? inviteRaw : null,
    returnTo: returnToRaw !== undefined && isSafeReturnPath(returnToRaw) ? returnToRaw : null,
  }
}

export function buildAuthHref(
  which: 'sign-in' | 'sign-up',
  opts: { inviteToken?: string | null; returnTo?: string | null },
): string {
  const path = which === 'sign-in' ? '/sign-in' : '/sign-up'
  if (opts.inviteToken && isInviteToken(opts.inviteToken)) {
    return `${path}?invite=${opts.inviteToken}`
  }
  if (opts.returnTo && isSafeReturnPath(opts.returnTo)) {
    return `${path}?returnTo=${encodeURIComponent(opts.returnTo)}`
  }
  return path
}

export function resolvePostAuthHref(opts: {
  inviteToken?: string | null
  returnTo?: string | null
  onboarded: boolean
}): string {
  if (opts.inviteToken && isInviteToken(opts.inviteToken)) {
    return invitePath(opts.inviteToken)
  }
  if (opts.returnTo && isSafeReturnPath(opts.returnTo)) {
    return opts.returnTo
  }
  return opts.onboarded ? '/dashboard' : '/onboarding'
}

export function isSafeCallbackUrl(url: string): boolean {
  if (!isSafeReturnPath(url)) {
    return false
  }
  if (url.includes('?') || url.includes('#')) {
    return false
  }
  return (
    url === '/dashboard' ||
    url === '/onboarding' ||
    url === '/onboarding/create-organization' ||
    INVITE_CALLBACK_RE.test(url)
  )
}

export function inviteErrorCopy(
  code: ErrorCode,
): { variant: 'warning' | 'info' | 'destructive'; message: string } | null {
  switch (code) {
    case ErrorCode.INVITE_EXPIRED:
      return {
        variant: 'warning',
        message: 'This invite has expired. Ask the organisation owner to send a new one.',
      }
    case ErrorCode.INVITE_REVOKED:
      return { variant: 'warning', message: 'This invite was revoked.' }
    case ErrorCode.INVITE_ALREADY_ACCEPTED:
      return { variant: 'info', message: 'This invite has already been accepted.' }
    case ErrorCode.NOT_FOUND:
      return { variant: 'warning', message: 'This invite is not available.' }
    case ErrorCode.PERMISSION_DENIED:
      return {
        variant: 'destructive',
        message:
          'This invite was sent to a different email address. Sign in as the invited account to accept it.',
      }
    default:
      return null
  }
}
