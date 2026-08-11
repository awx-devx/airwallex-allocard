import { exportContracts } from '@/shared/contracts/export'
import { withAuth } from '@/server/http/withAuth'
import { withValidation } from '@/server/http/withValidation'
import { exportTransactionsCsv } from '@/server/services/exports/transactions'

/**
 * POST /api/exports/transactions — streams `text/csv` (`report.export`).
 * Contract output is `z.void()`; response body is a ReadableStream, not JSON.
 */
export const POST = withAuth(
  withValidation(exportContracts.transactions.input, async (ctx, input) => {
    return exportTransactionsCsv(ctx, input)
  }),
)
