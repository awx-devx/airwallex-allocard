import { budgetContracts } from '@/shared/contracts/budget'
import { ok } from '@/server/http/respond'
import { requirePermission } from '@/server/http/requirePermission'
import { withAuth } from '@/server/http/withAuth'
import { withValidation } from '@/server/http/withValidation'
import { validateBudgetFormula } from '@/server/services/budget/validateFormula'
import { Permission } from '@/shared/enums/permissions'

/** Dry-evaluate a formula — `budget.edit` (org-wide via membership). */
export const POST = withAuth(
  withValidation(budgetContracts.validateFormula.input, async (ctx, input) => {
    await requirePermission(ctx, Permission.BUDGET_EDIT)
    return ok(validateBudgetFormula(input))
  }),
)
