import { exportContracts } from '@/shared/contracts/export'
import { withAuth } from '@/server/http/withAuth'
import { withValidation } from '@/server/http/withValidation'
import { exportAuditCsv } from '@/server/services/exports/audit'

/**
 * POST /api/exports/audit — streams `text/csv` (`report.export`).
 * Contract output is `z.void()`; response body is a ReadableStream, not JSON.
 */
export const POST = withAuth(
  withValidation(exportContracts.audit.input, async (ctx, input) => {
    return exportAuditCsv(ctx, input)
  }),
)
