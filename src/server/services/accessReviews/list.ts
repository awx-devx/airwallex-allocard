import { connectDb } from '@/server/db/connect'
import { AppError } from '@/server/http/errors'
import type { OrgContext } from '@/server/http/types'
import { listAccessReviews } from '@/server/repositories/accessReviews'
import { findProjectById } from '@/server/repositories/projects'
import type { AccessReview, ListAccessReviewsQuery } from '@/shared/types/accessReview'

/** List access reviews for the org (optional status / project filters). */
export async function listAccessReviewsForOrg(
  ctx: OrgContext,
  query: ListAccessReviewsQuery,
): Promise<AccessReview[]> {
  await connectDb()

  if (query.projectId !== undefined) {
    const project = await findProjectById(ctx, query.projectId)
    if (!project) {
      throw AppError.notFound()
    }
  }

  return listAccessReviews(ctx, {
    status: query.status,
    projectId: query.projectId,
  })
}
