import { AppError } from '@/server/http/errors'
import { ok } from '@/server/http/respond'
import { getRouteParams, withRouteParams } from '@/server/http/routeParams'
import { withAuth } from '@/server/http/withAuth'
import { listOrgMembers } from '@/server/services/organizations/members'

function requireOrgId(req: Request): string {
  const { id } = getRouteParams(req)
  if (!id) {
    throw AppError.notFound()
  }
  return id
}

/** List members — any org member. */
export const GET = withRouteParams(
  withAuth(async (ctx, req) => ok(await listOrgMembers(ctx, requireOrgId(req)))),
)
