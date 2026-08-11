import { AppError } from '@/server/http/errors'
import { ok } from '@/server/http/respond'
import { requirePermission } from '@/server/http/requirePermission'
import { getRouteParams, withRouteParams } from '@/server/http/routeParams'
import { withAuth } from '@/server/http/withAuth'
import { startClosure } from '@/server/services/closure/start'
import { Permission } from '@/shared/enums/permissions'

function requireProjectId(req: Request): string {
  const { id } = getRouteParams(req)
  if (!id) {
    throw AppError.notFound()
  }
  return id
}

/**
 * POST /api/projects/:id/closure/start — enter CLOSING, freeze cards (`project.close`).
 * Body is void (`startClosureInput`); empty POST is fine.
 */
export const POST = withRouteParams(
  withAuth(async (ctx, req) => {
    const projectId = requireProjectId(req)
    await requirePermission(ctx, Permission.PROJECT_CLOSE, { projectId })
    return ok(await startClosure(ctx, projectId))
  }),
)
