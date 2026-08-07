import { ActorType } from '@/shared/enums/audit'
import type { OrgContext } from '@/server/http/types'
import { AuditLogModel, type AuditLog } from '@/server/models/AuditLog'
import { toDomain } from '@/server/models/base'

export type AuditEntry = {
  action: string
  subjectType: string
  subjectId: string
  before?: unknown
  after?: unknown
  metadata?: Record<string, unknown>
  projectId?: string
  /** Defaults to USER. Pass RULE / SYSTEM / AIRWALLEX for non-user actors. */
  actorType?: ActorType
  /** Defaults to `ctx.userId` when actorType is USER. */
  actorId?: string
  at?: Date
}

/**
 * Append one audit log entry in the caller's org.
 * Every mutation from B1 onward must call this in the same unit of work.
 */
export async function audit(ctx: OrgContext, entry: AuditEntry): Promise<AuditLog> {
  const actorType = entry.actorType ?? ActorType.USER
  const actorId = entry.actorId ?? ctx.userId

  const doc = await AuditLogModel.create({
    orgId: ctx.orgId,
    projectId: entry.projectId,
    actorType,
    actorId,
    action: entry.action,
    subjectType: entry.subjectType,
    subjectId: entry.subjectId,
    before: entry.before,
    after: entry.after,
    metadata: entry.metadata ?? {},
    at: entry.at ?? new Date(),
  })

  const domain = toDomain<AuditLog>(doc)
  return {
    ...domain,
    metadata: domain.metadata ?? {},
  }
}
