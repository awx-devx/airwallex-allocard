/**
 * Cards CSV export (`POST /api/exports/cards`).
 * No PAN — maskedNumber only. No amount columns (N/A).
 */
import type { OrgContext } from '@/server/http/types'
import { iterateCards } from '@/server/repositories/cards'
import { audit } from '@/server/services/audit/log'
import { csvResponse, resolveExportScope } from '@/server/services/exports/access'
import { rowsToCsvStream, type CsvRow } from '@/server/services/exports/csv'
import type { ExportInput } from '@/shared/types/export'

const HEADERS = [
  'id',
  'projectId',
  'cardholderId',
  'nickName',
  'maskedNumber',
  'purpose',
  'status',
  'createdAt',
  'updatedAt',
] as const

async function* cardRows(
  ctx: OrgContext,
  scope: Awaited<ReturnType<typeof resolveExportScope>>,
): AsyncGenerator<CsvRow, void, unknown> {
  const filter =
    scope.projectId !== undefined
      ? { projectId: scope.projectId, from: scope.from, to: scope.to }
      : { projectIds: scope.projectIds, from: scope.from, to: scope.to }

  for await (const card of iterateCards(ctx, filter)) {
    yield [
      card.id,
      card.projectId,
      card.cardholderId,
      card.nickName,
      card.maskedNumber,
      card.purpose,
      card.status,
      card.createdAt,
      card.updatedAt,
    ]
  }
}

export async function exportCardsCsv(ctx: OrgContext, input: ExportInput): Promise<Response> {
  const scope = await resolveExportScope(ctx, input)
  const stream = rowsToCsvStream(HEADERS, cardRows(ctx, scope), {
    onComplete: async (rowCount) => {
      await audit(ctx, {
        action: 'export.cards',
        subjectType: 'export',
        subjectId: 'cards',
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
  return csvResponse('cards.csv', stream)
}
