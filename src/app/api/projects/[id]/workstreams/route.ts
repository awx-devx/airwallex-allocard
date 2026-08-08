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
    await requirePermission(ctx, 'project.view')
    return ok(await listProjectWorkstreams(ctx, requireProjectId(req)))
  }),
)

/** Create workstream — `project.edit`. */
export const POST = withRouteParams(
  withAuth(
    withValidation(projectContracts.createWorkstream.input, async (ctx, input, req) => {
      await requirePermission(ctx, 'project.edit')
      return created(await createProjectWorkstream(ctx, requireProjectId(req), input))
    }),
  ),
)
