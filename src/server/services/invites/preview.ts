import { connectDb } from '@/server/db/connect'
import { AppError } from '@/server/http/errors'
import { findInviteByTokenHash } from '@/server/repositories/invites'
import { findOrganizationById } from '@/server/repositories/organizations'
import { findUserById } from '@/server/repositories/users'
import { hashInviteToken } from '@/server/services/invites/token'
import { InviteStatus } from '@/shared/enums/inviteStatus'
import type { InvitePreview } from '@/shared/types/invite'

/**
 * Public preview for the accept screen. Resolves by token hash; returns only
 * the minimal `invitePreview` shape. Revoked/accepted/unknown → 404.
 */
export async function previewInvite(rawToken: string): Promise<InvitePreview> {
  await connectDb()

  const invite = await findInviteByTokenHash(hashInviteToken(rawToken))
  if (!invite || invite.status !== InviteStatus.PENDING) {
    throw AppError.notFound()
  }

  const [org, inviter] = await Promise.all([
    findOrganizationById(invite.orgId),
    findUserById(invite.invitedBy),
  ])
  if (!org || !inviter) {
    throw AppError.notFound()
  }

  return {
    orgName: org.name,
    invitedByName: inviter.name,
    orgRole: invite.orgRole,
    expiresAt: invite.expiresAt,
  }
}
