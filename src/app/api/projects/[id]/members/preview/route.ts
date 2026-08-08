import { projectMemberContracts } from '@/shared/contracts/projectMember'
import { AppError } from '@/server/http/errors'
import { ok } from '@/server/http/respond'
import { requirePermission } from '@/server/http/requirePermission'
import { getRouteParams, withRouteParams } from '@/server/http/routeParams'
import { withAuth } from '@/server/http/withAuth'
import { withValidation } from '@/server/http/withValidation'
import { previewProjectMemberPermissions } from '@/server/services/projectMembers/preview'
import { Permission } from '@/shared/enums/permissions'

function requireProjectId(req: Request): string {
  const { id } = getRouteParams(req)
  if (!id) {
    throw AppError.notFound()
  }
  return id
}

/** Preview effective permissions for a hypothetical role+scope — `member.view`. */
export const POST = withRouteParams(
  withAuth(
    withValidation(projectMemberContracts.preview.input, async (ctx, input, req) => {
      const projectId = requireProjectId(req)
      await requirePermission(ctx, Permission.MEMBER_VIEW, { projectId })
      return ok(await previewProjectMemberPermissions(ctx, projectId, input))
    }),
  ),
)
