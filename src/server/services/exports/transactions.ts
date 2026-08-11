/**
 * Transactions CSV export (`POST /api/exports/transactions`).
 * Amounts are integer minor units under `amount_minor` / `billing_amount_minor`.
 */
import type { OrgContext } from '@/server/http/types'
import { iterateTransactions } from '@/server/repositories/transactions'
import { audit } from '@/server/services/audit/log'
import { csvResponse, resolveExportScope } from '@/server/services/exports/access'
import { rowsToCsvStream, type CsvRow } from '@/server/services/exports/csv'
import type { ExportInput } from '@/shared/types/export'

const HEADERS = [
  'id',
  'projectId',
  'cardId',
  'type',
  'status',
  'amount_minor',
  'currency',
  'billing_amount_minor',
  'billingCurrency',
  'merchantName',
  'merchantMcc',
  'merchantCountry',
  'failureReason',
  'transactedAt',
] as const

async function* transactionRows(
  ctx: OrgContext,
  scope: Awaited<ReturnType<typeof resolveExportScope>>,
): AsyncGenerator<CsvRow, void, unknown> {
  const filter =
    scope.projectId !== undefined
      ? { projectId: scope.projectId, from: scope.from, to: scope.to }
      : { projectIds: scope.projectIds, from: scope.from, to: scope.to }

  for await (const tx of iterateTransactions(ctx, filter)) {
    yield [
      tx.id,
      tx.projectId,
      tx.cardId,
      tx.type,
      tx.status,
      tx.amount,
      tx.currency,
      tx.billingAmount,
      tx.billingCurrency,
      tx.merchant.name,
      tx.merchant.mcc,
      tx.merchant.country,
      tx.failureReason,
      tx.transactedAt,
    ]
  }
}

export async function exportTransactionsCsv(
  ctx: OrgContext,
  input: ExportInput,
): Promise<Response> {
  const scope = await resolveExportScope(ctx, input)
  const stream = rowsToCsvStream(HEADERS, transactionRows(ctx, scope), {
    onComplete: async (rowCount) => {
      await audit(ctx, {
        action: 'export.transactions',
        subjectType: 'export',
        subjectId: 'transactions',
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
  return csvResponse('transactions.csv', stream)
}
