import { projectMemberContracts } from '@/shared/contracts/projectMember'
import { AppError } from '@/server/http/errors'
import { noContent, ok } from '@/server/http/respond'
import { requirePermission } from '@/server/http/requirePermission'
import { getRouteParams, withRouteParams } from '@/server/http/routeParams'
import { withAuth } from '@/server/http/withAuth'
import { withValidation } from '@/server/http/withValidation'
import {
  removeProjectMemberForProject,
  updateProjectMemberForProject,
} from '@/server/services/projectMembers/mutate'
import { Permission } from '@/shared/enums/permissions'

function requireIds(req: Request): { projectId: string; userId: string } {
  const { id, userId } = getRouteParams(req)
  if (!id || !userId) {
    throw AppError.notFound()
  }
  return { projectId: id, userId }
}

/** Update project member role/scope — `member.manage`. */
export const PATCH = withRouteParams(
  withAuth(
    withValidation(projectMemberContracts.update.input, async (ctx, input, req) => {
      const { projectId, userId } = requireIds(req)
      await requirePermission(ctx, Permission.MEMBER_MANAGE, { projectId })
      return ok(await updateProjectMemberForProject(ctx, projectId, userId, input))
    }),
  ),
)

/** Soft-remove project member — `member.manage`. */
export const DELETE = withRouteParams(
  withAuth(async (ctx, req) => {
    const { projectId, userId } = requireIds(req)
    await requirePermission(ctx, Permission.MEMBER_MANAGE, { projectId })
    await removeProjectMemberForProject(ctx, projectId, userId)
    return noContent()
  }),
)
