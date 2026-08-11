import { withAuth } from '@/server/http/withAuth'
import { withValidation } from '@/server/http/withValidation'
import { ok } from '@/server/http/respond'
import { AppError } from '@/server/http/errors'
import { loadServerEnv } from '@/server/env'
import { OrgRole } from '@/shared/enums/orgRole'
import { remoteAuthContracts } from '@/shared/contracts/remoteAuth'
import { simulatePurchase } from '@/server/services/remoteAuth/simulate'

const SIMULATE_SECRET_HEADER = 'x-allocard-admin-secret'

/**
 * POST /api/simulate/purchase — demo synthetic authorization.
 * Requires OWNER + ADMIN_JOB_SECRET (or REMOTE_AUTH_MODE=simulate with OWNER).
 */
export const POST = withAuth(
  withValidation(remoteAuthContracts.simulatePurchase.input, async (ctx, input, req) => {
    const env = loadServerEnv()
    if (ctx.orgRole !== OrgRole.OWNER) {
      throw AppError.permissionDenied('OWNER')
    }
    if (env.REMOTE_AUTH_MODE !== 'simulate') {
      const secret = req.headers.get(SIMULATE_SECRET_HEADER)
      if (!env.ADMIN_JOB_SECRET || secret !== env.ADMIN_JOB_SECRET) {
        throw AppError.permissionDenied('simulate')
      }
    }
    return ok(await simulatePurchase(input))
  }),
)
