import { organizationContracts } from '@/shared/contracts/organization'
import { AppError } from '@/server/http/errors'
import { noContent, ok } from '@/server/http/respond'
import { requirePermission } from '@/server/http/requirePermission'
import { getRouteParams, withRouteParams } from '@/server/http/routeParams'
import { withAuth } from '@/server/http/withAuth'
import { withValidation } from '@/server/http/withValidation'
import { removeOrgMember, updateOrgMember } from '@/server/services/organizations/members'

function requireIds(req: Request): { orgId: string; userId: string } {
  const { id, userId } = getRouteParams(req)
  if (!id || !userId) {
    throw AppError.notFound()
  }
  return { orgId: id, userId }
}

/** Update member role/status — `org.manage`. */
export const PATCH = withRouteParams(
  withAuth(
    withValidation(organizationContracts.updateMember.input, async (ctx, input, req) => {
      const { orgId, userId } = requireIds(req)
      await requirePermission(ctx, 'org.manage')
      return ok(await updateOrgMember(ctx, orgId, userId, input))
    }),
  ),
)

/** Remove member — `org.manage`. */
export const DELETE = withRouteParams(
  withAuth(async (ctx, req) => {
    const { orgId, userId } = requireIds(req)
    await requirePermission(ctx, 'org.manage')
    await removeOrgMember(ctx, orgId, userId)
    return noContent()
  }),
)
