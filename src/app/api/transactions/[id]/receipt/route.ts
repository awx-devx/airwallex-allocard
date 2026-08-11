import { transactionContracts } from '@/shared/contracts/transaction'
import { AppError } from '@/server/http/errors'
import { noContent, ok } from '@/server/http/respond'
import { requirePermission } from '@/server/http/requirePermission'
import { getRouteParams, withRouteParams } from '@/server/http/routeParams'
import { withAuth } from '@/server/http/withAuth'
import { withValidation } from '@/server/http/withValidation'
import { findTransactionById } from '@/server/repositories/transactions'
import { connectDb } from '@/server/db/connect'
import { uploadReceipt, deleteReceipt } from '@/server/services/transactions/receipts'
import { Permission } from '@/shared/enums/permissions'

function requireTransactionId(req: Request): string {
  const { id } = getRouteParams(req)
  if (!id) {
    throw AppError.notFound()
  }
  return id
}

/** POST /api/transactions/:id/receipt — `transaction.view` (attach receipt). */
export const POST = withRouteParams(
  withAuth(
    withValidation(transactionContracts.uploadReceipt.input, async (ctx, input, req) => {
      const transactionId = requireTransactionId(req)
      await connectDb()
      const transaction = await findTransactionById(ctx, transactionId)
      if (!transaction) {
        throw AppError.notFound()
      }
      await requirePermission(ctx, Permission.TRANSACTION_VIEW, {
        projectId: transaction.projectId,
      })
      const updated = await uploadReceipt(ctx, transactionId, input)
      return ok(updated)
    }),
  ),
)

/** DELETE /api/transactions/:id/receipt — `transaction.view` (detach receipt). */
export const DELETE = withRouteParams(
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
    await deleteReceipt(ctx, transactionId)
    return noContent()
  }),
)
