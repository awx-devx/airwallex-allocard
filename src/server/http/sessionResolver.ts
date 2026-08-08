import type { AuthSession } from '@/server/http/types'

export type SessionResolver = (req: Request) => Promise<AuthSession | null>

const stubResolveSession: SessionResolver = async () => null

let resolveSession: SessionResolver = stubResolveSession

/** Install the real (or test) session resolver. */
export function setSessionResolver(resolver: SessionResolver): void {
  resolveSession = resolver
}

/** Restore the unauthenticated stub. Used by tests. */
export function resetSessionResolver(): void {
  resolveSession = stubResolveSession
}

export function getSessionResolver(): SessionResolver {
  return resolveSession
}
