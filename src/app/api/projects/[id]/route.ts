import { projectContracts } from '@/shared/contracts/project'
import { AppError } from '@/server/http/errors'
import { ok } from '@/server/http/respond'
import { requirePermission } from '@/server/http/requirePermission'
import { getRouteParams, withRouteParams } from '@/server/http/routeParams'
import { withAuth } from '@/server/http/withAuth'
import { withValidation } from '@/server/http/withValidation'
import { getProjectDetail } from '@/server/services/projects/get'
import { updateProjectForOrg } from '@/server/services/projects/update'
import { Permission } from '@/shared/enums/permissions'

function requireProjectId(req: Request): string {
  const { id } = getRouteParams(req)
  if (!id) {
    throw AppError.notFound()
  }
  return id
}

/** Get project detail — `project.view`. Cross-org → 404. */
export const GET = withRouteParams(
  withAuth(async (ctx, req) => {
    const projectId = requireProjectId(req)
    await requirePermission(ctx, Permission.PROJECT_VIEW, { projectId })
    return ok(await getProjectDetail(ctx, projectId))
  }),
)

/** Partial update — `project.edit`. Rejected on CLOSED/ARCHIVED/CANCELLED. */
export const PATCH = withRouteParams(
  withAuth(
    withValidation(projectContracts.update.input, async (ctx, input, req) => {
      const projectId = requireProjectId(req)
      await requirePermission(ctx, Permission.PROJECT_EDIT, { projectId })
      return ok(await updateProjectForOrg(ctx, projectId, input))
    }),
  ),
)
