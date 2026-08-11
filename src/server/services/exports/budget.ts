/**
 * Budget ledger CSV export (`POST /api/exports/budget`).
 * Amounts are integer minor units under `amount_minor`.
 */
import type { OrgContext } from '@/server/http/types'
import { iterateEntries } from '@/server/repositories/budgetEntries'
import { audit } from '@/server/services/audit/log'
import { csvResponse, resolveExportScope } from '@/server/services/exports/access'
import { rowsToCsvStream, type CsvRow } from '@/server/services/exports/csv'
import type { ExportInput } from '@/shared/types/export'

const HEADERS = [
  'id',
  'projectId',
  'type',
  'amount_minor',
  'currency',
  'sourceType',
  'sourceId',
  'categoryId',
  'lifecycleId',
  'createdBy',
  'note',
  'createdAt',
] as const

async function* budgetRows(
  ctx: OrgContext,
  scope: Awaited<ReturnType<typeof resolveExportScope>>,
): AsyncGenerator<CsvRow, void, unknown> {
  const filter =
    scope.projectId !== undefined
      ? { projectId: scope.projectId, from: scope.from, to: scope.to }
      : { projectIds: scope.projectIds, from: scope.from, to: scope.to }

  for await (const entry of iterateEntries(ctx, filter)) {
    yield [
      entry.id,
      entry.projectId,
      entry.type,
      entry.amount,
      entry.currency,
      entry.sourceType,
      entry.sourceId,
      entry.categoryId,
      entry.lifecycleId,
      entry.createdBy,
      entry.note,
      entry.createdAt,
    ]
  }
}

export async function exportBudgetCsv(ctx: OrgContext, input: ExportInput): Promise<Response> {
  const scope = await resolveExportScope(ctx, input)
  const stream = rowsToCsvStream(HEADERS, budgetRows(ctx, scope), {
    onComplete: async (rowCount) => {
      await audit(ctx, {
        action: 'export.budget',
        subjectType: 'export',
        subjectId: 'budget',
        projectId: input.projectId,
        metadata: {
          rowCount,
          ...(input.projectId !== undefined ? { projectId: input.projectId } : {}),
          ...(input.from !== undefined ? { from: input.from } : {}),
          ...(input.to !== undefined ? { to: input.to } : {}),
        },
      })
    },
  })
  return csvResponse('budget.csv', stream)
}
