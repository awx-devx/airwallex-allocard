import { accessReviewContracts } from '@/shared/contracts/accessReview'
import { connectDb } from '@/server/db/connect'
import { AppError } from '@/server/http/errors'
import { ok } from '@/server/http/respond'
import { requirePermission } from '@/server/http/requirePermission'
import { getRouteParams, withRouteParams } from '@/server/http/routeParams'
import { withAuth } from '@/server/http/withAuth'
import { withValidation } from '@/server/http/withValidation'
import { findAccessReviewById } from '@/server/repositories/accessReviews'
import { resolveAccessReviewForOrg } from '@/server/services/accessReviews/resolve'
import { Permission } from '@/shared/enums/permissions'

function requireReviewId(req: Request): string {
  const { id } = getRouteParams(req)
  if (!id) {
    throw AppError.notFound()
  }
  return id
}

/** Resolve access review — `member.manage` on the review's project. */
export const POST = withRouteParams(
  withAuth(
    withValidation(accessReviewContracts.resolve.input, async (ctx, input, req) => {
      const reviewId = requireReviewId(req)
      await connectDb()
      const existing = await findAccessReviewById(ctx, reviewId)
      if (!existing) {
        throw AppError.notFound()
      }
      await requirePermission(ctx, Permission.MEMBER_MANAGE, { projectId: existing.projectId })
      return ok(await resolveAccessReviewForOrg(ctx, reviewId, input))
    }),
  ),
)
