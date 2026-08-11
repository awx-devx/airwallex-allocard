import { AppError } from '@/server/http/errors'
import { ok } from '@/server/http/respond'
import { requirePermission } from '@/server/http/requirePermission'
import { getRouteParams, withRouteParams } from '@/server/http/routeParams'
import { withAuth } from '@/server/http/withAuth'
import { findTransactionById, findByLifecycleId } from '@/server/repositories/transactions'
import { connectDb } from '@/server/db/connect'
import { Permission } from '@/shared/enums/permissions'
import type { TransactionDetail } from '@/shared/types/transaction'

function requireTransactionId(req: Request): string {
  const { id } = getRouteParams(req)
  if (!id) {
    throw AppError.notFound()
  }
  return id
}

/** GET /api/transactions/:id — `transaction.view`; includes lifecycleEvents. */
export const GET = withRouteParams(
  withAuth(async (ctx, req) => {
    const transactionId = requireTransactionId(req)
    await connectDb()
    const transaction = await findTransactionById(ctx, transactionId)
    if (!transaction) {
      throw AppError.notFound()
    }
    await requirePermission(ctx, Permission.TRANSACTION_VIEW, {
      projectId: transaction.projectId,
    })
    const lifecycleEvents = await findByLifecycleId(ctx, transaction.lifecycleId)
    const detail: TransactionDetail = {
      ...transaction,
      lifecycleEvents,
    }
    return ok(detail)
  }),
)
