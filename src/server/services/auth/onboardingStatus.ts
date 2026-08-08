import { connectDb } from '@/server/db/connect'
import { AppError } from '@/server/http/errors'
import type { AuthSession } from '@/server/http/types'
import { listPendingInvitesByEmail } from '@/server/repositories/invites'
import { hasActiveMembership } from '@/server/repositories/memberships'
import { findOrganizationsByIds } from '@/server/repositories/organizations'
import { findUserById, findUsersByIds } from '@/server/repositories/users'
import type { OnboardingStatus } from '@/shared/types/auth'
import type { InvitePreview } from '@/shared/types/invite'

/**
 * Onboarding fork payload: derived `onboarded` plus pending invite previews
 * for the signed-in user's email.
 */
export async function getOnboardingStatus(session: AuthSession): Promise<OnboardingStatus> {
  await connectDb()

  const user = await findUserById(session.userId)
  if (!user) {
    throw AppError.notFound()
  }

  const onboarded = await hasActiveMembership(session.userId)
  const pending = await listPendingInvitesByEmail(user.email)

  if (pending.length === 0) {
    return { onboarded, pendingInvites: [] }
  }

  const [orgs, inviters] = await Promise.all([
    findOrganizationsByIds(pending.map((invite) => invite.orgId)),
    findUsersByIds(pending.map((invite) => invite.invitedBy)),
  ])
  const orgById = new Map(orgs.map((org) => [org.id, org]))
  const inviterById = new Map(inviters.map((inviter) => [inviter.id, inviter]))

  const pendingInvites: InvitePreview[] = []
  for (const invite of pending) {
    const org = orgById.get(invite.orgId)
    const inviter = inviterById.get(invite.invitedBy)
    if (!org || !inviter) {
      continue
    }
    pendingInvites.push({
      orgName: org.name,
      invitedByName: inviter.name,
      orgRole: invite.orgRole,
      expiresAt: invite.expiresAt,
    })
  }

  return { onboarded, pendingInvites }
}
