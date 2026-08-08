import { AppError } from '@/server/http/errors'
import { ok } from '@/server/http/respond'
import { requirePermission } from '@/server/http/requirePermission'
import { getRouteParams, withRouteParams } from '@/server/http/routeParams'
import { withAuth } from '@/server/http/withAuth'
import { getProjectHistory } from '@/server/services/projects/history'

function requireProjectId(req: Request): string {
  const { id } = getRouteParams(req)
  if (!id) {
    throw AppError.notFound()
  }
  return id
}

/** Project audit history — `project.view`. */
export const GET = withRouteParams(
  withAuth(async (ctx, req) => {
    await requirePermission(ctx, 'project.view')
    return ok(await getProjectHistory(ctx, requireProjectId(req)))
  }),
)
