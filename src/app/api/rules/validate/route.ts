import { ruleContracts } from '@/shared/contracts/rule'
import { ok } from '@/server/http/respond'
import { requirePermission } from '@/server/http/requirePermission'
import { withAuth } from '@/server/http/withAuth'
import { withValidation } from '@/server/http/withValidation'
import { validateRuleDsl } from '@/server/services/rules/mutate'
import { Permission } from '@/shared/enums/permissions'

/** Validate rule DSL for the builder — `control.edit`. Never writes. */
export const POST = withAuth(
  withValidation(ruleContracts.validate.input, async (ctx, input) => {
    await requirePermission(ctx, Permission.CONTROL_EDIT)
    return ok(validateRuleDsl(input))
  }),
)
