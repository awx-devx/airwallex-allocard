import { AppError } from '@/server/http/errors'
import { ok } from '@/server/http/respond'
import { requirePermission } from '@/server/http/requirePermission'
import { getRouteParams, withRouteParams } from '@/server/http/routeParams'
import { withAuth } from '@/server/http/withAuth'
import { getRuleRunForOrg } from '@/server/services/rules/explain'
import { Permission } from '@/shared/enums/permissions'

function requireRunId(req: Request): string {
  const { id } = getRouteParams(req)
  if (!id) {
    throw AppError.notFound()
  }
  return id
}

/** Get one rule run — `control.edit`. Cross-org → 404. */
export const GET = withRouteParams(
  withAuth(async (ctx, req) => {
    await requirePermission(ctx, Permission.CONTROL_EDIT)
    return ok(await getRuleRunForOrg(ctx, requireRunId(req)))
  }),
)
