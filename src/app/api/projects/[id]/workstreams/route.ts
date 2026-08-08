import { projectContracts } from '@/shared/contracts/project'
import { AppError } from '@/server/http/errors'
import { created, ok } from '@/server/http/respond'
import { requirePermission } from '@/server/http/requirePermission'
import { getRouteParams, withRouteParams } from '@/server/http/routeParams'
import { withAuth } from '@/server/http/withAuth'
import { withValidation } from '@/server/http/withValidation'
import {
  createProjectWorkstream,
  listProjectWorkstreams,
} from '@/server/services/projects/workstreams'
import { Permission } from '@/shared/enums/permissions'

function requireProjectId(req: Request): string {
  const { id } = getRouteParams(req)
  if (!id) {
    throw AppError.notFound()
  }
  return id
}

/** List workstreams — `project.view`. */
export const GET = withRouteParams(
  withAuth(async (ctx, req) => {
    const projectId = requireProjectId(req)
    await requirePermission(ctx, Permission.PROJECT_VIEW, { projectId })
    return ok(await listProjectWorkstreams(ctx, projectId))
  }),
)

/** Create workstream — `project.edit`. */
export const POST = withRouteParams(
  withAuth(
    withValidation(projectContracts.createWorkstream.input, async (ctx, input, req) => {
      const projectId = requireProjectId(req)
      await requirePermission(ctx, Permission.PROJECT_EDIT, { projectId })
      return created(await createProjectWorkstream(ctx, projectId, input))
    }),
  ),
)
