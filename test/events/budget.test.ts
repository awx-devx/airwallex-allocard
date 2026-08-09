/**
 * B4.14 — budget domain events once each with the right payload:
 * budget.approved | budget.updated | budget.threshold_crossed
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { PUT } from '@/app/api/projects/[id]/budget/route'
import { getPublishedEvents, resetEventPublisher } from '@/server/events/bus'
import { DomainEventType } from '@/server/events/types'
import { AuditLogModel } from '@/server/models/AuditLog'
import { BudgetModel } from '@/server/models/Budget'
import { BudgetEntryModel } from '@/server/models/BudgetEntry'
import { MembershipModel } from '@/server/models/Membership'
import { OrganizationModel } from '@/server/models/Organization'
import { ProjectModel } from '@/server/models/Project'
import { UserModel } from '@/server/models/User'
import * as memberships from '@/server/repositories/memberships'
import * as organizations from '@/server/repositories/organizations'
import * as projectsRepo from '@/server/repositories/projects'
import * as users from '@/server/repositories/users'
import { appendBudgetEntry } from '@/server/services/budget/ledger'
import { resetRedis } from '@/server/redis'
import { BudgetEntrySourceType } from '@/shared/enums/budgetEntrySourceType'
import { BudgetEntryType } from '@/shared/enums/budgetEntryType'
import { OrgRole } from '@/shared/enums/orgRole'
import { useTestDb } from '../helpers/db'
import { buildRequest, installTestSessionResolver } from '../helpers/request'

describe('events/budget', () => {
  useTestDb()

  beforeAll(async () => {
    await Promise.all([
      UserModel.syncIndexes(),
      OrganizationModel.syncIndexes(),
      MembershipModel.syncIndexes(),
      ProjectModel.syncIndexes(),
      BudgetModel.syncIndexes(),
      BudgetEntryModel.syncIndexes(),
      AuditLogModel.syncIndexes(),
    ])
  })

  beforeEach(() => {
    resetEventPublisher()
    resetRedis()
    vi.spyOn(console, 'info').mockImplementation(() => {})
  })

  afterEach(() => {
    installTestSessionResolver()
    resetEventPublisher()
    resetRedis()
    vi.restoreAllMocks()
  })

  async function seedOwner() {
    const user = await users.createUser({
      email: `user-${Date.now()}-${Math.random().toString(16).slice(2)}@example.com`,
      name: 'Owner',
    })
    const org = await organizations.createOrganization({
      name: 'Events Budget Org',
      slug: `org-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      country: 'US',
      baseCurrency: 'USD',
      createdBy: user.id,
    })
    await memberships.createMembership(
      { orgId: org.id, userId: user.id, orgRole: OrgRole.OWNER },
      { userId: user.id, orgRole: OrgRole.OWNER },
    )
    const ctx = { orgId: org.id, userId: user.id, orgRole: OrgRole.OWNER }
    const project = await projectsRepo.createProject(ctx, {
      name: 'Budget Events',
      code: `BE-${Date.now()}`,
    })
    return {
      user,
      org,
      ctx,
      project,
      session: {
        userId: user.id,
        orgId: org.id,
        orgRole: OrgRole.OWNER,
        onboarded: true as const,
      },
    }
  }

  it('emits budget.approved and budget.updated on PUT approval', async () => {
    const owner = await seedOwner()
    resetEventPublisher()

    const res = await PUT(
      buildRequest({
        method: 'PUT',
        path: `/api/projects/${owner.project.id}/budget`,
        session: owner.session,
        params: { id: owner.project.id },
        body: { currency: 'USD', approvedAmount: 100_000, thresholdPcts: [80, 90, 100] },
      }),
    )
    expect(res.status).toBe(200)

    const approved = getPublishedEvents().filter((e) => e.type === DomainEventType.BUDGET_APPROVED)
    const updated = getPublishedEvents().filter((e) => e.type === DomainEventType.BUDGET_UPDATED)
    expect(approved).toHaveLength(1)
    expect(updated).toHaveLength(1)
    expect(approved[0]).toMatchObject({
      orgId: owner.org.id,
      projectId: owner.project.id,
      subjectType: 'budget',
      subjectId: owner.project.id,
      payload: {
        projectId: owner.project.id,
        approved: 100_000,
      },
    })
    expect(approved[0]?.payload).toEqual(expect.objectContaining({ entryId: expect.any(String) }))
    expect(updated[0]).toMatchObject({
      orgId: owner.org.id,
      projectId: owner.project.id,
      payload: {
        projectId: owner.project.id,
        entryType: BudgetEntryType.APPROVAL,
        approved: 100_000,
        committed: 0,
        actual: 0,
        remaining: 100_000,
        utilisationPct: 0,
        overCommitted: false,
      },
    })
  })

  it('emits budget.threshold_crossed once on edge-up only', async () => {
    const owner = await seedOwner()

    await PUT(
      buildRequest({
        method: 'PUT',
        path: `/api/projects/${owner.project.id}/budget`,
        session: owner.session,
        params: { id: owner.project.id },
        body: { currency: 'USD', approvedAmount: 100_000, thresholdPcts: [80, 90, 100] },
      }),
    )
    resetEventPublisher()

    await appendBudgetEntry(owner.ctx, owner.project.id, {
      type: BudgetEntryType.COMMITMENT,
      amount: 85_000,
      currency: 'USD',
      sourceType: BudgetEntrySourceType.PURCHASE_REQUEST,
      sourceId: 'pr_threshold',
      createdBy: owner.user.id,
    })

    const crossed = getPublishedEvents().filter(
      (e) => e.type === DomainEventType.BUDGET_THRESHOLD_CROSSED,
    )
    expect(crossed).toHaveLength(1)
    expect(crossed[0]).toMatchObject({
      orgId: owner.org.id,
      projectId: owner.project.id,
      payload: {
        projectId: owner.project.id,
        thresholdPct: 80,
        previousUtilisationPct: 0,
        utilisationPct: 85,
      },
    })

    resetEventPublisher()
    await appendBudgetEntry(owner.ctx, owner.project.id, {
      type: BudgetEntryType.COMMITMENT,
      amount: 1_000,
      currency: 'USD',
      sourceType: BudgetEntrySourceType.PURCHASE_REQUEST,
      sourceId: 'pr_still_above',
      createdBy: owner.user.id,
    })

    const again = getPublishedEvents().filter(
      (e) => e.type === DomainEventType.BUDGET_THRESHOLD_CROSSED,
    )
    expect(again).toHaveLength(0)
  })
})
