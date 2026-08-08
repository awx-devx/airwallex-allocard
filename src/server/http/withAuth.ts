import { AppError, serializeError } from '@/server/http/errors'
import {
  getSessionResolver,
  resetSessionResolver,
  setSessionResolver,
  type SessionResolver,
} from '@/server/http/sessionResolver'
import type { AuthSession, OrgContext } from '@/server/http/types'
import '@/server/auth/session'

export type { AuthSession, OrgContext, OrgRole } from '@/server/http/types'
export type { SessionResolver }
export { setSessionResolver, resetSessionResolver }

export type AuthedHandler = (ctx: OrgContext, req: Request) => Response | Promise<Response>
export type SessionHandler = (session: AuthSession, req: Request) => Response | Promise<Response>

export type WithAuthOptions = {
  /**
   * When true (default), requires an onboarded session with a resolved org.
   * Set false for authenticated-but-not-onboarded routes (`/api/me`, onboarding, org create).
   */
  requireOnboarded?: boolean
}

/**
 * Resolves the session, builds `OrgContext`, enforces the onboarding gate,
 * and serialises any thrown `AppError` (or unknown error) to the standard envelope.
 *
 * Pass `{ requireOnboarded: false }` to skip the org gate and receive `AuthSession`.
 *
 * The real Auth.js resolver is installed by importing `@/server/auth/session`
 * (side effect). Tests override via `installTestSessionResolver`.
 */
export function withAuth(handler: AuthedHandler): (req: Request) => Promise<Response>
export function withAuth(
  handler: SessionHandler,
  options: { requireOnboarded: false },
): (req: Request) => Promise<Response>
export function withAuth(
  handler: AuthedHandler | SessionHandler,
  options: WithAuthOptions = {},
): (req: Request) => Promise<Response> {
  const requireOnboarded = options.requireOnboarded !== false

  return async (req) => {
    try {
      const session = await getSessionResolver()(req)
      if (!session) {
        throw AppError.unauthenticated()
      }

      if (!requireOnboarded) {
        return await (handler as SessionHandler)(session, req)
      }

      if (!session.onboarded || !session.orgId || !session.orgRole) {
        throw AppError.onboardingIncomplete()
      }

      const ctx: OrgContext = {
        orgId: session.orgId,
        userId: session.userId,
        orgRole: session.orgRole,
      }

      return await (handler as AuthedHandler)(ctx, req)
    } catch (error) {
      const { status, body } = serializeError(error)
      return Response.json(body, { status })
    }
  }
}
