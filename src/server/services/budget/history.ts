import { connectDb } from '@/server/db/connect'
import { AppError } from '@/server/http/errors'
import type { OrgContext } from '@/server/http/types'
import { AuditLogModel } from '@/server/models/AuditLog'
import { toDomain } from '@/server/models/base'
import { findProjectById } from '@/server/repositories/projects'
import { ActorType } from '@/shared/enums/audit'
import type { BudgetHistoryEntry } from '@/shared/types/budget'

function toHistoryEntry(doc: Parameters<typeof toDomain>[0]): BudgetHistoryEntry {
  const raw = toDomain<Record<string, unknown>>(doc)
  return {
    id: String(raw.id),
    action: String(raw.action),
    actorType: raw.actorType as ActorType,
    actorId: String(raw.actorId),
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

/**
 * Budget change history from audit logs for this project's budget subjects.
 * Newest first.
 */
export async function getBudgetHistory(
  ctx: OrgContext,
  projectId: string,
): Promise<BudgetHistoryEntry[]> {
  await connectDb()

  const project = await findProjectById(ctx, projectId)
  if (!project) {
    throw AppError.notFound()
  }

  const docs = await AuditLogModel.find({
    orgId: ctx.orgId,
    projectId,
    action: { $regex: /^budget\./ },
  })
    .sort({ at: -1 })
    .lean()
    .exec()

  return docs.map((doc) => toHistoryEntry(doc))
}
