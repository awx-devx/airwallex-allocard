/**
 * Filterable audit list (B9.2).
 * Cursor = opaque base64url `{ at, id }` — same encoding as activity feed.
 */
import { connectDb } from '@/server/db/connect'
import { AppError } from '@/server/http/errors'
import { decodeOpaqueCursor, encodeOpaqueCursor } from '@/server/http/opaqueCursor'
import type { OrgContext } from '@/server/http/types'
import type { AuditLog } from '@/server/models/AuditLog'
import { listAuditLogs } from '@/server/repositories/auditLogs'
import { findProjectById } from '@/server/repositories/projects'
import type { AuditEntry, AuditPage, ListAuditQuery } from '@/shared/types/auditQuery'

function toWireEntry(log: AuditLog): AuditEntry {
  return {
    id: log.id,
    orgId: log.orgId,
    projectId: log.projectId ?? null,
    actorType: log.actorType,
    actorId: log.actorId,
    action: log.action,
    subjectType: log.subjectType,
    subjectId: log.subjectId,
    before: log.before !== undefined ? log.before : null,
    after: log.after !== undefined ? log.after : null,
    metadata: log.metadata,
    at: log.at,
  }
}

/**
 * Org-wide or project-scoped audit page.
 * Caller must enforce `member.manage` (and cross-org project 404) in the route.
 */
export async function listAudit(ctx: OrgContext, query: ListAuditQuery): Promise<AuditPage> {
  await connectDb()

  if (query.projectId !== undefined) {
    const project = await findProjectById(ctx, query.projectId)
    if (!project) {
      throw AppError.notFound()
    }
  }

  const limit = query.limit
  let cursor: { at: Date; id: string } | undefined
  if (query.cursor !== undefined) {
    const decoded = decodeOpaqueCursor(query.cursor)
    cursor = { at: new Date(decoded.at), id: decoded.id }
  }

  const rows = await listAuditLogs(ctx, {
    subjectType: query.subjectType,
    subjectId: query.subjectId,
    actorId: query.actorId,
    action: query.action,
    projectId: query.projectId,
    from: query.from !== undefined ? new Date(query.from) : undefined,
    to: query.to !== undefined ? new Date(query.to) : undefined,
    cursor,
    limit: limit + 1,
  })

  const pageRows = rows.slice(0, limit)
  const items = pageRows.map(toWireEntry)
  const nextCursor =
    rows.length > limit
      ? encodeOpaqueCursor(pageRows[pageRows.length - 1]!.at, pageRows[pageRows.length - 1]!.id)
      : null

  return { items, nextCursor }
}
