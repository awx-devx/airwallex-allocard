/**
 * Invites are tenant-owned. Org-scoped methods take `OrgContext` first.
 *
 * Cross-tenant helpers (`findInviteByTokenHash`, `listPendingInvitesByEmail`) use
 * `allowCrossTenant` for public preview and onboarding status.
 */
import { isValidObjectId } from 'mongoose'
import { InviteModel } from '@/server/models/Invite'
import { toDomain } from '@/server/models/base'
import type { OrgContext } from '@/server/http/types'
import { InviteStatus } from '@/shared/enums/inviteStatus'
import type { OrgRole } from '@/shared/enums/orgRole'
import type { Invite } from '@/shared/types/invite'

export type CreateInviteInput = {
  email: string
  orgRole: OrgRole
  tokenHash: string
  expiresAt: Date
  invitedBy: string
  status?: InviteStatus
}

function toInvite(doc: Parameters<typeof toDomain>[0]): Invite {
  const raw = toDomain<Record<string, unknown>>(doc)
  return {
    id: String(raw.id),
    orgId: String(raw.orgId),
    email: String(raw.email),
    orgRole: raw.orgRole as Invite['orgRole'],
    expiresAt: String(raw.expiresAt),
    status: raw.status as Invite['status'],
    invitedBy: String(raw.invitedBy),
  }
}

export async function createInvite(ctx: OrgContext, input: CreateInviteInput): Promise<Invite> {
  const doc = await InviteModel.create({
    orgId: ctx.orgId,
    email: input.email,
    orgRole: input.orgRole,
    tokenHash: input.tokenHash,
    expiresAt: input.expiresAt,
    invitedBy: input.invitedBy,
    status: input.status ?? InviteStatus.PENDING,
  })
  return toInvite(doc)
}

export async function findInviteById(ctx: OrgContext, inviteId: string): Promise<Invite | null> {
  if (!isValidObjectId(inviteId)) {
    return null
  }
  const doc = await InviteModel.findOne({ _id: inviteId, orgId: ctx.orgId }).lean().exec()
  return doc ? toInvite(doc) : null
}

export async function listPendingInvites(ctx: OrgContext): Promise<Invite[]> {
  const docs = await InviteModel.find({ orgId: ctx.orgId, status: InviteStatus.PENDING })
    .lean()
    .exec()
  return docs.map((doc) => toInvite(doc))
}

export async function revokeInvite(ctx: OrgContext, inviteId: string): Promise<Invite | null> {
  if (!isValidObjectId(inviteId)) {
    return null
  }
  const doc = await InviteModel.findOneAndUpdate(
    { _id: inviteId, orgId: ctx.orgId, status: InviteStatus.PENDING },
    { $set: { status: InviteStatus.REVOKED } },
    { returnDocument: 'after' },
  )
    .lean()
    .exec()
  return doc ? toInvite(doc) : null
}

/** Cross-tenant: resolve invite for public preview / accept by token hash. */
export async function findInviteByTokenHash(tokenHash: string): Promise<Invite | null> {
  const doc = await InviteModel.findOne({ tokenHash })
    .setOptions({ allowCrossTenant: true })
    .lean()
    .exec()
  return doc ? toInvite(doc) : null
}

/** Cross-tenant: pending invites for an email (onboarding fork). */
export async function listPendingInvitesByEmail(email: string): Promise<Invite[]> {
  const docs = await InviteModel.find({
    email: email.toLowerCase(),
    status: InviteStatus.PENDING,
  })
    .setOptions({ allowCrossTenant: true })
    .lean()
    .exec()
  return docs.map((doc) => toInvite(doc))
}

/**
 * Single-use accept: only transitions PENDING → ACCEPTED when still pending and
 * not expired. Returns null if the race was lost or the invite is unusable.
 */
export async function acceptInviteByTokenHash(tokenHash: string): Promise<Invite | null> {
  const doc = await InviteModel.findOneAndUpdate(
    {
      tokenHash,
      status: InviteStatus.PENDING,
      expiresAt: { $gt: new Date() },
    },
    { $set: { status: InviteStatus.ACCEPTED } },
    { returnDocument: 'after' },
  )
    .setOptions({ allowCrossTenant: true })
    .lean()
    .exec()
  return doc ? toInvite(doc) : null
}
