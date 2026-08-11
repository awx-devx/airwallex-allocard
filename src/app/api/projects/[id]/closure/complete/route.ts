import { AppError } from '@/server/http/errors'
import { ok } from '@/server/http/respond'
import { requirePermission } from '@/server/http/requirePermission'
import { getRouteParams, withRouteParams } from '@/server/http/routeParams'
import { withAuth } from '@/server/http/withAuth'
import { withValidation } from '@/server/http/withValidation'
import { completeClosure } from '@/server/services/closure/complete'
import { closureContracts } from '@/shared/contracts/closure'
import { Permission } from '@/shared/enums/permissions'

function requireProjectId(req: Request): string {
  const { id } = getRouteParams(req)
  if (!id) {
    throw AppError.notFound()
  }
  return id
}

/**
 * POST /api/projects/:id/closure/complete — close cards, final report, archive.
 * Requires both confirm literals (`project.close`).
 */
export const POST = withRouteParams(
  withAuth(
    withValidation(closureContracts.complete.input, async (ctx, input, req) => {
      const projectId = requireProjectId(req)
      await requirePermission(ctx, Permission.PROJECT_CLOSE, { projectId })
      return ok(await completeClosure(ctx, projectId, input))
    }),
  ),
)
