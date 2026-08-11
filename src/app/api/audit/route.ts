import { auditContracts } from '@/shared/contracts/audit'
import { ok } from '@/server/http/respond'
import { requirePermission } from '@/server/http/requirePermission'
import { withAuth } from '@/server/http/withAuth'
import { withValidation } from '@/server/http/withValidation'
import { listAudit } from '@/server/services/audit/query'
import { Permission } from '@/shared/enums/permissions'

/**
 * GET /api/audit — filterable audit list (`member.manage`).
 * OWNER/ADMIN short-circuit; MEMBER needs MEMBER_MANAGE via project membership.
 */
export const GET = withAuth(
  withValidation(auditContracts.list.input, async (ctx, query) => {
    await requirePermission(ctx, Permission.MEMBER_MANAGE)
    return ok(await listAudit(ctx, query))
  }),
)
