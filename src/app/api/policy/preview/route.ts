import { purchaseRequestContracts } from '@/shared/contracts/purchaseRequest'
import { ok } from '@/server/http/respond'
import { requirePermission } from '@/server/http/requirePermission'
import { withAuth } from '@/server/http/withAuth'
import { withValidation } from '@/server/http/withValidation'
import { previewPolicy } from '@/server/services/approvals/requests'
import { Permission } from '@/shared/enums/permissions'

/**
 * POST /api/policy/preview — authenticated + project `transaction.view`.
 * Same evaluation path as submit.
 */
export const POST = withAuth(
  withValidation(purchaseRequestContracts.policyPreview.input, async (ctx, input) => {
    await requirePermission(ctx, Permission.TRANSACTION_VIEW, {
      projectId: input.projectId,
      userId: ctx.userId,
    })
    return ok(await previewPolicy(ctx, input))
  }),
)
