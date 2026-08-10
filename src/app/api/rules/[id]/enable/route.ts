import { ruleContracts } from '@/shared/contracts/rule'
import { AppError } from '@/server/http/errors'
import { ok } from '@/server/http/respond'
import { requirePermission } from '@/server/http/requirePermission'
import { getRouteParams, withRouteParams } from '@/server/http/routeParams'
import { withAuth } from '@/server/http/withAuth'
import { withValidation } from '@/server/http/withValidation'
import { enableRuleForOrg } from '@/server/services/rules/mutate'
import { Permission } from '@/shared/enums/permissions'

function requireRuleId(req: Request): string {
  const { id } = getRouteParams(req)
  if (!id) {
    throw AppError.notFound()
  }
  return id
}

/** Enable or disable a rule — `control.edit`. Does not bump `version`. */
export const POST = withRouteParams(
  withAuth(
    withValidation(ruleContracts.enable.input, async (ctx, input, req) => {
      await requirePermission(ctx, Permission.CONTROL_EDIT)
      return ok(await enableRuleForOrg(ctx, requireRuleId(req), input))
    }),
  ),
)
