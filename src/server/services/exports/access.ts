/**
 * Shared export access: `report.export` + project 404 / MEMBER project filter.
 */
import { connectDb } from '@/server/db/connect'
import { AppError } from '@/server/http/errors'
import { projectIdsGrantingPermission, requirePermission } from '@/server/http/requirePermission'
import type { OrgContext } from '@/server/http/types'
import { findProjectById } from '@/server/repositories/projects'
import { OrgRole } from '@/shared/enums/orgRole'
import { Permission } from '@/shared/enums/permissions'
import type { ExportInput } from '@/shared/types/export'

function isElevated(orgRole: OrgRole): boolean {
  return orgRole === OrgRole.OWNER || orgRole === OrgRole.ADMIN
}

export type ExportScope = {
  /** When set, restrict rows to these projects. `undefined` = entire org (elevated). */
  projectIds: string[] | undefined
  projectId?: string
  from?: Date
  to?: Date
}

/**
 * Resolve export filters and enforce permission.
 * Cross-org / missing project → 404. Lacking `report.export` → 403.
 */
export async function resolveExportScope(
  ctx: OrgContext,
  input: ExportInput,
): Promise<ExportScope> {
  await connectDb()

  const from = input.from !== undefined ? new Date(input.from) : undefined
  const to = input.to !== undefined ? new Date(input.to) : undefined

  if (input.projectId !== undefined) {
    const project = await findProjectById(ctx, input.projectId)
    if (!project) {
      throw AppError.notFound()
    }
    await requirePermission(ctx, Permission.REPORT_EXPORT, { projectId: input.projectId })
    return {
      projectIds: [input.projectId],
      projectId: input.projectId,
      from,
      to,
    }
  }

  await requirePermission(ctx, Permission.REPORT_EXPORT)

  if (isElevated(ctx.orgRole)) {
    return { projectIds: undefined, from, to }
  }

  const ids = await projectIdsGrantingPermission(ctx, Permission.REPORT_EXPORT)
  if (ids.length === 0) {
    throw AppError.permissionDenied(Permission.REPORT_EXPORT)
  }
  return { projectIds: ids, from, to }
}

export function csvResponse(filename: string, stream: ReadableStream<Uint8Array>): Response {
  return new Response(stream, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
