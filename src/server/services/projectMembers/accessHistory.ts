import { connectDb } from '@/server/db/connect'
import { AppError } from '@/server/http/errors'
import type { OrgContext } from '@/server/http/types'
import { AuditLogModel } from '@/server/models/AuditLog'
import { toDomain } from '@/server/models/base'
import { findProjectById } from '@/server/repositories/projects'
import { ActorType } from '@/shared/enums/audit'
import type { AccessHistoryEntry } from '@/shared/types/projectMember'

const MEMBERSHIP_ACTIONS = ['member.added', 'member.updated', 'member.removed'] as const

function toAccessHistoryEntry(doc: Parameters<typeof toDomain>[0]): AccessHistoryEntry {
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
 * Project access history from audit — membership add/update/remove only.
 * Newest first.
 */
export async function getProjectAccessHistory(
  ctx: OrgContext,
  projectId: string,
): Promise<AccessHistoryEntry[]> {
  await connectDb()

  const project = await findProjectById(ctx, projectId)
  if (!project) {
    throw AppError.notFound()
  }

  const docs = await AuditLogModel.find({
    orgId: ctx.orgId,
    projectId,
    subjectType: 'projectMember',
    action: { $in: [...MEMBERSHIP_ACTIONS] },
  })
    .sort({ at: -1 })
    .lean()
    .exec()

  return docs.map((doc) => toAccessHistoryEntry(doc))
}
