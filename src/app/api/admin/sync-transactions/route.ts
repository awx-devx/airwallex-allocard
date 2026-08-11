import { AppError } from '@/server/http/errors'
import { noContent } from '@/server/http/respond'
import { loadServerEnv } from '@/server/env'
import { withAuth } from '@/server/http/withAuth'
import { syncTransactions } from '@/server/services/transactions/sync'
import { OrgRole } from '@/shared/enums/orgRole'

const ADMIN_SECRET_HEADER = 'x-allocard-admin-secret'

/**
 * POST /api/admin/sync-transactions — OWNER + ADMIN_JOB_SECRET.
 * Triggers the sync backstop manually. Idempotent with the worker scheduled job.
 */
export const POST = withAuth(async (ctx, req) => {
  if (ctx.orgRole !== OrgRole.OWNER) {
    throw AppError.permissionDenied('OWNER')
  }
  const env = loadServerEnv()
  const secret = req.headers.get(ADMIN_SECRET_HEADER)
  if (!env.ADMIN_JOB_SECRET || secret !== env.ADMIN_JOB_SECRET) {
    throw AppError.permissionDenied('admin-secret')
  }
  await syncTransactions()
  return noContent()
})
