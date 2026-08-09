import { budgetContracts } from '@/shared/contracts/budget'
import { AppError } from '@/server/http/errors'
import { created, ok } from '@/server/http/respond'
import { requirePermission } from '@/server/http/requirePermission'
import { getRouteParams, withRouteParams } from '@/server/http/routeParams'
import { withAuth } from '@/server/http/withAuth'
import { withValidation } from '@/server/http/withValidation'
import { createBudgetCategory, listBudgetCategories } from '@/server/services/budget/categories'
import { Permission } from '@/shared/enums/permissions'

function requireProjectId(req: Request): string {
  const { id } = getRouteParams(req)
  if (!id) {
    throw AppError.notFound()
  }
  return id
}

/** List categories — `budget.view`. */
export const GET = withRouteParams(
  withAuth(async (ctx, req) => {
    const projectId = requireProjectId(req)
    await requirePermission(ctx, Permission.BUDGET_VIEW, { projectId })
    return ok(await listBudgetCategories(ctx, projectId))
  }),
)

/** Create category — `budget.edit`. */
export const POST = withRouteParams(
  withAuth(
    withValidation(budgetContracts.createCategory.input, async (ctx, input, req) => {
      const projectId = requireProjectId(req)
      await requirePermission(ctx, Permission.BUDGET_EDIT, { projectId })
      return created(await createBudgetCategory(ctx, projectId, input))
    }),
  ),
)
