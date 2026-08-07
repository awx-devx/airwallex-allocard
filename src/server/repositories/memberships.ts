/**
 * Memberships are tenant-owned. Org-scoped methods take `OrgContext` first.
 *
 * Cross-tenant helpers (`listMembershipsForUser`, `hasActiveMembership`) exist for
 * session/`/api/me` and use `allowCrossTenant` explicitly — a user may belong to
 * many orgs.
 */
import { isValidObjectId } from 'mongoose'
import { MembershipModel } from '@/server/models/Membership'
import { toDomain } from '@/server/models/base'
import type { OrgContext } from '@/server/http/types'
import { MembershipStatus } from '@/shared/enums/membershipStatus'
import type { OrgRole } from '@/shared/enums/orgRole'
import type { Membership, MembershipWithOrg, MembershipWithUser } from '@/shared/types/membership'
import { findOrganizationsByIds } from '@/server/repositories/organizations'
import { findUsersByIds } from '@/server/repositories/users'

export type CreateMembershipInput = {
  userId: string
  orgRole: OrgRole
  status?: MembershipStatus
  joinedAt?: Date
}

export type UpdateMembershipInput = {
  orgRole?: OrgRole
  status?: MembershipStatus
}

function toMembership(doc: Parameters<typeof toDomain>[0]): Membership {
  const raw = toDomain<Record<string, unknown>>(doc)
  return {
    id: String(raw.id),
    orgId: String(raw.orgId),
    userId: String(raw.userId),
    orgRole: raw.orgRole as Membership['orgRole'],
    status: raw.status as Membership['status'],
    joinedAt: String(raw.joinedAt),
  }
}

export async function createMembership(
  ctx: OrgContext,
  input: CreateMembershipInput,
): Promise<Membership> {
  const doc = await MembershipModel.create({
    orgId: ctx.orgId,
    userId: input.userId,
    orgRole: input.orgRole,
    status: input.status ?? MembershipStatus.ACTIVE,
    joinedAt: input.joinedAt ?? new Date(),
  })
  return toMembership(doc)
}

export async function findMembership(ctx: OrgContext, userId: string): Promise<Membership | null> {
  const doc = await MembershipModel.findOne({ orgId: ctx.orgId, userId }).lean().exec()
  return doc ? toMembership(doc) : null
}

export async function listMemberships(ctx: OrgContext): Promise<Membership[]> {
  const docs = await MembershipModel.find({ orgId: ctx.orgId }).lean().exec()
  return docs.map((doc) => toMembership(doc))
}

export async function listMembershipsWithUsers(ctx: OrgContext): Promise<MembershipWithUser[]> {
  const memberships = await listMemberships(ctx)
  const users = await findUsersByIds(memberships.map((m) => m.userId))
  const byId = new Map(users.map((u) => [u.id, u]))

  return memberships.flatMap((membership) => {
    const user = byId.get(membership.userId)
    if (!user) {
      return []
    }
    return [
      {
        ...membership,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          ...(user.image !== undefined ? { image: user.image } : {}),
        },
      },
    ]
  })
}

export async function updateMembership(
  ctx: OrgContext,
  userId: string,
  patch: UpdateMembershipInput,
): Promise<Membership | null> {
  const $set: Record<string, unknown> = {}
  if (patch.orgRole !== undefined) $set.orgRole = patch.orgRole
  if (patch.status !== undefined) $set.status = patch.status

  if (Object.keys($set).length === 0) {
    return findMembership(ctx, userId)
  }

  const doc = await MembershipModel.findOneAndUpdate(
    { orgId: ctx.orgId, userId },
    { $set },
    {
      returnDocument: 'after',
    },
  )
    .lean()
    .exec()
  return doc ? toMembership(doc) : null
}

export async function removeMembership(ctx: OrgContext, userId: string): Promise<boolean> {
  const result = await MembershipModel.deleteOne({ orgId: ctx.orgId, userId }).exec()
  return result.deletedCount === 1
}

export async function countOwners(ctx: OrgContext): Promise<number> {
  return MembershipModel.countDocuments({
    orgId: ctx.orgId,
    orgRole: 'OWNER',
    status: MembershipStatus.ACTIVE,
  }).exec()
}

/** Cross-tenant: all memberships for a user (session / `/api/me`). */
export async function listMembershipsForUser(userId: string): Promise<Membership[]> {
  const docs = await MembershipModel.find({ userId })
    .setOptions({ allowCrossTenant: true })
    .lean()
    .exec()
  return docs.map((doc) => toMembership(doc))
}

/** Cross-tenant: memberships with org summary for `/api/me`. */
export async function listMembershipsWithOrgsForUser(userId: string): Promise<MembershipWithOrg[]> {
  const memberships = await listMembershipsForUser(userId)
  const orgs = await findOrganizationsByIds(memberships.map((m) => m.orgId))
  const byId = new Map(orgs.map((o) => [o.id, o]))

  return memberships.flatMap((membership) => {
    const org = byId.get(membership.orgId)
    if (!org) {
      return []
    }
    return [
      {
        ...membership,
        org: { id: org.id, name: org.name, slug: org.slug },
      },
    ]
  })
}

/** Cross-tenant: derived onboarding check. */
export async function hasActiveMembership(userId: string): Promise<boolean> {
  const count = await MembershipModel.countDocuments({
    userId,
    status: MembershipStatus.ACTIVE,
  })
    .setOptions({ allowCrossTenant: true })
    .exec()
  return count > 0
}

/**
 * Membership in a specific org without a full `OrgContext` (e.g. session
 * resolution). Still filters on `orgId` for the tenant plugin.
 */
export async function findMembershipInOrg(
  orgId: string,
  userId: string,
): Promise<Membership | null> {
  if (!isValidObjectId(orgId)) {
    return null
  }
  const doc = await MembershipModel.findOne({ orgId, userId }).lean().exec()
  return doc ? toMembership(doc) : null
}
