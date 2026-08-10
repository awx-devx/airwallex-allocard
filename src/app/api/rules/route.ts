import { ruleContracts } from '@/shared/contracts/rule'
import { created, ok } from '@/server/http/respond'
import { requirePermission } from '@/server/http/requirePermission'
import { withAuth } from '@/server/http/withAuth'
import { withValidation } from '@/server/http/withValidation'
import { createRuleForOrg, listRulesForOrg } from '@/server/services/rules/mutate'
import { Permission } from '@/shared/enums/permissions'

/** List rules — `control.edit`. */
export const GET = withAuth(
  withValidation(ruleContracts.list.input, async (ctx, query) => {
    await requirePermission(ctx, Permission.CONTROL_EDIT)
    return ok(await listRulesForOrg(ctx, query))
  }),
)

/** Create a rule — `control.edit`. Defaults to disabled. */
export const POST = withAuth(
  withValidation(ruleContracts.create.input, async (ctx, input) => {
    await requirePermission(ctx, Permission.CONTROL_EDIT)
    return created(await createRuleForOrg(ctx, input))
  }),
)
