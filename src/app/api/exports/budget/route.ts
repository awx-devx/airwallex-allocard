import { exportContracts } from '@/shared/contracts/export'
import { withAuth } from '@/server/http/withAuth'
import { withValidation } from '@/server/http/withValidation'
import { exportBudgetCsv } from '@/server/services/exports/budget'

/**
 * POST /api/exports/budget — streams `text/csv` (`report.export`).
 * Contract output is `z.void()`; response body is a ReadableStream, not JSON.
 */
export const POST = withAuth(
  withValidation(exportContracts.budget.input, async (ctx, input) => {
    return exportBudgetCsv(ctx, input)
  }),
)
