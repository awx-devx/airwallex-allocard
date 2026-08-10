import { describe, expect, it } from 'vitest'
import {
  computeBuiltinAttributes,
  daysRemaining,
  projectApprovalStatus,
  type BuiltinSnapshot,
} from '@/server/services/attributes/builtins'
import { AccessScopeLevel } from '@/shared/enums/accessScopeLevel'
import { AttributeSource } from '@/shared/enums/attributeSource'
import { AttributeSubjectType } from '@/shared/enums/attributeSubjectType'
import { CardPurpose } from '@/shared/enums/cardPurpose'
import { CardStatus } from '@/shared/enums/cardStatus'
import { ProjectStatus } from '@/shared/enums/projectStatus'
import { TransactionLimitInterval } from '@/shared/enums/transactionLimitInterval'

const NOW = new Date('2026-08-11T00:00:00.000Z')

function snapshot(overrides: Partial<BuiltinSnapshot> = {}): BuiltinSnapshot {
  return {
    org: { orgId: 'org_1', baseCurrency: 'USD' },
    project: {
      projectId: 'proj_1',
      status: ProjectStatus.ACTIVE,
      approvalStatus: 'APPROVED',
      startDate: '2026-08-01T00:00:00.000Z',
      endDate: '2026-08-31T00:00:00.000Z',
      headcount: 4,
      budget: {
        approved: 1_000_000,
        committed: 250_000,
        actual: 150_000,
        remaining: 600_000,
        utilisationPct: 40,
      },
      categoryRemaining: [{ categoryId: 'cat_1', remaining: 200_000 }],
    },
    ...overrides,
  }
}

function valueOf(readings: ReturnType<typeof computeBuiltinAttributes>, key: string) {
  return readings.find((reading) => reading.key === key)?.value
}

describe('attributes/builtins', () => {
  it('computes the project and budget built-ins from the ledger projection', () => {
    const readings = computeBuiltinAttributes(snapshot(), NOW)

    expect(valueOf(readings, 'org.baseCurrency')).toBe('USD')
    expect(valueOf(readings, 'project.status')).toBe(ProjectStatus.ACTIVE)
    expect(valueOf(readings, 'project.budget.approved')).toBe(1_000_000)
    expect(valueOf(readings, 'project.budget.remaining')).toBe(600_000)
    expect(valueOf(readings, 'project.budget.utilisationPct')).toBe(40)
    expect(valueOf(readings, 'project.headcount')).toBe(4)
    expect(valueOf(readings, 'project.category.cat_1.remaining')).toBe(200_000)
  })

  it('marks computed readings as fresh, COMPUTED, and observed at evaluation time', () => {
    const readings = computeBuiltinAttributes(snapshot(), NOW)
    const remaining = readings.find((reading) => reading.key === 'project.budget.remaining')

    expect(remaining?.source).toBe(AttributeSource.COMPUTED)
    expect(remaining?.stale).toBe(false)
    expect(remaining?.ttlSec).toBeNull()
    expect(remaining?.observedAt).toBe(NOW.toISOString())
    expect(remaining?.subjectType).toBe(AttributeSubjectType.PROJECT)
    expect(remaining?.subjectId).toBe('proj_1')
  })

  it('omits budget attributes entirely when there is no ledger — never zero', () => {
    const base = snapshot()
    const readings = computeBuiltinAttributes(
      { ...base, project: { ...base.project!, budget: null } },
      NOW,
    )

    expect(readings.some((reading) => reading.key.startsWith('project.budget.'))).toBe(false)
    expect(valueOf(readings, 'project.status')).toBe(ProjectStatus.ACTIVE)
  })

  it('omits date-derived attributes when the project has no end date', () => {
    const base = snapshot()
    const readings = computeBuiltinAttributes(
      { ...base, project: { ...base.project!, endDate: null } },
      NOW,
    )

    expect(valueOf(readings, 'project.endDate')).toBeUndefined()
    expect(valueOf(readings, 'project.daysRemaining')).toBeUndefined()
  })

  it('computes daysRemaining, going negative once the project is overdue', () => {
    expect(daysRemaining('2026-08-31T00:00:00.000Z', NOW)).toBe(20)
    expect(daysRemaining('2026-08-01T00:00:00.000Z', NOW)).toBe(-10)
  })

  it('derives approvalStatus from approvedAt then status', () => {
    expect(
      projectApprovalStatus({ status: ProjectStatus.ACTIVE, approvedAt: '2026-08-01T00:00:00Z' }),
    ).toBe('APPROVED')
    expect(
      projectApprovalStatus({ status: ProjectStatus.PENDING_APPROVAL, approvedAt: null }),
    ).toBe('PENDING_APPROVAL')
    expect(projectApprovalStatus({ status: ProjectStatus.DRAFT, approvedAt: null })).toBe(
      'NOT_SUBMITTED',
    )
  })

  it('emits member attributes but omits spend.mtd while it is unavailable', () => {
    const readings = computeBuiltinAttributes(
      snapshot({
        members: [
          {
            userId: 'user_1',
            roleKey: 'project_spender',
            scopeLevel: AccessScopeLevel.OWN,
            spendMtd: null,
          },
        ],
      }),
      NOW,
    )

    expect(valueOf(readings, 'member.role')).toBe('project_spender')
    expect(valueOf(readings, 'member.scope.level')).toBe(AccessScopeLevel.OWN)
    expect(valueOf(readings, 'member.spend.mtd')).toBeUndefined()
  })

  it('emits card attributes and per-interval remaining only when loaded', () => {
    const withoutLimits = computeBuiltinAttributes(
      snapshot({
        cards: [{ cardId: 'card_1', purpose: CardPurpose.MEMBER, status: CardStatus.ACTIVE }],
      }),
      NOW,
    )
    expect(valueOf(withoutLimits, 'card.purpose')).toBe(CardPurpose.MEMBER)
    expect(valueOf(withoutLimits, 'card.status')).toBe(CardStatus.ACTIVE)
    expect(valueOf(withoutLimits, 'card.remaining.MONTHLY')).toBeUndefined()

    const withLimits = computeBuiltinAttributes(
      snapshot({
        cards: [
          {
            cardId: 'card_1',
            purpose: CardPurpose.MEMBER,
            status: CardStatus.ACTIVE,
            remainingByInterval: { [TransactionLimitInterval.MONTHLY]: 120_000 },
          },
        ],
      }),
      NOW,
    )
    expect(valueOf(withLimits, 'card.remaining.MONTHLY')).toBe(120_000)
  })

  it('is deterministic — identical snapshots produce identical readings', () => {
    const first = computeBuiltinAttributes(snapshot(), NOW)
    const second = computeBuiltinAttributes(snapshot(), NOW)

    expect(first).toEqual(second)
  })
})
