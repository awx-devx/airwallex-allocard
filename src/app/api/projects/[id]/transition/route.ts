import { projectContracts } from '@/shared/contracts/project'
import { AppError } from '@/server/http/errors'
import { ok } from '@/server/http/respond'
import { requirePermission } from '@/server/http/requirePermission'
import { getRouteParams, withRouteParams } from '@/server/http/routeParams'
import { withAuth } from '@/server/http/withAuth'
import { withValidation } from '@/server/http/withValidation'
import { permissionForTransition, transitionProject } from '@/server/services/projects/transition'

function requireProjectId(req: Request): string {
  const { id } = getRouteParams(req)
  if (!id) {
    throw AppError.notFound()
  }
  return id
}

/** Status transition — permission varies by target (B0 stub: OWNER/ADMIN). */
export const POST = withRouteParams(
  withAuth(
    withValidation(projectContracts.transition.input, async (ctx, input, req) => {
      await requirePermission(ctx, permissionForTransition(input.to))
      return ok(await transitionProject(ctx, requireProjectId(req), input))
    }),
  ),
)
