import { connectDb } from '@/server/db/connect'
import { publishEvent } from '@/server/events/bus'
import { DomainEventType } from '@/server/events/types'
import { AppError } from '@/server/http/errors'
import type { AuthSession } from '@/server/http/types'
import { acceptInviteByTokenHash, findInviteByTokenHash } from '@/server/repositories/invites'
import { createMembership, findMembership } from '@/server/repositories/memberships'
import { findUserById, updateUser } from '@/server/repositories/users'
import { audit } from '@/server/services/audit/log'
import { hashInviteToken } from '@/server/services/invites/token'
import { ActorType } from '@/shared/enums/audit'
import { InviteStatus } from '@/shared/enums/inviteStatus'
import type { Invite } from '@/shared/types/invite'
import type { Membership } from '@/shared/types/membership'

function isMongoDuplicateKey(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code: unknown }).code === 11000
  )
}

function isExpired(invite: Invite, now = new Date()): boolean {
  if (invite.status === InviteStatus.EXPIRED) {
    return true
  }
  return new Date(invite.expiresAt).getTime() <= now.getTime()
}

/** Map a non-consumable invite to a distinguishable AppError. */
function rejectUnusableInvite(invite: Invite): never {
  if (invite.status === InviteStatus.REVOKED) {
    throw AppError.inviteRevoked()
  }
  if (invite.status === InviteStatus.ACCEPTED) {
    throw AppError.inviteAlreadyAccepted()
  }
  if (isExpired(invite)) {
    throw AppError.inviteExpired()
  }
  throw AppError.notFound()
}

/**
 * Accept an invite for the signed-in user.
 * Email must match. Single-use via conditional PENDING → ACCEPTED update.
 * Allowed before onboarding — accepting is how a user becomes onboarded.
 */
export async function acceptInvite(session: AuthSession, token: string): Promise<Membership> {
  await connectDb()

  const user = await findUserById(session.userId)
  if (!user) {
    throw AppError.notFound()
  }

  const tokenHash = hashInviteToken(token)
  const invite = await findInviteByTokenHash(tokenHash)
  if (!invite) {
    throw AppError.notFound()
  }

  // Check email before consuming so a mismatch never burns the invite.
  if (invite.email.toLowerCase() !== user.email.toLowerCase()) {
    throw AppError.inviteEmailMismatch()
  }

  if (invite.status !== InviteStatus.PENDING || isExpired(invite)) {
    rejectUnusableInvite(invite)
  }

  const accepted = await acceptInviteByTokenHash(tokenHash)
  if (!accepted) {
    // Race or state change between read and conditional update.
    const current = await findInviteByTokenHash(tokenHash)
    if (!current) {
      throw AppError.notFound()
    }
    rejectUnusableInvite(current)
  }

  const ctx = {
    orgId: accepted!.orgId,
    userId: session.userId,
    orgRole: accepted!.orgRole,
  }

  let membership: Membership
  try {
    membership = await createMembership(ctx, {
      userId: session.userId,
      orgRole: accepted!.orgRole,
    })
  } catch (error) {
    if (!isMongoDuplicateKey(error)) {
      throw error
    }
    const existing = await findMembership(ctx, session.userId)
    if (!existing) {
      throw error
    }
    membership = existing
  }

  if (!user.defaultOrgId) {
    await updateUser(session.userId, { defaultOrgId: accepted!.orgId })
  }

  await audit(ctx, {
    action: 'invite.accepted',
    subjectType: 'invite',
    subjectId: accepted!.id,
    actorType: ActorType.USER,
    actorId: session.userId,
    after: { invite: accepted, membership },
    metadata: { userId: session.userId },
  })

  await publishEvent({
    type: DomainEventType.MEMBER_JOINED,
    orgId: accepted!.orgId,
    subjectType: 'membership',
    subjectId: membership.id,
    payload: {
      membershipId: membership.id,
      userId: session.userId,
      orgRole: membership.orgRole,
      inviteId: accepted!.id,
    },
  })

  return membership
}
