import { projectMemberContracts } from '@/shared/contracts/projectMember'
import { AppError } from '@/server/http/errors'
import { created, ok } from '@/server/http/respond'
import { requirePermission } from '@/server/http/requirePermission'
import { getRouteParams, withRouteParams } from '@/server/http/routeParams'
import { withAuth } from '@/server/http/withAuth'
import { withValidation } from '@/server/http/withValidation'
import { listProjectMembersForProject } from '@/server/services/projectMembers/list'
import { addProjectMemberForProject } from '@/server/services/projectMembers/mutate'
import { Permission } from '@/shared/enums/permissions'

function requireProjectId(req: Request): string {
  const { id } = getRouteParams(req)
  if (!id) {
    throw AppError.notFound()
  }
  return id
}

/** List project members — `member.view`. Cross-org → 404. */
export const GET = withRouteParams(
  withAuth(async (ctx, req) => {
    const projectId = requireProjectId(req)
    await requirePermission(ctx, Permission.MEMBER_VIEW, { projectId })
    return ok(await listProjectMembersForProject(ctx, projectId))
  }),
)

/** Add project member — `member.manage`. */
export const POST = withRouteParams(
  withAuth(
    withValidation(projectMemberContracts.add.input, async (ctx, input, req) => {
      const projectId = requireProjectId(req)
      await requirePermission(ctx, Permission.MEMBER_MANAGE, { projectId })
      return created(await addProjectMemberForProject(ctx, projectId, input))
    }),
  ),
)
