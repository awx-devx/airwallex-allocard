import { ok } from '@/server/http/respond'
import { requirePermission } from '@/server/http/requirePermission'
import { withAuth } from '@/server/http/withAuth'
import { getOrganizationReport } from '@/server/services/reports/organization'
import { Permission } from '@/shared/enums/permissions'

/** GET /api/reports/organization — org rollup (`report.export`). */
export const GET = withAuth(async (ctx) => {
  await requirePermission(ctx, Permission.REPORT_EXPORT)
  return ok(await getOrganizationReport(ctx))
})
