import { AppError, serializeError } from '@/server/http/errors'
import {
  getSessionResolver,
  resetSessionResolver,
  setSessionResolver,
  type SessionResolver,
} from '@/server/http/sessionResolver'
import type { OrgContext } from '@/server/http/types'
import '@/server/auth/session'

export type { AuthSession, OrgContext, OrgRole } from '@/server/http/types'
export type { SessionResolver }
export { setSessionResolver, resetSessionResolver }

export type AuthedHandler = (ctx: OrgContext, req: Request) => Response | Promise<Response>

/**
 * Resolves the session, builds `OrgContext`, enforces the onboarding gate,
 * and serialises any thrown `AppError` (or unknown error) to the standard envelope.
 *
 * The real Auth.js resolver is installed by importing `@/server/auth/session`
 * (side effect). Tests override via `installTestSessionResolver`.
 */
export function withAuth(handler: AuthedHandler): (req: Request) => Promise<Response> {
  return async (req) => {
    try {
      const session = await getSessionResolver()(req)
      if (!session) {
        throw AppError.unauthenticated()
      }
      if (!session.onboarded || !session.orgId || !session.orgRole) {
        throw AppError.onboardingIncomplete()
      }

      const ctx: OrgContext = {
        orgId: session.orgId,
        userId: session.userId,
        orgRole: session.orgRole,
      }

      return await handler(ctx, req)
    } catch (error) {
      const { status, body } = serializeError(error)
      return Response.json(body, { status })
    }
  }
}
