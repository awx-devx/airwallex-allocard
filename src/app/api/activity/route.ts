import { activityContracts } from '@/shared/contracts/activity'
import { ok } from '@/server/http/respond'
import { withAuth } from '@/server/http/withAuth'
import { withValidation } from '@/server/http/withValidation'
import { listActivity } from '@/server/services/activity/feed'

/**
 * GET /api/activity — org-wide unified feed (`transaction.view` via project membership).
 * Permission enforced inside the service (TRANSACTION_VIEW is not org-wide via membership).
 */
export const GET = withAuth(
  withValidation(activityContracts.list.input, async (ctx, query) => {
    return ok(await listActivity(ctx, query))
  }),
)
