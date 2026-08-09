import { budgetContracts } from '@/shared/contracts/budget'
import { AppError } from '@/server/http/errors'
import { noContent, ok } from '@/server/http/respond'
import { requirePermission } from '@/server/http/requirePermission'
import { getRouteParams, withRouteParams } from '@/server/http/routeParams'
import { withAuth } from '@/server/http/withAuth'
import { withValidation } from '@/server/http/withValidation'
import { deleteBudgetCategory, updateBudgetCategory } from '@/server/services/budget/categories'
import { Permission } from '@/shared/enums/permissions'

function requireIds(req: Request): { projectId: string; catId: string } {
  const { id, catId } = getRouteParams(req)
  if (!id || !catId) {
    throw AppError.notFound()
  }
  return { projectId: id, catId }
}

/** Update category — `budget.edit`. */
export const PATCH = withRouteParams(
  withAuth(
    withValidation(budgetContracts.updateCategory.input, async (ctx, input, req) => {
      const { projectId, catId } = requireIds(req)
      await requirePermission(ctx, Permission.BUDGET_EDIT, { projectId })
      return ok(await updateBudgetCategory(ctx, projectId, catId, input))
    }),
  ),
)

/** Delete category — `budget.edit`. Conflict if entries reference it. */
export const DELETE = withRouteParams(
  withAuth(async (ctx, req) => {
    const { projectId, catId } = requireIds(req)
    await requirePermission(ctx, Permission.BUDGET_EDIT, { projectId })
    await deleteBudgetCategory(ctx, projectId, catId)
    return noContent()
  }),
)
