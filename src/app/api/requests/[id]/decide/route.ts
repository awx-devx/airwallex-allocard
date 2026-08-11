import { purchaseRequestContracts } from '@/shared/contracts/purchaseRequest'
import { AppError } from '@/server/http/errors'
import { ok } from '@/server/http/respond'
import { requirePermission } from '@/server/http/requirePermission'
import { getRouteParams, withRouteParams } from '@/server/http/routeParams'
import { withAuth } from '@/server/http/withAuth'
import { withValidation } from '@/server/http/withValidation'
import { decidePurchaseRequest, getPurchaseRequest } from '@/server/services/approvals/requests'
import { Permission } from '@/shared/enums/permissions'

function requireRequestId(req: Request): string {
  const { id } = getRouteParams(req)
  if (!id) {
    throw AppError.notFound()
  }
  return id
}

/**
 * POST /api/requests/:id/decide — `request.approve` on the request's project.
 * Cross-org → 404.
 */
export const POST = withRouteParams(
  withAuth(
    withValidation(purchaseRequestContracts.decide.input, async (ctx, input, req) => {
      const requestId = requireRequestId(req)
      const existing = await getPurchaseRequest(ctx, requestId)
      if (!existing) {
        throw AppError.notFound()
      }
      await requirePermission(ctx, Permission.REQUEST_APPROVE, {
        projectId: existing.projectId,
      })
      return ok(await decidePurchaseRequest(ctx, requestId, input))
    }),
  ),
)
