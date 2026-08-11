import { transactionContracts } from '@/shared/contracts/transaction'
import { AppError } from '@/server/http/errors'
import { ok } from '@/server/http/respond'
import { requirePermission } from '@/server/http/requirePermission'
import { getRouteParams, withRouteParams } from '@/server/http/routeParams'
import { withAuth } from '@/server/http/withAuth'
import { withValidation } from '@/server/http/withValidation'
import { findProjectById } from '@/server/repositories/projects'
import { listTransactions } from '@/server/repositories/transactions'
import { connectDb } from '@/server/db/connect'
import { Permission } from '@/shared/enums/permissions'

function requireProjectId(req: Request): string {
  const { id } = getRouteParams(req)
  if (!id) {
    throw AppError.notFound()
  }
  return id
}

/** GET /api/projects/:id/transactions — `transaction.view` scoped to project. */
export const GET = withRouteParams(
  withAuth(
    withValidation(transactionContracts.listForProject.input, async (ctx, query, req) => {
      const projectId = requireProjectId(req)
      await connectDb()
      const project = await findProjectById(ctx, projectId)
      if (!project) {
        throw AppError.notFound()
      }
      await requirePermission(ctx, Permission.TRANSACTION_VIEW, { projectId })
      const result = await listTransactions(ctx, {
        projectId,
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
