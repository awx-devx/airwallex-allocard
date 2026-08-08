import { getExplicitOrgId, resolveOrgContextForUser } from '@/server/auth/session'
import { connectDb } from '@/server/db/connect'
import { AppError } from '@/server/http/errors'
import type { AuthSession, OrgContext } from '@/server/http/types'
import { audit } from '@/server/services/audit/log'
import { PLATFORM_ORG_ID } from '@/server/services/auth/signUp'
import {
  findMembershipInOrg,
  listMembershipsWithOrgsForUser,
} from '@/server/repositories/memberships'
import { findOrganizationById } from '@/server/repositories/organizations'
import { findUserById, updateUser } from '@/server/repositories/users'
import { ActorType } from '@/shared/enums/audit'
import { MembershipStatus } from '@/shared/enums/membershipStatus'
import type { MeResponse } from '@/shared/types/auth'
import type { UpdateMeInput } from '@/shared/types/user'

function auditCtx(session: AuthSession): OrgContext {
  return {
    orgId: session.orgId ?? PLATFORM_ORG_ID,
    userId: session.userId,
    orgRole: session.orgRole ?? 'MEMBER',
  }
}

/**
 * Build `meResponse` for the signed-in user.
 * `onboarded` and `activeOrg` are derived from memberships + optional explicit org.
 */
export async function getMe(userId: string, req?: Request): Promise<MeResponse> {
  await connectDb()

  const user = await findUserById(userId)
  if (!user) {
    throw AppError.notFound()
  }

  const explicitOrgId = req ? getExplicitOrgId(req) : undefined
  const ctx = await resolveOrgContextForUser(userId, explicitOrgId)
  const memberships = await listMembershipsWithOrgsForUser(userId)

  let activeOrg: MeResponse['activeOrg']
  if (ctx.orgId) {
    const org = await findOrganizationById(ctx.orgId)
    if (org) {
      activeOrg = org
    }
  }

  return {
    user,
    memberships,
    ...(activeOrg !== undefined ? { activeOrg } : {}),
    onboarded: ctx.onboarded,
  }
}

/**
 * Update the signed-in user's profile fields.
 * `defaultOrgId` must reference an ACTIVE membership (or null to clear).
 */
export async function updateMe(
  session: AuthSession,
  input: UpdateMeInput,
  req?: Request,
): Promise<MeResponse> {
  await connectDb()

  const before = await findUserById(session.userId)
  if (!before) {
    throw AppError.notFound()
  }

  if (input.defaultOrgId !== undefined && input.defaultOrgId !== null) {
    const membership = await findMembershipInOrg(input.defaultOrgId, session.userId)
    if (!membership || membership.status !== MembershipStatus.ACTIVE) {
      throw AppError.notFound()
    }
  }

  const after = await updateUser(session.userId, {
    ...(input.name !== undefined ? { name: input.name } : {}),
    ...(input.image !== undefined ? { image: input.image } : {}),
    ...(input.defaultOrgId !== undefined ? { defaultOrgId: input.defaultOrgId } : {}),
  })
  if (!after) {
    throw AppError.notFound()
  }

  await audit(auditCtx(session), {
    action: 'user.updated',
    subjectType: 'user',
    subjectId: session.userId,
    actorType: ActorType.USER,
    actorId: session.userId,
    before,
    after,
  })

  return getMe(session.userId, req)
}
