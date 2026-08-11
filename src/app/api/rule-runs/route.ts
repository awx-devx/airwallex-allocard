import { ruleRunContracts } from '@/shared/contracts/ruleRun'
import { ok } from '@/server/http/respond'
import { requirePermission } from '@/server/http/requirePermission'
import { withAuth } from '@/server/http/withAuth'
import { withValidation } from '@/server/http/withValidation'
import { listRuleRunsForOrg } from '@/server/services/rules/explain'
import { Permission } from '@/shared/enums/permissions'

/** List rule runs — `control.edit`. */
export const GET = withAuth(
  withValidation(ruleRunContracts.list.input, async (ctx, query) => {
    await requirePermission(ctx, Permission.CONTROL_EDIT)
    return ok(await listRuleRunsForOrg(ctx, query))
  }),
)
