import { AppError } from '@/server/http/errors'
import { noContent } from '@/server/http/respond'
import { requirePermission } from '@/server/http/requirePermission'
import { getRouteParams, withRouteParams } from '@/server/http/routeParams'
import { withAuth } from '@/server/http/withAuth'
import { revokeOrgInvite } from '@/server/services/invites/create'

function requireInviteId(req: Request): string {
  const { id } = getRouteParams(req)
  if (!id) {
    throw AppError.notFound()
  }
  return id
}

/** Revoke invite — `org.manage`. */
export const DELETE = withRouteParams(
  withAuth(async (ctx, req) => {
    await requirePermission(ctx, 'org.manage')
    await revokeOrgInvite(ctx, requireInviteId(req))
    return noContent()
  }),
)
