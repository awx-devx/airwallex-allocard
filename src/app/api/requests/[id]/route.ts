import { purchaseRequestContracts } from '@/shared/contracts/purchaseRequest'
import { AppError } from '@/server/http/errors'
import { ok } from '@/server/http/respond'
import { requirePermission } from '@/server/http/requirePermission'
import { getRouteParams, withRouteParams } from '@/server/http/routeParams'
import { withAuth } from '@/server/http/withAuth'
import { withValidation } from '@/server/http/withValidation'
import { getPurchaseRequest, updatePurchaseRequest } from '@/server/services/approvals/requests'
import { Permission } from '@/shared/enums/permissions'

function requireRequestId(req: Request): string {
  const { id } = getRouteParams(req)
  if (!id) {
    throw AppError.notFound()
  }
  return id
}

/**
 * GET /api/requests/:id — `transaction.view` with { projectId, userId: requestedBy }
 * so OWN scope only sees own requests. Cross-org → 404.
 */
export const GET = withRouteParams(
  withAuth(async (ctx, req) => {
    const requestId = requireRequestId(req)
    const existing = await getPurchaseRequest(ctx, requestId)
    if (!existing) {
      throw AppError.notFound()
    }
    await requirePermission(ctx, Permission.TRANSACTION_VIEW, {
      projectId: existing.projectId,
      userId: existing.requestedBy,
    })
    return ok(existing)
  }),
)

/**
 * PATCH /api/requests/:id — requester only (service enforces), while DRAFT.
 * Cross-org → 404.
 */
export const PATCH = withRouteParams(
  withAuth(
    withValidation(purchaseRequestContracts.update.input, async (ctx, input, req) => {
      const requestId = requireRequestId(req)
      return ok(await updatePurchaseRequest(ctx, requestId, input))
    }),
  ),
)
