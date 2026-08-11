import { projectContracts } from '@/shared/contracts/project'
import { AppError } from '@/server/http/errors'
import { ok } from '@/server/http/respond'
import { requirePermission } from '@/server/http/requirePermission'
import { getRouteParams, withRouteParams } from '@/server/http/routeParams'
import { withAuth } from '@/server/http/withAuth'
import { withValidation } from '@/server/http/withValidation'
import { permissionForTransition, transitionProject } from '@/server/services/projects/transition'
import { ProjectStatus } from '@/shared/enums/projectStatus'

function requireProjectId(req: Request): string {
  const { id } = getRouteParams(req)
  if (!id) {
    throw AppError.notFound()
  }
  return id
}

/** Status transition — permission varies by target status. */
export const POST = withRouteParams(
  withAuth(
    withValidation(projectContracts.transition.input, async (ctx, input, req) => {
      const projectId = requireProjectId(req)
      // B9.0: enter CLOSING only via POST /api/projects/:id/closure/start.
      if (input.to === ProjectStatus.CLOSING) {
        throw AppError.conflict('Use POST /api/projects/:id/closure/start to enter CLOSING')
      }
      await requirePermission(ctx, permissionForTransition(input.to), { projectId })
      return ok(await transitionProject(ctx, projectId, input))
    }),
  ),
)
