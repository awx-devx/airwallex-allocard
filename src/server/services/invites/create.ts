import { connectDb } from '@/server/db/connect'
import { publishEvent } from '@/server/events/bus'
import { DomainEventType } from '@/server/events/types'
import { AppError } from '@/server/http/errors'
import type { OrgContext } from '@/server/http/types'
import {
  createInvite,
  findInviteById,
  listPendingInvites,
  revokeInvite as revokeInviteRecord,
} from '@/server/repositories/invites'
import { findMembership } from '@/server/repositories/memberships'
import { findUserByEmail, findUserById } from '@/server/repositories/users'
import { audit } from '@/server/services/audit/log'
import {
  generateInviteToken,
  hashInviteToken,
  inviteExpiresAt,
} from '@/server/services/invites/token'
import { ActorType } from '@/shared/enums/audit'
import { MembershipStatus } from '@/shared/enums/membershipStatus'
import type { CreateInviteInput, CreateInviteOutput, Invite } from '@/shared/types/invite'

/**
 * Create a pending invite. Raw token is returned once for the link; only the
 * hash is persisted. Logs the accept link instead of sending email.
 */
export async function createOrgInvite(
  ctx: OrgContext,
  input: CreateInviteInput,
): Promise<CreateInviteOutput> {
  await connectDb()

  const email = input.email.toLowerCase()

  const existingUser = await findUserByEmail(email)
  if (existingUser) {
    const membership = await findMembership(ctx, existingUser.id)
    if (membership && membership.status === MembershipStatus.ACTIVE) {
      throw AppError.conflict('User is already a member of this organisation')
    }
  }

  const pending = await listPendingInvites(ctx)
  if (pending.some((invite) => invite.email === email)) {
    throw AppError.conflict('A pending invite already exists for this email')
  }

  const token = generateInviteToken()
  const tokenHash = hashInviteToken(token)
  const expiresAt = inviteExpiresAt()

  const invite = await createInvite(ctx, {
    email,
    orgRole: input.orgRole,
    tokenHash,
    expiresAt,
    invitedBy: ctx.userId,
  })

  const inviter = await findUserById(ctx.userId)
  // Demo: log the link instead of emailing it.
  console.info('[invite] accept link', {
    orgId: ctx.orgId,
    email,
    invitedBy: inviter?.email ?? ctx.userId,
    path: `/accept-invite/${token}`,
  })

  await audit(ctx, {
    action: 'invite.created',
    subjectType: 'invite',
    subjectId: invite.id,
    actorType: ActorType.USER,
    actorId: ctx.userId,
    after: invite,
    metadata: { email, orgRole: input.orgRole },
  })

  await publishEvent({
    type: DomainEventType.MEMBER_INVITED,
    orgId: ctx.orgId,
    subjectType: 'invite',
    subjectId: invite.id,
    payload: {
      inviteId: invite.id,
      email,
      orgRole: input.orgRole,
      invitedBy: ctx.userId,
    },
  })

  return { ...invite, token }
}

/** Pending invites for the active org. */
export async function listOrgInvites(ctx: OrgContext): Promise<Invite[]> {
  await connectDb()
  return listPendingInvites(ctx)
}

/** Revoke a pending invite. Already-accepted/revoked/missing → 404. */
export async function revokeOrgInvite(ctx: OrgContext, inviteId: string): Promise<void> {
  await connectDb()

  const before = await findInviteById(ctx, inviteId)
  if (!before) {
    throw AppError.notFound()
  }

  const after = await revokeInviteRecord(ctx, inviteId)
  if (!after) {
    throw AppError.notFound()
  }

  await audit(ctx, {
    action: 'invite.revoked',
    subjectType: 'invite',
    subjectId: inviteId,
    actorType: ActorType.USER,
    actorId: ctx.userId,
    before,
    after,
  })
}
