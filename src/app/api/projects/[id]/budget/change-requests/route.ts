import { budgetContracts } from '@/shared/contracts/budget'
import { AppError } from '@/server/http/errors'
import { created, ok } from '@/server/http/respond'
import { requirePermission } from '@/server/http/requirePermission'
import { getRouteParams, withRouteParams } from '@/server/http/routeParams'
import { withAuth } from '@/server/http/withAuth'
import { withValidation } from '@/server/http/withValidation'
import {
  createBudgetChangeRequest,
  listBudgetChangeRequests,
} from '@/server/services/budget/changeRequests'
import { Permission } from '@/shared/enums/permissions'

function requireProjectId(req: Request): string {
  const { id } = getRouteParams(req)
  if (!id) {
    throw AppError.notFound()
  }
  return id
}

/** List change requests — `budget.view`. */
export const GET = withRouteParams(
  withAuth(async (ctx, req) => {
    const projectId = requireProjectId(req)
    await requirePermission(ctx, Permission.BUDGET_VIEW, { projectId })
    return ok(await listBudgetChangeRequests(ctx, projectId))
  }),
)

/** Create change request — `budget.request`. */
export const POST = withRouteParams(
  withAuth(
    withValidation(budgetContracts.createChangeRequest.input, async (ctx, input, req) => {
      const projectId = requireProjectId(req)
      await requirePermission(ctx, Permission.BUDGET_REQUEST, { projectId })
      return created(await createBudgetChangeRequest(ctx, projectId, input))
    }),
  ),
)
