import { ok } from '@/server/http/respond'
import { withAuth } from '@/server/http/withAuth'
import { countApprovalsQueue } from '@/server/services/approvals/queue'

/**
 * GET /api/approvals/count — shell badge count (`request.approve`).
 * Same filter as GET /api/approvals.
 */
export const GET = withAuth(async (ctx) => {
  return ok(await countApprovalsQueue(ctx))
})
