import { exportContracts } from '@/shared/contracts/export'
import { withAuth } from '@/server/http/withAuth'
import { withValidation } from '@/server/http/withValidation'
import { exportCardsCsv } from '@/server/services/exports/cards'

/**
 * POST /api/exports/cards — streams `text/csv` (`report.export`).
 * Contract output is `z.void()`; response body is a ReadableStream, not JSON.
 */
export const POST = withAuth(
  withValidation(exportContracts.cards.input, async (ctx, input) => {
    return exportCardsCsv(ctx, input)
  }),
)
