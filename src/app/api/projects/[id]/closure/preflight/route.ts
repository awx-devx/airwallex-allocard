import { AppError } from '@/server/http/errors'
import { ok } from '@/server/http/respond'
import { requirePermission } from '@/server/http/requirePermission'
import { getRouteParams, withRouteParams } from '@/server/http/routeParams'
import { withAuth } from '@/server/http/withAuth'
import { closurePreflight } from '@/server/services/closure/preflight'
import { Permission } from '@/shared/enums/permissions'

function requireProjectId(req: Request): string {
  const { id } = getRouteParams(req)
  if (!id) {
    throw AppError.notFound()
  }
  return id
}

/** GET /api/projects/:id/closure/preflight — blocking items (`project.close`). */
export const GET = withRouteParams(
  withAuth(async (ctx, req) => {
    const projectId = requireProjectId(req)
    await requirePermission(ctx, Permission.PROJECT_CLOSE, { projectId })
    return ok(await closurePreflight(ctx, projectId))
  }),
)
