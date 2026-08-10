/**
 * Built-in attribute computation (RULES-ENGINE §2). Pure — no I/O.
 * `resolve.ts` loads the snapshots; this file turns them into attribute readings.
 *
 * An attribute that cannot be computed is **omitted**, never emitted as zero:
 * a silent `0` becomes a `$0` limit, which looks like a bug and behaves like an
 * outage. A rule referencing an omitted key fails with that key named.
 */
import type { AttributeSource } from '@/shared/enums/attributeSource'
import { AttributeSource as Source } from '@/shared/enums/attributeSource'
import { AttributeSubjectType } from '@/shared/enums/attributeSubjectType'
import type { AccessScopeLevel } from '@/shared/enums/accessScopeLevel'
import type { CardPurpose } from '@/shared/enums/cardPurpose'
import type { CardStatus } from '@/shared/enums/cardStatus'
import type { ProjectStatus } from '@/shared/enums/projectStatus'
import type { TransactionLimitInterval } from '@/shared/enums/transactionLimitInterval'
import type { AttributeLiteral } from '@/shared/types/attribute'

export const MS_PER_DAY = 86_400_000

/** One attribute reading available to the evaluation context. */
export type ResolvedAttribute = {
  key: string
  subjectType: AttributeSubjectType
  subjectId: string
  value: AttributeLiteral
  /** ISO 8601. Computed built-ins observe at evaluation time. */
  observedAt: string
  ttlSec: number | null
  source: AttributeSource
  stale: boolean
}

export type OrgAttributeSnapshot = {
  orgId: string
  baseCurrency: string
}

export type ProjectAttributeSnapshot = {
  projectId: string
  status: ProjectStatus
  /** Derived from `approvedAt` / `status` — see `projectApprovalStatus`. */
  approvalStatus: string
  startDate: string | null
  endDate: string | null
  headcount: number
  budget: {
    approved: number
    committed: number
    actual: number
    remaining: number
    utilisationPct: number
  } | null
  categoryRemaining: Array<{ categoryId: string; remaining: number }>
}

export type MemberAttributeSnapshot = {
  /** Subject id for MEMBER attributes is the user id. */
  userId: string
  roleKey: string | null
  scopeLevel: AccessScopeLevel | null
  /** Null until B8 records transactions — omitted rather than defaulted to 0. */
  spendMtd: number | null
}

export type CardAttributeSnapshot = {
  cardId: string
  purpose: CardPurpose
  status: CardStatus
  /** Live per-interval remaining from Airwallex; absent when not loaded. */
  remainingByInterval?: Partial<Record<TransactionLimitInterval, number>>
}

export type BuiltinSnapshot = {
  org: OrgAttributeSnapshot
  project?: ProjectAttributeSnapshot
  members?: MemberAttributeSnapshot[]
  cards?: CardAttributeSnapshot[]
}

/**
 * `APPROVED` once the project has an `approvedAt`; otherwise it reflects where
 * the project sits in the approval flow.
 */
export function projectApprovalStatus(input: {
  status: ProjectStatus
  approvedAt: string | null
}): string {
  if (input.approvedAt !== null) {
    return 'APPROVED'
  }
  return input.status === 'PENDING_APPROVAL' ? 'PENDING_APPROVAL' : 'NOT_SUBMITTED'
}

/** Whole days from `now` to `endDate`. Negative once the project is overdue. */
export function daysRemaining(endDate: string, now: Date): number {
  return Math.floor((new Date(endDate).getTime() - now.getTime()) / MS_PER_DAY)
}

function reading(
  key: string,
  subjectType: AttributeSubjectType,
  subjectId: string,
  value: AttributeLiteral,
  observedAt: string,
): ResolvedAttribute {
  return {
    key,
    subjectType,
    subjectId,
    value,
    observedAt,
    ttlSec: null,
    source: Source.COMPUTED,
    stale: false,
  }
}

/**
 * Compute every built-in attribute the snapshot can support.
 * Computed values are never stale — they are derived from current state at `now`.
 */
export function computeBuiltinAttributes(
  snapshot: BuiltinSnapshot,
  now: Date = new Date(),
): ResolvedAttribute[] {
  const observedAt = now.toISOString()
  const out: ResolvedAttribute[] = []
  const { org, project, members, cards } = snapshot

  out.push(
    reading('org.baseCurrency', AttributeSubjectType.ORG, org.orgId, org.baseCurrency, observedAt),
  )

  if (project) {
    const subject = AttributeSubjectType.PROJECT
    const id = project.projectId

    out.push(reading('project.status', subject, id, project.status, observedAt))
    out.push(reading('project.approvalStatus', subject, id, project.approvalStatus, observedAt))
    out.push(reading('project.headcount', subject, id, project.headcount, observedAt))

    if (project.startDate !== null) {
      out.push(reading('project.startDate', subject, id, project.startDate, observedAt))
    }
    if (project.endDate !== null) {
      out.push(reading('project.endDate', subject, id, project.endDate, observedAt))
      out.push(
        reading(
          'project.daysRemaining',
          subject,
          id,
          daysRemaining(project.endDate, now),
          observedAt,
        ),
      )
    }

    if (project.budget) {
      out.push(reading('project.budget.approved', subject, id, project.budget.approved, observedAt))
      out.push(
        reading('project.budget.committed', subject, id, project.budget.committed, observedAt),
      )
      out.push(reading('project.budget.actual', subject, id, project.budget.actual, observedAt))
      out.push(
        reading('project.budget.remaining', subject, id, project.budget.remaining, observedAt),
      )
      out.push(
        reading(
          'project.budget.utilisationPct',
          subject,
          id,
          project.budget.utilisationPct,
          observedAt,
        ),
      )
    }

    for (const category of project.categoryRemaining) {
      out.push(
        reading(
          `project.category.${category.categoryId}.remaining`,
          subject,
          id,
          category.remaining,
          observedAt,
        ),
      )
    }
  }

  for (const member of members ?? []) {
    const subject = AttributeSubjectType.MEMBER
    if (member.roleKey !== null) {
      out.push(reading('member.role', subject, member.userId, member.roleKey, observedAt))
    }
    if (member.scopeLevel !== null) {
      out.push(reading('member.scope.level', subject, member.userId, member.scopeLevel, observedAt))
    }
    if (member.spendMtd !== null) {
      out.push(reading('member.spend.mtd', subject, member.userId, member.spendMtd, observedAt))
    }
  }

  for (const card of cards ?? []) {
    const subject = AttributeSubjectType.CARD
    out.push(reading('card.purpose', subject, card.cardId, card.purpose, observedAt))
    out.push(reading('card.status', subject, card.cardId, card.status, observedAt))

    for (const [interval, remaining] of Object.entries(card.remainingByInterval ?? {})) {
      if (typeof remaining === 'number') {
        out.push(reading(`card.remaining.${interval}`, subject, card.cardId, remaining, observedAt))
      }
    }
  }

  return out
}
