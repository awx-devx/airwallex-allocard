import { activityContracts } from '@/shared/contracts/activity'
import { AppError } from '@/server/http/errors'
import { ok } from '@/server/http/respond'
import { requirePermission } from '@/server/http/requirePermission'
import { getRouteParams, withRouteParams } from '@/server/http/routeParams'
import { withAuth } from '@/server/http/withAuth'
import { withValidation } from '@/server/http/withValidation'
import { connectDb } from '@/server/db/connect'
import { findProjectById } from '@/server/repositories/projects'
import { listActivity } from '@/server/services/activity/feed'
import { Permission } from '@/shared/enums/permissions'

function requireProjectId(req: Request): string {
  const { id } = getRouteParams(req)
  if (!id) {
    throw AppError.notFound()
  }
  return id
}

/** GET /api/projects/:id/activity — unified feed; OWN scope → own items only. */
export const GET = withRouteParams(
  withAuth(
    withValidation(activityContracts.listForProject.input, async (ctx, query, req) => {
      const projectId = requireProjectId(req)
      await connectDb()
      const project = await findProjectById(ctx, projectId)
      if (!project) {
        throw AppError.notFound()
      }
      await requirePermission(ctx, Permission.TRANSACTION_VIEW, {
        projectId,
        userId: ctx.userId,
      })
      return ok(
        await listActivity(ctx, {
          ...query,
          projectId,
        }),
      )
    }),
  ),
)
