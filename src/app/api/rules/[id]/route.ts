import { ruleContracts } from '@/shared/contracts/rule'
import { AppError } from '@/server/http/errors'
import { noContent, ok } from '@/server/http/respond'
import { requirePermission } from '@/server/http/requirePermission'
import { getRouteParams, withRouteParams } from '@/server/http/routeParams'
import { withAuth } from '@/server/http/withAuth'
import { withValidation } from '@/server/http/withValidation'
import { deleteRuleForOrg, updateRuleForOrg } from '@/server/services/rules/mutate'
import { Permission } from '@/shared/enums/permissions'

function requireRuleId(req: Request): string {
  const { id } = getRouteParams(req)
  if (!id) {
    throw AppError.notFound()
  }
  return id
}

/** Update a rule — `control.edit`. Bumps `version`. */
export const PATCH = withRouteParams(
  withAuth(
    withValidation(ruleContracts.update.input, async (ctx, input, req) => {
      await requirePermission(ctx, Permission.CONTROL_EDIT)
      return ok(await updateRuleForOrg(ctx, requireRuleId(req), input))
    }),
  ),
)

/** Delete a rule — `control.edit`. */
export const DELETE = withRouteParams(
  withAuth(async (ctx, req) => {
    await requirePermission(ctx, Permission.CONTROL_EDIT)
    await deleteRuleForOrg(ctx, requireRuleId(req))
    return noContent()
  }),
)
