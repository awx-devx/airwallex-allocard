import type { Session } from 'next-auth'
import { buildSignInHref, isSafeReturnPath } from '@/client/api/errorBehaviour'
import { auth } from '@/server/auth'

export type GuardResult = { ok: true; session: Session | null } | { ok: false; redirectTo: string }

function hasSession(session: Session | null): session is Session {
  return Boolean(session?.userId)
}

/** Unauthenticated only — if session exists → /dashboard (or /onboarding if !onboarded). */
export async function requireAnonymous(): Promise<GuardResult> {
  const session = await auth()
  if (!hasSession(session)) {
    return { ok: true, session: null }
  }
  if (!session.onboarded) {
    return { ok: false, redirectTo: '/onboarding' }
  }
  return { ok: false, redirectTo: '/dashboard' }
}

/** Authenticated but not onboarded — else → /sign-in or /dashboard. */
export async function requireOnboarding(): Promise<GuardResult> {
  const session = await auth()
  if (!hasSession(session)) {
    return { ok: false, redirectTo: '/sign-in' }
  }
  if (session.onboarded) {
    return { ok: false, redirectTo: '/dashboard' }
  }
  return { ok: true, session }
}

/**
 * Authenticated + onboarded — else → /sign-in or /onboarding.
 * When redirecting anonymous users, `returnPath` may be preserved if safe.
 */
export async function requireApp(returnPath?: string): Promise<GuardResult> {
  const session = await auth()
  if (!hasSession(session)) {
    const redirectTo =
      returnPath && isSafeReturnPath(returnPath) ? buildSignInHref(returnPath) : '/sign-in'
    return { ok: false, redirectTo }
  }
  if (!session.onboarded) {
    return { ok: false, redirectTo: '/onboarding' }
  }
  return { ok: true, session }
}
