import { ruleContracts } from '@/shared/contracts/rule'
import { ok } from '@/server/http/respond'
import { requirePermission } from '@/server/http/requirePermission'
import { withAuth } from '@/server/http/withAuth'
import { withValidation } from '@/server/http/withValidation'
import { simulateRules } from '@/server/services/rules/simulate'
import { Permission } from '@/shared/enums/permissions'

/** Dry-run the pipeline — `control.edit`. Zero writes. */
export const POST = withAuth(
  withValidation(ruleContracts.simulate.input, async (ctx, input) => {
    await requirePermission(ctx, Permission.CONTROL_EDIT)
    const result = await simulateRules(ctx, {
      ...(input.ruleIds !== undefined ? { ruleIds: input.ruleIds } : {}),
      ...(input.projectId !== undefined ? { projectId: input.projectId } : {}),
      ...(input.draftRule !== undefined ? { draftRule: input.draftRule } : {}),
      ...(input.attributeOverrides !== undefined
        ? { attributeOverrides: input.attributeOverrides }
        : {}),
    })
    return ok({
      runs: result.runs,
      cardDiffs: result.cardDiffs,
      conflicts: result.conflicts,
    })
  }),
)
