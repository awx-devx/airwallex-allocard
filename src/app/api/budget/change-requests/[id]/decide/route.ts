import { budgetContracts } from '@/shared/contracts/budget'
import { connectDb } from '@/server/db/connect'
import { AppError } from '@/server/http/errors'
import { ok } from '@/server/http/respond'
import { requirePermission } from '@/server/http/requirePermission'
import { getRouteParams, withRouteParams } from '@/server/http/routeParams'
import { withAuth } from '@/server/http/withAuth'
import { withValidation } from '@/server/http/withValidation'
import { findChangeRequestById } from '@/server/repositories/budgetChangeRequests'
import { decideBudgetChangeRequest } from '@/server/services/budget/changeRequests'
import { Permission } from '@/shared/enums/permissions'

function requireRequestId(req: Request): string {
  const { id } = getRouteParams(req)
  if (!id) {
    throw AppError.notFound()
  }
  return id
}

/** Decide change request — `budget.edit` on the request's project. */
export const POST = withRouteParams(
  withAuth(
    withValidation(budgetContracts.decideChangeRequest.input, async (ctx, input, req) => {
      const requestId = requireRequestId(req)
      await connectDb()
      const existing = await findChangeRequestById(ctx, requestId)
      if (!existing) {
        throw AppError.notFound()
      }
      await requirePermission(ctx, Permission.BUDGET_EDIT, { projectId: existing.projectId })
      return ok(await decideBudgetChangeRequest(ctx, requestId, input))
    }),
  ),
)
