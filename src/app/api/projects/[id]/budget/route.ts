import { budgetContracts } from '@/shared/contracts/budget'
import { AppError } from '@/server/http/errors'
import { ok } from '@/server/http/respond'
import { requirePermission } from '@/server/http/requirePermission'
import { getRouteParams, withRouteParams } from '@/server/http/routeParams'
import { withAuth } from '@/server/http/withAuth'
import { withValidation } from '@/server/http/withValidation'
import { getProjectBudget } from '@/server/services/budget/get'
import { putProjectBudget } from '@/server/services/budget/put'
import { Permission } from '@/shared/enums/permissions'

function requireProjectId(req: Request): string {
  const { id } = getRouteParams(req)
  if (!id) {
    throw AppError.notFound()
  }
  return id
}

/** GET project budget — `budget.view`. Cross-org / missing project → 404. */
export const GET = withRouteParams(
  withAuth(async (ctx, req) => {
    const projectId = requireProjectId(req)
    await requirePermission(ctx, Permission.BUDGET_VIEW, { projectId })
    return ok(await getProjectBudget(ctx, projectId))
  }),
)

/** PUT project budget — `budget.edit`. Upserts header and appends ledger entry. */
export const PUT = withRouteParams(
  withAuth(
    withValidation(budgetContracts.put.input, async (ctx, input, req) => {
      const projectId = requireProjectId(req)
      await requirePermission(ctx, Permission.BUDGET_EDIT, { projectId })
      return ok(await putProjectBudget(ctx, projectId, input))
    }),
  ),
)
