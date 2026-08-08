import { connectDb } from '@/server/db/connect'
import { AppError } from '@/server/http/errors'
import type { OrgContext } from '@/server/http/types'
import {
  countOwners,
  findMembership,
  listMembershipsWithUsers,
  removeMembership,
  updateMembership,
} from '@/server/repositories/memberships'
import { findUserById } from '@/server/repositories/users'
import { audit } from '@/server/services/audit/log'
import { ActorType } from '@/shared/enums/audit'
import { MembershipStatus } from '@/shared/enums/membershipStatus'
import { OrgRole } from '@/shared/enums/orgRole'
import type { Membership, MembershipWithUser, UpdateMemberInput } from '@/shared/types/membership'

function assertOrgMatches(ctx: OrgContext, orgId: string): void {
  if (ctx.orgId !== orgId) {
    throw AppError.notFound()
  }
}

async function toMembershipWithUser(membership: Membership): Promise<MembershipWithUser | null> {
  const user = await findUserById(membership.userId)
  if (!user) {
    return null
  }
  return {
    ...membership,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      ...(user.image !== undefined ? { image: user.image } : {}),
    },
  }
}

/**
 * True when this membership is currently an ACTIVE OWNER and the patch/removal
 * would leave the org with zero ACTIVE OWNERs.
 */
function wouldLoseActiveOwner(
  membership: Membership,
  patch?: Pick<UpdateMemberInput, 'orgRole' | 'status'>,
): boolean {
  if (membership.orgRole !== OrgRole.OWNER || membership.status !== MembershipStatus.ACTIVE) {
    return false
  }
  if (patch === undefined) {
    return true // removal
  }
  const nextRole = patch.orgRole ?? membership.orgRole
  const nextStatus = patch.status ?? membership.status
  return nextRole !== OrgRole.OWNER || nextStatus !== MembershipStatus.ACTIVE
}

async function assertNotLastOwner(
  ctx: OrgContext,
  membership: Membership,
  patch?: Pick<UpdateMemberInput, 'orgRole' | 'status'>,
): Promise<void> {
  if (!wouldLoseActiveOwner(membership, patch)) {
    return
  }
  const owners = await countOwners(ctx)
  if (owners <= 1) {
    throw AppError.conflict('Cannot remove or demote the last owner')
  }
}

/** List org members with user summaries. Any active member may call. */
export async function listOrgMembers(
  ctx: OrgContext,
  orgId: string,
): Promise<MembershipWithUser[]> {
  await connectDb()
  assertOrgMatches(ctx, orgId)
  return listMembershipsWithUsers(ctx)
}

/** Change org role and/or status. Caller must already have passed `org.manage`. */
export async function updateOrgMember(
  ctx: OrgContext,
  orgId: string,
  userId: string,
  input: UpdateMemberInput,
): Promise<MembershipWithUser> {
  await connectDb()
  assertOrgMatches(ctx, orgId)

  const before = await findMembership(ctx, userId)
  if (!before) {
    throw AppError.notFound()
  }

  await assertNotLastOwner(ctx, before, input)

  const after = await updateMembership(ctx, userId, input)
  if (!after) {
    throw AppError.notFound()
  }

  const withUser = await toMembershipWithUser(after)
  if (!withUser) {
    throw AppError.notFound()
  }

  await audit(ctx, {
    action: 'member.updated',
    subjectType: 'membership',
    subjectId: after.id,
    actorType: ActorType.USER,
    actorId: ctx.userId,
    before,
    after,
    metadata: { userId },
  })

  return withUser
}

/** Remove a member from the org. Caller must already have passed `org.manage`. */
export async function removeOrgMember(
  ctx: OrgContext,
  orgId: string,
  userId: string,
): Promise<void> {
  await connectDb()
  assertOrgMatches(ctx, orgId)

  const before = await findMembership(ctx, userId)
  if (!before) {
    throw AppError.notFound()
  }

  await assertNotLastOwner(ctx, before)

  const removed = await removeMembership(ctx, userId)
  if (!removed) {
    throw AppError.notFound()
  }

  await audit(ctx, {
    action: 'member.removed',
    subjectType: 'membership',
    subjectId: before.id,
    actorType: ActorType.USER,
    actorId: ctx.userId,
    before,
    metadata: { userId },
  })
}
