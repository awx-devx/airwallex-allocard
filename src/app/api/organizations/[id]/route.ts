import { organizationContracts } from '@/shared/contracts/organization'
import { AppError } from '@/server/http/errors'
import { ok } from '@/server/http/respond'
import { requirePermission } from '@/server/http/requirePermission'
import { getRouteParams, withRouteParams } from '@/server/http/routeParams'
import { withAuth } from '@/server/http/withAuth'
import { withValidation } from '@/server/http/withValidation'
import { getOrganization } from '@/server/services/organizations/get'
import { updateOrganization } from '@/server/services/organizations/update'

function requireOrgId(req: Request): string {
  const { id } = getRouteParams(req)
  if (!id) {
    throw AppError.notFound()
  }
  return id
}

export const GET = withRouteParams(
  withAuth(async (ctx, req) => ok(await getOrganization(ctx, requireOrgId(req)))),
)

export const PATCH = withRouteParams(
  withAuth(
    withValidation(organizationContracts.update.input, async (ctx, input, req) => {
      const id = requireOrgId(req)
      await requirePermission(ctx, 'org.manage')
      return ok(await updateOrganization(ctx, id, input))
    }),
  ),
)
