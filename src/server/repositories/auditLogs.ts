/**
 * Audit log reads. Writes go through `audit()` in services/audit/log.ts.
 * Every method takes `OrgContext` first and filters on `ctx.orgId`.
 */
import { isValidObjectId } from 'mongoose'
import { AuditLogModel, type AuditLog } from '@/server/models/AuditLog'
import { toDomain } from '@/server/models/base'
import type { OrgContext } from '@/server/http/types'
import type { ActorType } from '@/shared/enums/audit'

export type ListAuditLogsFilter = {
  subjectType?: string
  subjectId?: string
  actorId?: string
  action?: string
  /** Prefix match on action, e.g. `card.` → /^card\./ */
  actionPrefix?: string
  /** Exact action allowlist. */
  actions?: string[]
  projectId?: string
  /** Restrict to these projects (MEMBER scope). */
  projectIds?: string[]
  from?: Date
  to?: Date
  /** Opaque cursor: items strictly older than this (at desc, id desc). */
  cursor?: { at: Date; id: string }
  limit?: number
}

function toAuditLog(doc: Parameters<typeof toDomain>[0]): AuditLog {
  const raw = toDomain<Record<string, unknown>>(doc)
  return {
    id: String(raw.id),
    orgId: String(raw.orgId),
    ...(raw.projectId !== undefined && raw.projectId !== null
      ? { projectId: String(raw.projectId) }
      : {}),
    actorType: raw.actorType as ActorType,
    actorId: String(raw.actorId),
    action: String(raw.action),
    subjectType: String(raw.subjectType),
    subjectId: String(raw.subjectId),
    ...(raw.before !== undefined ? { before: raw.before } : {}),
    ...(raw.after !== undefined ? { after: raw.after } : {}),
    metadata:
      raw.metadata && typeof raw.metadata === 'object'
        ? (raw.metadata as Record<string, unknown>)
        : {},
    at: String(raw.at),
  }
}

function buildCursorClause(cursor: { at: Date; id: string }): Record<string, unknown> {
  // Sort: at desc, _id desc → "after" cursor means strictly older.
  return {
    $or: [{ at: { $lt: cursor.at } }, { at: cursor.at, _id: { $lt: cursor.id } }],
  }
}

/**
 * List audit logs newest-first with optional filters and cursor.
 * Returns up to `limit` items (default 20, max 100 for HTTP; callers may pass more for merges).
 */
export async function listAuditLogs(
  ctx: OrgContext,
  filter: ListAuditLogsFilter = {},
): Promise<AuditLog[]> {
  const limit = filter.limit ?? 20
  const query: Record<string, unknown> = { orgId: ctx.orgId }

  if (filter.subjectType !== undefined) query.subjectType = filter.subjectType
  if (filter.subjectId !== undefined) query.subjectId = filter.subjectId
  if (filter.actorId !== undefined) query.actorId = filter.actorId
  if (filter.action !== undefined) query.action = filter.action
  if (filter.actionPrefix !== undefined) {
    query.action = { $regex: `^${filter.actionPrefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}` }
  }
  if (filter.actions !== undefined && filter.actions.length > 0) {
    query.action = { $in: filter.actions }
  }
  if (filter.projectId !== undefined) query.projectId = filter.projectId
  if (filter.projectIds !== undefined) {
    query.projectId = { $in: filter.projectIds }
  }
  if (filter.from !== undefined || filter.to !== undefined) {
    const at: Record<string, Date> = {}
    if (filter.from !== undefined) at.$gte = filter.from
    if (filter.to !== undefined) at.$lte = filter.to
    query.at = at
  }

  // Keep orgId at the top level for tenantScoped — do not wrap the whole filter in $and.
  if (filter.cursor !== undefined && isValidObjectId(filter.cursor.id)) {
    Object.assign(query, buildCursorClause(filter.cursor))
  }

  const docs = await AuditLogModel.find(query).sort({ at: -1, _id: -1 }).limit(limit).lean().exec()

  return docs.map((doc) => toAuditLog(doc))
}

export async function findAuditLogById(ctx: OrgContext, id: string): Promise<AuditLog | null> {
  if (!isValidObjectId(id)) {
    return null
  }
  const doc = await AuditLogModel.findOne({ _id: id, orgId: ctx.orgId }).lean().exec()
  return doc ? toAuditLog(doc) : null
}
