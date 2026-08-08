import { roleContracts } from '@/shared/contracts/role'
import { AppError } from '@/server/http/errors'
import { noContent, ok } from '@/server/http/respond'
import { requirePermission } from '@/server/http/requirePermission'
import { getRouteParams, withRouteParams } from '@/server/http/routeParams'
import { withAuth } from '@/server/http/withAuth'
import { withValidation } from '@/server/http/withValidation'
import { deleteRoleForOrg } from '@/server/services/roles/delete'
import { updateRoleForOrg } from '@/server/services/roles/mutate'
import { Permission } from '@/shared/enums/permissions'

function requireRoleId(req: Request): string {
  const { id } = getRouteParams(req)
  if (!id) {
    throw AppError.notFound()
  }
  return id
}

/** Update role — `role.assign`. Template-in-use needs `force`. */
export const PATCH = withRouteParams(
  withAuth(
    withValidation(roleContracts.update.input, async (ctx, input, req) => {
      await requirePermission(ctx, Permission.ROLE_ASSIGN)
      return ok(await updateRoleForOrg(ctx, requireRoleId(req), input))
    }),
  ),
)

/** Delete role — `role.assign`. Rejected while assigned. */
export const DELETE = withRouteParams(
  withAuth(async (ctx, req) => {
    await requirePermission(ctx, Permission.ROLE_ASSIGN)
    await deleteRoleForOrg(ctx, requireRoleId(req))
    return noContent()
  }),
)
