/**
 * Stale / elevated access sweep — create AccessReview rows for:
 * 1. Scopes past validTo
 * 2. Members inactive N days (INACTIVE_MEMBER_DAYS)
 * 3. Subjects named by WOULD_APPLY `flag.review` rule actions
 *
 * Genuinely time-triggered (ARCHITECTURE §8 expire-access). Idempotent on
 * (orgId, subjectId, reason) for OPEN reviews. Resolve path stays in B3.
 */
import { connectDb } from '@/server/db/connect'
import type { OrgContext } from '@/server/http/types'
import { createAccessReviewIfAbsent } from '@/server/repositories/accessReviews'
import { findCardById } from '@/server/repositories/cards'
import { findCardholderById } from '@/server/repositories/cardholders'
import {
  listActiveProjectMembersForUser,
  listInactiveProjectMembers,
  listMembersWithExpiredScopes,
} from '@/server/repositories/projectMembers'
import { listFlagReviewActionCandidates } from '@/server/repositories/ruleRuns'
import { audit } from '@/server/services/audit/log'
import { ActorType } from '@/shared/enums/audit'
import { OrgRole } from '@/shared/enums/orgRole'
import type { ProjectMember } from '@/shared/types/projectMember'

/** Days without project-member touch (`updatedAt`) before flagging inactive. */
export const INACTIVE_MEMBER_DAYS = 30

export const REASON_SCOPE_EXPIRED = 'Scope past validTo'
export const REASON_MEMBER_INACTIVE = `Member inactive for ${INACTIVE_MEMBER_DAYS} days`

function systemCtx(orgId: string): OrgContext {
  return { orgId, userId: 'system', orgRole: OrgRole.OWNER }
}

export type SweepAccessReviewsResult = {
  scanned: number
  created: number
}

async function flagMember(member: ProjectMember, reason: string, now: Date): Promise<boolean> {
  const ctx = systemCtx(member.orgId)
  const created = await createAccessReviewIfAbsent(ctx, {
    projectId: member.projectId,
    reason,
    subjectId: member.id,
    userId: member.userId,
    flaggedBy: null,
    flaggedAt: now,
  })
  if (!created) {
    return false
  }

  await audit(ctx, {
    action: 'accessReview.flagged',
    subjectType: 'accessReview',
    subjectId: created.id,
    projectId: created.projectId,
    actorType: ActorType.SYSTEM,
    actorId: 'system',
    before: null,
    after: created,
    metadata: {
      reason,
      userId: created.userId,
      subjectId: created.subjectId,
    },
  })
  return true
}

async function membersForFlagTarget(
  orgId: string,
  projectId: string | null,
  userId: string,
): Promise<ProjectMember[]> {
  const ctx = systemCtx(orgId)
  if (projectId) {
    const all = await listActiveProjectMembersForUser(ctx, userId)
    return all.filter((m) => m.projectId === projectId)
  }
  return listActiveProjectMembersForUser(ctx, userId)
}

/**
 * Cross-tenant sweep wired to worker `expire-access`.
 * Does not revoke — only opens AccessReview rows for human resolve.
 */
export async function sweepAccessReviews(
  now: Date = new Date(),
): Promise<SweepAccessReviewsResult> {
  await connectDb()

  let scanned = 0
  let created = 0

  const expired = await listMembersWithExpiredScopes(now)
  scanned += expired.length
  for (const member of expired) {
    if (await flagMember(member, REASON_SCOPE_EXPIRED, now)) {
      created += 1
    }
  }

  const cutoff = new Date(now.getTime() - INACTIVE_MEMBER_DAYS * 24 * 60 * 60_000)
  const inactive = await listInactiveProjectMembers(cutoff)
  scanned += inactive.length
  for (const member of inactive) {
    if (await flagMember(member, REASON_MEMBER_INACTIVE, now)) {
      created += 1
    }
  }

  const flagActions = await listFlagReviewActionCandidates()
  scanned += flagActions.length
  for (const action of flagActions) {
    let userIds: string[] = []
    if (action.targetKind === 'member') {
      userIds = [action.targetId]
    } else {
      const ctx = systemCtx(action.orgId)
      const card = await findCardById(ctx, action.targetId)
      if (!card) continue
      const cardholder = await findCardholderById(ctx, card.cardholderId)
      if (!cardholder?.userId) continue
      userIds = [cardholder.userId]
    }

    for (const userId of userIds) {
      const members = await membersForFlagTarget(action.orgId, action.projectId, userId)
      for (const member of members) {
        if (await flagMember(member, action.reason, now)) {
          created += 1
        }
      }
    }
  }

  return { scanned, created }
}
