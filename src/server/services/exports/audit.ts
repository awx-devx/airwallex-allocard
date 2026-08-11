/**
 * Audit log CSV export (`POST /api/exports/audit`).
 */
import type { OrgContext } from '@/server/http/types'
import { iterateAuditLogs } from '@/server/repositories/auditLogs'
import { audit } from '@/server/services/audit/log'
import { csvResponse, resolveExportScope } from '@/server/services/exports/access'
import { rowsToCsvStream, type CsvRow } from '@/server/services/exports/csv'
import type { ExportInput } from '@/shared/types/export'

const HEADERS = [
  'id',
  'projectId',
  'actorType',
  'actorId',
  'action',
  'subjectType',
  'subjectId',
  'at',
] as const

async function* auditRows(
  ctx: OrgContext,
  scope: Awaited<ReturnType<typeof resolveExportScope>>,
): AsyncGenerator<CsvRow, void, unknown> {
  const filter =
    scope.projectId !== undefined
      ? { projectId: scope.projectId, from: scope.from, to: scope.to }
      : { projectIds: scope.projectIds, from: scope.from, to: scope.to }

  for await (const row of iterateAuditLogs(ctx, filter)) {
    yield [
      row.id,
      row.projectId ?? null,
      row.actorType,
      row.actorId,
      row.action,
      row.subjectType,
      row.subjectId,
      row.at,
    ]
  }
}

export async function exportAuditCsv(ctx: OrgContext, input: ExportInput): Promise<Response> {
  const scope = await resolveExportScope(ctx, input)
  const stream = rowsToCsvStream(HEADERS, auditRows(ctx, scope), {
    onComplete: async (rowCount) => {
      await audit(ctx, {
        action: 'export.audit',
        subjectType: 'export',
        subjectId: 'audit',
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
  return csvResponse('audit.csv', stream)
}
