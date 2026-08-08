import { connectDb } from '@/server/db/connect'
import { AppError } from '@/server/http/errors'
import type { OrgContext } from '@/server/http/types'
import {
  findAccessReviewById,
  resolveAccessReview as resolveAccessReviewRecord,
} from '@/server/repositories/accessReviews'
import { softRemoveProjectMember } from '@/server/repositories/projectMembers'
import { audit } from '@/server/services/audit/log'
import { ActorType } from '@/shared/enums/audit'
import { AccessReviewResolution, AccessReviewStatus } from '@/shared/enums/accessReviewStatus'
import type { AccessReview, ResolveAccessReviewInput } from '@/shared/types/accessReview'

/**
 * Resolve an open access review.
 * CONFIRM keeps access; REVOKE soft-removes the project member when still active.
 */
export async function resolveAccessReviewForOrg(
  ctx: OrgContext,
  reviewId: string,
  input: ResolveAccessReviewInput,
): Promise<AccessReview> {
  await connectDb()

  const before = await findAccessReviewById(ctx, reviewId)
  if (!before) {
    throw AppError.notFound()
  }
  if (before.status !== AccessReviewStatus.OPEN) {
    throw AppError.conflict('Access review is already resolved')
  }

  if (input.resolution === AccessReviewResolution.REVOKE) {
    await softRemoveProjectMember(ctx, before.projectId, before.userId)
  }

  const after = await resolveAccessReviewRecord(ctx, reviewId, input.resolution)
  if (!after) {
    throw AppError.conflict('Access review is already resolved')
  }

  await audit(ctx, {
    action: 'accessReview.resolved',
    subjectType: 'accessReview',
    subjectId: after.id,
    projectId: after.projectId,
    actorType: ActorType.USER,
    actorId: ctx.userId,
    before,
    after,
    metadata: {
      resolution: input.resolution,
      ...(input.note !== undefined ? { note: input.note } : {}),
      userId: after.userId,
      subjectId: after.subjectId,
    },
  })

  return after
}
