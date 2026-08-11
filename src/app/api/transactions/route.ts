import { transactionContracts } from '@/shared/contracts/transaction'
import { ok } from '@/server/http/respond'
import { requirePermission } from '@/server/http/requirePermission'
import { withAuth } from '@/server/http/withAuth'
import { withValidation } from '@/server/http/withValidation'
import { listTransactions } from '@/server/repositories/transactions'
import { connectDb } from '@/server/db/connect'
import { Permission } from '@/shared/enums/permissions'

/** GET /api/transactions — `transaction.view` scoped. Org-wide list. */
export const GET = withAuth(
  withValidation(transactionContracts.list.input, async (ctx, query) => {
    await requirePermission(ctx, Permission.TRANSACTION_VIEW, {
      projectId: query.projectId,
    })
    await connectDb()
    const result = await listTransactions(ctx, {
      cardId: query.cardId,
      projectId: query.projectId,
      status: query.status,
      from: query.from ? new Date(query.from) : undefined,
      to: query.to ? new Date(query.to) : undefined,
      page: query.page,
      pageSize: query.pageSize,
    })
    return ok(result)
  }),
)
