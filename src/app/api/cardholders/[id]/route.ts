import { AppError } from '@/server/http/errors'
import { ok } from '@/server/http/respond'
import { requirePermission } from '@/server/http/requirePermission'
import { getRouteParams, withRouteParams } from '@/server/http/routeParams'
import { withAuth } from '@/server/http/withAuth'
import { getCardholderForOrg } from '@/server/services/cardholders/list'
import { Permission } from '@/shared/enums/permissions'

function requireCardholderId(req: Request): string {
  const { id } = getRouteParams(req)
  if (!id) {
    throw AppError.notFound()
  }
  return id
}

/** GET /api/cardholders/:id — `card.view`. Cross-org → 404. */
export const GET = withRouteParams(
  withAuth(async (ctx, req) => {
    await requirePermission(ctx, Permission.CARD_VIEW)
    return ok(await getCardholderForOrg(ctx, requireCardholderId(req)))
  }),
)
