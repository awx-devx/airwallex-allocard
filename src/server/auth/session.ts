/**
 * Request-level session resolution for `withAuth`.
 *
 * `onboarded` is derived (has ≥1 ACTIVE membership), never stored.
 * Active org order: explicit request `orgId` → `user.defaultOrgId` → sole membership.
 * Explicit org the user is not an ACTIVE member of → `NOT_FOUND` (404, not 403),
 * except when the user is not onboarded — a leftover `x-org-id` from a previous
 * account is ignored so onboarding / me / create-org stay reachable after sign-up.
 */
import { getToken, type JWT } from 'next-auth/jwt'
import { connectDb } from '@/server/db/connect'
import { loadServerEnv } from '@/server/env'
import { AppError } from '@/server/http/errors'
import type { AuthSession } from '@/server/http/types'
import { setSessionResolver } from '@/server/http/sessionResolver'
import {
  findMembershipInOrg,
  hasActiveMembership,
  listMembershipsForUser,
} from '@/server/repositories/memberships'
import { findUserById } from '@/server/repositories/users'
import { MembershipStatus } from '@/shared/enums/membershipStatus'
import type { OrgRole } from '@/shared/enums/orgRole'

export type ResolvedOrgContext = {
  orgId: string | null
  orgRole: OrgRole | null
  onboarded: boolean
}

/** Explicit org from `x-org-id` header or `orgId` query param. */
export function getExplicitOrgId(req: Request): string | undefined {
  const header = req.headers.get('x-org-id')?.trim()
  if (header) {
    return header
  }
  try {
    const orgId = new URL(req.url).searchParams.get('orgId')?.trim()
    return orgId || undefined
  } catch {
    return undefined
  }
}

/**
 * Derive onboarding + active org for a user.
 * When `explicitOrgId` is set and an onboarded user is not an ACTIVE member → throws `NOT_FOUND`.
 * A leftover `x-org-id` from a previous account is ignored when the user is not onboarded,
 * so unscoped routes (onboarding, me, create-org) are not 404'd after sign-up.
 */
export async function resolveOrgContextForUser(
  userId: string,
  explicitOrgId?: string,
): Promise<ResolvedOrgContext> {
  // Explicit org first — non-member / suspended → 404 (never 403), once onboarded.
  if (explicitOrgId) {
    const membership = await findMembershipInOrg(explicitOrgId, userId)
    if (membership?.status === MembershipStatus.ACTIVE) {
      return {
        orgId: membership.orgId,
        orgRole: membership.orgRole,
        onboarded: true,
      }
    }
    // Suspended, or an onboarded user asking for an org they are not in → 404.
    // No row at all + not onboarded: leftover `x-org-id` from another account.
    if (membership || (await hasActiveMembership(userId))) {
      throw AppError.notFound()
    }
    return { orgId: null, orgRole: null, onboarded: false }
  }

  const onboarded = await hasActiveMembership(userId)
  if (!onboarded) {
    return { orgId: null, orgRole: null, onboarded: false }
  }

  const user = await findUserById(userId)
  if (user?.defaultOrgId) {
    const membership = await findMembershipInOrg(user.defaultOrgId, userId)
    if (membership && membership.status === MembershipStatus.ACTIVE) {
      return {
        orgId: membership.orgId,
        orgRole: membership.orgRole,
        onboarded: true,
      }
    }
  }

  const memberships = (await listMembershipsForUser(userId)).filter(
    (m) => m.status === MembershipStatus.ACTIVE,
  )
  if (memberships.length === 1) {
    const sole = memberships[0]!
    return { orgId: sole.orgId, orgRole: sole.orgRole, onboarded: true }
  }

  // Multiple orgs and no usable default — client must pass x-org-id / set defaultOrgId.
  return { orgId: null, orgRole: null, onboarded: true }
}

type UserIdReader = (req: Request) => Promise<string | null>

const AUTHJS_SESSION_COOKIE = 'authjs.session-token'
const AUTHJS_SECURE_SESSION_COOKIE = `__Secure-${AUTHJS_SESSION_COOKIE}`

/**
 * Auth.js encrypts the JWT with the cookie name as salt. `getToken` defaults
 * to the unprefixed name (`secureCookie: false`). Google sign-in via an HTTPS
 * host (AUTH_URL tunnel) sets `__Secure-authjs.session-token`, so the layout's
 * `auth()` succeeds while API `withAuth` would 401.
 */
export function sessionTokenSecureCookie(cookieHeader: string | null): boolean | undefined {
  if (!cookieHeader) return undefined
  if (cookieHeader.includes(AUTHJS_SECURE_SESSION_COOKIE)) return true
  if (new RegExp(`(?:^|;\\s*)${AUTHJS_SESSION_COOKIE}(?:[.=]|$)`).test(cookieHeader)) {
    return false
  }
  return undefined
}

function secureCookieAttempts(req: Request, authUrl: string): boolean[] {
  const hinted = sessionTokenSecureCookie(req.headers.get('cookie'))
  const preferSecure = hinted ?? new URL(authUrl).protocol === 'https:'
  return preferSecure ? [true, false] : [false, true]
}

async function decodeSessionToken(
  req: Request,
  secret: string,
  secureCookie: boolean,
): Promise<JWT | null> {
  return getToken({
    req: req as never,
    secret,
    secureCookie,
  })
}

function userIdFromToken(token: JWT | null): string | null {
  if (!token) return null
  if (typeof token.userId === 'string' && token.userId.length > 0) {
    return token.userId
  }
  if (typeof token.sub === 'string' && token.sub.length > 0) {
    return token.sub
  }
  return null
}

async function readUserIdFromJwt(req: Request): Promise<string | null> {
  const env = loadServerEnv()
  for (const secureCookie of secureCookieAttempts(req, env.AUTH_URL)) {
    const userId = userIdFromToken(await decodeSessionToken(req, env.AUTH_SECRET, secureCookie))
    if (userId) return userId
  }
  return null
}

let readUserId: UserIdReader = readUserIdFromJwt

/** Test seam — swap out Auth.js JWT reading. */
export function setAuthUserIdReader(reader: UserIdReader): void {
  readUserId = reader
}

export function resetAuthUserIdReader(): void {
  readUserId = readUserIdFromJwt
}

export async function resolveAuthSession(req: Request): Promise<AuthSession | null> {
  const userId = await readUserId(req)
  if (!userId) {
    return null
  }

  await connectDb()
  const explicitOrgId = getExplicitOrgId(req)
  const ctx = await resolveOrgContextForUser(userId, explicitOrgId)
  return {
    userId,
    orgId: ctx.orgId,
    orgRole: ctx.orgRole,
    onboarded: ctx.onboarded,
  }
}

/** Install the real Auth.js-backed resolver (replaces B0 stub). */
export function installAuthSessionResolver(): void {
  setSessionResolver(resolveAuthSession)
}

installAuthSessionResolver()
