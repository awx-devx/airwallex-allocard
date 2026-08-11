import { purchaseRequestContracts } from '@/shared/contracts/purchaseRequest'
import { AppError } from '@/server/http/errors'
import { created, ok } from '@/server/http/respond'
import { requirePermission, shouldSeeOnlyOwnRequests } from '@/server/http/requirePermission'
import { getRouteParams, withRouteParams } from '@/server/http/routeParams'
import { withAuth } from '@/server/http/withAuth'
import { withValidation } from '@/server/http/withValidation'
import {
  createPurchaseRequest,
  listPurchaseRequestsForProject,
} from '@/server/services/approvals/requests'
import { Permission } from '@/shared/enums/permissions'

function requireProjectId(req: Request): string {
  const { id } = getRouteParams(req)
  if (!id) {
    throw AppError.notFound()
  }
  return id
}

/** GET /api/projects/:id/requests — `transaction.view`; OWN scope → own only. */
export const GET = withRouteParams(
  withAuth(
    withValidation(purchaseRequestContracts.list.input, async (ctx, query, req) => {
      const projectId = requireProjectId(req)
      await requirePermission(ctx, Permission.TRANSACTION_VIEW, {
        projectId,
        userId: ctx.userId,
      })
      const onlyOwn = await shouldSeeOnlyOwnRequests(ctx, projectId)
      return ok(
        await listPurchaseRequestsForProject(ctx, projectId, {
          page: query.page,
          pageSize: query.pageSize,
          requestedBy: onlyOwn ? ctx.userId : undefined,
        }),
      )
    }),
  ),
)

/** POST /api/projects/:id/requests — `payment.make`; always creates DRAFT. */
export const POST = withRouteParams(
  withAuth(
    withValidation(purchaseRequestContracts.create.input, async (ctx, input, req) => {
      const projectId = requireProjectId(req)
      await requirePermission(ctx, Permission.PAYMENT_MAKE, {
        projectId,
        userId: ctx.userId,
      })
      return created(await createPurchaseRequest(ctx, projectId, input))
    }),
  ),
)
