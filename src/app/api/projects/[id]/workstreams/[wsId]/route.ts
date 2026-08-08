import { projectContracts } from '@/shared/contracts/project'
import { AppError } from '@/server/http/errors'
import { noContent, ok } from '@/server/http/respond'
import { requirePermission } from '@/server/http/requirePermission'
import { getRouteParams, withRouteParams } from '@/server/http/routeParams'
import { withAuth } from '@/server/http/withAuth'
import { withValidation } from '@/server/http/withValidation'
import {
  deleteProjectWorkstream,
  updateProjectWorkstream,
} from '@/server/services/projects/workstreams'
import { Permission } from '@/shared/enums/permissions'

function requireIds(req: Request): { projectId: string; wsId: string } {
  const { id, wsId } = getRouteParams(req)
  if (!id || !wsId) {
    throw AppError.notFound()
  }
  return { projectId: id, wsId }
}

/** Update workstream — `project.edit`. */
export const PATCH = withRouteParams(
  withAuth(
    withValidation(projectContracts.updateWorkstream.input, async (ctx, input, req) => {
      const { projectId, wsId } = requireIds(req)
      await requirePermission(ctx, Permission.PROJECT_EDIT, {
        projectId,
        workstreamId: wsId,
      })
      return ok(await updateProjectWorkstream(ctx, projectId, wsId, input))
    }),
  ),
)

/** Delete workstream — `project.edit`. Allowed until B4 reference checks exist. */
export const DELETE = withRouteParams(
  withAuth(async (ctx, req) => {
    const { projectId, wsId } = requireIds(req)
    await requirePermission(ctx, Permission.PROJECT_EDIT, {
      projectId,
      workstreamId: wsId,
    })
    await deleteProjectWorkstream(ctx, projectId, wsId)
    return noContent()
  }),
)
