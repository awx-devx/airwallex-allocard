import { purchaseRequestContracts } from '@/shared/contracts/purchaseRequest'
import { ok } from '@/server/http/respond'
import { withAuth } from '@/server/http/withAuth'
import { withValidation } from '@/server/http/withValidation'
import { listApprovalsQueue } from '@/server/services/approvals/queue'

/**
 * GET /api/approvals — approver queue across projects (`request.approve`).
 * Permission + project filter enforced in the service (REQUEST_APPROVE is not org-wide via membership).
 */
export const GET = withAuth(
  withValidation(purchaseRequestContracts.listApprovals.input, async (ctx, query) => {
    return ok(await listApprovalsQueue(ctx, query))
  }),
)
