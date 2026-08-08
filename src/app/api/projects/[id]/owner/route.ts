import { projectContracts } from '@/shared/contracts/project'
import { AppError } from '@/server/http/errors'
import { ok } from '@/server/http/respond'
import { requirePermission } from '@/server/http/requirePermission'
import { getRouteParams, withRouteParams } from '@/server/http/routeParams'
import { withAuth } from '@/server/http/withAuth'
import { withValidation } from '@/server/http/withValidation'
import { changeProjectOwner } from '@/server/services/projects/owner'

function requireProjectId(req: Request): string {
  const { id } = getRouteParams(req)
  if (!id) {
    throw AppError.notFound()
  }
  return id
}

/** Change project owner — `project.edit`. */
export const PATCH = withRouteParams(
  withAuth(
    withValidation(projectContracts.changeOwner.input, async (ctx, input, req) => {
      await requirePermission(ctx, 'project.edit')
      return ok(await changeProjectOwner(ctx, requireProjectId(req), input))
    }),
  ),
)
