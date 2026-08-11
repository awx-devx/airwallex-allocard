import { AppError } from '@/server/http/errors'
import { ok } from '@/server/http/respond'
import { getRouteParams, withRouteParams } from '@/server/http/routeParams'
import { withAuth } from '@/server/http/withAuth'
import { submitPurchaseRequest } from '@/server/services/approvals/requests'

function requireRequestId(req: Request): string {
  const { id } = getRouteParams(req)
  if (!id) {
    throw AppError.notFound()
  }
  return id
}

/**
 * POST /api/requests/:id/submit — requester only (service enforces).
 * Runs policy → PENDING | APPROVED. Cross-org → 404.
 */
export const POST = withRouteParams(
  withAuth(async (ctx, req) => {
    const requestId = requireRequestId(req)
    return ok(await submitPurchaseRequest(ctx, requestId))
  }),
)
