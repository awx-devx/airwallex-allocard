import { budgetContracts } from '@/shared/contracts/budget'
import { AppError } from '@/server/http/errors'
import { created, ok } from '@/server/http/respond'
import { requirePermission } from '@/server/http/requirePermission'
import { getRouteParams, withRouteParams } from '@/server/http/routeParams'
import { withAuth } from '@/server/http/withAuth'
import { withValidation } from '@/server/http/withValidation'
import { createManualBudgetAdjustment, listBudgetEntries } from '@/server/services/budget/entries'
import { Permission } from '@/shared/enums/permissions'

function requireProjectId(req: Request): string {
  const { id } = getRouteParams(req)
  if (!id) {
    throw AppError.notFound()
  }
  return id
}

/** List entries — `budget.view`. */
export const GET = withRouteParams(
  withAuth(
    withValidation(budgetContracts.listEntries.input, async (ctx, query, req) => {
      const projectId = requireProjectId(req)
      await requirePermission(ctx, Permission.BUDGET_VIEW, { projectId })
      return ok(await listBudgetEntries(ctx, projectId, query))
    }),
  ),
)

/** Manual ADJUSTMENT only — `budget.edit`. */
export const POST = withRouteParams(
  withAuth(
    withValidation(budgetContracts.createEntry.input, async (ctx, input, req) => {
      const projectId = requireProjectId(req)
      await requirePermission(ctx, Permission.BUDGET_EDIT, { projectId })
      return created(await createManualBudgetAdjustment(ctx, projectId, input))
    }),
  ),
)
