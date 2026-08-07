import { AppError, serializeError } from '@/server/http/errors'
import type { AuthSession, OrgContext } from '@/server/http/types'

export type { AuthSession, OrgContext, OrgRole } from '@/server/http/types'

export type AuthedHandler = (ctx: OrgContext, req: Request) => Response | Promise<Response>

export type SessionResolver = (req: Request) => Promise<AuthSession | null>

/**
 * B0 stub — always unauthenticated.
 * B1 replaces this via `setSessionResolver` (Auth.js) in `src/server/auth/session.ts`.
 */
const stubResolveSession: SessionResolver = async () => null

let resolveSession: SessionResolver = stubResolveSession

/** Install the real (or test) session resolver. Seam for B1. */
export function setSessionResolver(resolver: SessionResolver): void {
  resolveSession = resolver
}

/** Restore the B0 stub. Used by tests. */
export function resetSessionResolver(): void {
  resolveSession = stubResolveSession
}

/**
 * Resolves the session, builds `OrgContext`, enforces the onboarding gate,
 * and serialises any thrown `AppError` (or unknown error) to the standard envelope.
 */
export function withAuth(handler: AuthedHandler): (req: Request) => Promise<Response> {
  return async (req) => {
    try {
      const session = await resolveSession(req)
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
