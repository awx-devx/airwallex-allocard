import { connectDb } from '@/server/db/connect'
import { AppError } from '@/server/http/errors'
import type { OrgContext } from '@/server/http/types'
import { findMembership } from '@/server/repositories/memberships'
import { changeOwner as changeOwnerRecord, findProjectById } from '@/server/repositories/projects'
import { audit } from '@/server/services/audit/log'
import { ActorType } from '@/shared/enums/audit'
import { MembershipStatus } from '@/shared/enums/membershipStatus'
import type { ChangeOwnerInput, Project } from '@/shared/types/project'

/**
 * Change project owner. Separate from PATCH for audit clarity.
 * New owner must be an ACTIVE member of the org.
 */
export async function changeProjectOwner(
  ctx: OrgContext,
  projectId: string,
  input: ChangeOwnerInput,
): Promise<Project> {
  await connectDb()

  const before = await findProjectById(ctx, projectId)
  if (!before) {
    throw AppError.notFound()
  }

  const membership = await findMembership(ctx, input.ownerId)
  if (!membership || membership.status !== MembershipStatus.ACTIVE) {
    throw AppError.validationFailed({
      ownerId: ['Owner must be an active member of this organisation'],
    })
  }

  const after = await changeOwnerRecord(ctx, projectId, input.ownerId)
  if (!after) {
    throw AppError.notFound()
  }

  await audit(ctx, {
    action: 'project.owner_changed',
    subjectType: 'project',
    subjectId: projectId,
    projectId,
    actorType: ActorType.USER,
    actorId: ctx.userId,
    before: { ownerId: before.ownerId },
    after: { ownerId: after.ownerId },
  })

  return after
}
