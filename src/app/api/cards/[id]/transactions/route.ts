import { transactionContracts } from '@/shared/contracts/transaction'
import { AppError } from '@/server/http/errors'
import { ok } from '@/server/http/respond'
import { requirePermission } from '@/server/http/requirePermission'
import { getRouteParams, withRouteParams } from '@/server/http/routeParams'
import { withAuth } from '@/server/http/withAuth'
import { withValidation } from '@/server/http/withValidation'
import { findCardById } from '@/server/repositories/cards'
import { listTransactions } from '@/server/repositories/transactions'
import { connectDb } from '@/server/db/connect'
import { permissionSubjectForCard } from '@/server/services/cards/subject'
import { Permission } from '@/shared/enums/permissions'

function requireCardId(req: Request): string {
  const { id } = getRouteParams(req)
  if (!id) {
    throw AppError.notFound()
  }
  return id
}

/** GET /api/cards/:id/transactions — `transaction.view` scoped to card. */
export const GET = withRouteParams(
  withAuth(
    withValidation(transactionContracts.listForCard.input, async (ctx, query, req) => {
      const cardId = requireCardId(req)
      await connectDb()
      const card = await findCardById(ctx, cardId)
      if (!card) {
        throw AppError.notFound()
      }
      await requirePermission(ctx, Permission.TRANSACTION_VIEW, permissionSubjectForCard(ctx, card))
      const result = await listTransactions(ctx, {
        cardId,
        status: query.status,
        from: query.from ? new Date(query.from) : undefined,
        to: query.to ? new Date(query.to) : undefined,
        page: query.page,
        pageSize: query.pageSize,
      })
      return ok(result)
    }),
  ),
)
