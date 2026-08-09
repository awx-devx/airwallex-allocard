import { AppError } from '@/server/http/errors'
import { ok } from '@/server/http/respond'
import { requirePermission } from '@/server/http/requirePermission'
import { getRouteParams, withRouteParams } from '@/server/http/routeParams'
import { withAuth } from '@/server/http/withAuth'
import { getBudgetHistory } from '@/server/services/budget/history'
import { Permission } from '@/shared/enums/permissions'

function requireProjectId(req: Request): string {
  const { id } = getRouteParams(req)
  if (!id) {
    throw AppError.notFound()
  }
  return id
}

/** Budget audit history — `budget.view`. */
export const GET = withRouteParams(
  withAuth(async (ctx, req) => {
    const projectId = requireProjectId(req)
    await requirePermission(ctx, Permission.BUDGET_VIEW, { projectId })
    return ok(await getBudgetHistory(ctx, projectId))
  }),
)
