import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { GET, POST } from '@/app/api/projects/[id]/budget/entries/route'
import { PUT as PUT_BUDGET } from '@/app/api/projects/[id]/budget/route'
import { POST as POST_CATEGORY } from '@/app/api/projects/[id]/budget/categories/route'
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
import { resetRedis } from '@/server/redis'
import { appendBudgetEntry } from '@/server/services/budget/ledger'
import { budgetContracts } from '@/shared/contracts/budget'
import { BudgetEntrySourceType } from '@/shared/enums/budgetEntrySourceType'
import { BudgetEntryType } from '@/shared/enums/budgetEntryType'
import { ErrorCode } from '@/shared/enums/errors'
import { OrgRole } from '@/shared/enums/orgRole'
import { createBudgetEntryInput } from '@/shared/schemas/budget'
import { expectMatchesContract } from '../helpers/contract'
import { useTestDb } from '../helpers/db'
import { buildRequest, installTestSessionResolver, readBody } from '../helpers/request'

describe('/api/projects/:id/budget/entries', () => {
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
      name: 'Entry Org',
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
      name: 'Entry Project',
      code: `ENT-${Date.now()}`,
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

  async function putBudget(owner: Awaited<ReturnType<typeof seedOwner>>, amount = 100_000) {
    const res = await PUT_BUDGET(
      buildRequest({
        method: 'PUT',
        path: `/api/projects/${owner.project.id}/budget`,
        session: owner.session,
        params: { id: owner.project.id },
        body: { currency: 'USD', approvedAmount: amount },
      }),
    )
    expect(res.status).toBe(200)
  }

  it('returns 401 when unauthenticated', async () => {
    const res = await GET(
      buildRequest({
        method: 'GET',
        path: '/api/projects/x/budget/entries',
        session: null,
        params: { id: 'x' },
      }),
    )
    expect(res.status).toBe(401)
  })

  it('returns 403 when onboarding is incomplete', async () => {
    const user = await users.createUser({
      email: `u-${Date.now()}@example.com`,
      name: 'U',
    })
    const res = await GET(
      buildRequest({
        method: 'GET',
        path: '/api/projects/x/budget/entries',
        session: { userId: user.id, orgId: null, orgRole: null, onboarded: false },
        params: { id: 'x' },
      }),
    )
    expect(res.status).toBe(403)
    const body = await readBody<{ error: { code: string } }>(res)
    expect(body.error.code).toBe(ErrorCode.ONBOARDING_INCOMPLETE)
  })

  it('returns 404 for cross-org project access', async () => {
    const a = await seedOwner()
    const b = await seedOwner()
    const res = await GET(
      buildRequest({
        method: 'GET',
        path: `/api/projects/${a.project.id}/budget/entries`,
        session: b.session,
        params: { id: a.project.id },
      }),
    )
    expect(res.status).toBe(404)
  })

  it('returns 403 when the caller lacks budget.view', async () => {
    const owner = await seedOwner()
    const member = await users.createUser({
      email: `m-${Date.now()}@example.com`,
      name: 'Member',
    })
    await memberships.createMembership(
      { orgId: owner.org.id, userId: member.id, orgRole: OrgRole.MEMBER },
      { userId: member.id, orgRole: OrgRole.MEMBER },
    )

    const res = await GET(
      buildRequest({
        method: 'GET',
        path: `/api/projects/${owner.project.id}/budget/entries`,
        session: {
          userId: member.id,
          orgId: owner.org.id,
          orgRole: OrgRole.MEMBER,
          onboarded: true,
        },
        params: { id: owner.project.id },
      }),
    )
    expect(res.status).toBe(403)
  })

  it('POST creates ADJUSTMENT+MANUAL; GET lists and filters by type', async () => {
    const owner = await seedOwner()
    await putBudget(owner)

    const catRes = await POST_CATEGORY(
      buildRequest({
        method: 'POST',
        path: `/api/projects/${owner.project.id}/budget/categories`,
        session: owner.session,
        params: { id: owner.project.id },
        body: { name: 'Ops', allocated: 1_000 },
      }),
    )
    const category = await expectMatchesContract(catRes, budgetContracts.createCategory.output)

    const postRes = await POST(
      buildRequest({
        method: 'POST',
        path: `/api/projects/${owner.project.id}/budget/entries`,
        session: owner.session,
        params: { id: owner.project.id },
        body: { amount: -500, note: 'correction', categoryId: category.id },
      }),
    )
    expect(postRes.status).toBe(201)
    const entry = await expectMatchesContract(postRes, budgetContracts.createEntry.output)
    expect(entry).toMatchObject({
      type: BudgetEntryType.ADJUSTMENT,
      sourceType: BudgetEntrySourceType.MANUAL,
      amount: -500,
      note: 'correction',
      categoryId: category.id,
      lifecycleId: null,
    })

    expect(getPublishedEvents().some((e) => e.type === DomainEventType.BUDGET_UPDATED)).toBe(true)

    const audits = await AuditLogModel.find({
      orgId: owner.org.id,
      action: 'budget.entry_created',
    }).exec()
    expect(audits).toHaveLength(1)

    const listRes = await GET(
      buildRequest({
        method: 'GET',
        path: `/api/projects/${owner.project.id}/budget/entries?type=ADJUSTMENT&page=1&pageSize=10`,
        session: owner.session,
        params: { id: owner.project.id },
      }),
    )
    expect(listRes.status).toBe(200)
    const listed = await expectMatchesContract(listRes, budgetContracts.listEntries.output)
    expect(listed.items.some((item) => item.id === entry.id)).toBe(true)
    expect(listed.items.every((item) => item.type === BudgetEntryType.ADJUSTMENT)).toBe(true)

    const approvals = await GET(
      buildRequest({
        method: 'GET',
        path: `/api/projects/${owner.project.id}/budget/entries?type=APPROVAL`,
        session: owner.session,
        params: { id: owner.project.id },
      }),
    )
    const approvalList = await expectMatchesContract(approvals, budgetContracts.listEntries.output)
    expect(approvalList.items.length).toBeGreaterThanOrEqual(1)
    expect(approvalList.items.every((item) => item.type === BudgetEntryType.APPROVAL)).toBe(true)
  })

  it('contract omits type — HTTP cannot create COMMITMENT/ACTUAL', async () => {
    const owner = await seedOwner()
    await putBudget(owner)

    const parsed = createBudgetEntryInput.safeParse({
      amount: 1_000,
      type: BudgetEntryType.COMMITMENT,
    })
    expect(parsed.success).toBe(true)
    if (parsed.success) {
      expect(parsed.data).not.toHaveProperty('type')
    }

    const res = await POST(
      buildRequest({
        method: 'POST',
        path: `/api/projects/${owner.project.id}/budget/entries`,
        session: owner.session,
        params: { id: owner.project.id },
        body: { amount: 1_000, type: BudgetEntryType.COMMITMENT },
      }),
    )
    expect(res.status).toBe(201)
    const entry = await expectMatchesContract(res, budgetContracts.createEntry.output)
    expect(entry.type).toBe(BudgetEntryType.ADJUSTMENT)
    expect(entry.type).not.toBe(BudgetEntryType.COMMITMENT)
    expect(entry.type).not.toBe(BudgetEntryType.ACTUAL)
  })

  it('ledger can write COMMITMENT internally (unreachable from HTTP)', async () => {
    const owner = await seedOwner()
    await putBudget(owner)

    const { entry } = await appendBudgetEntry(owner.ctx, owner.project.id, {
      type: BudgetEntryType.COMMITMENT,
      amount: 2_500,
      currency: 'USD',
      sourceType: BudgetEntrySourceType.PURCHASE_REQUEST,
      sourceId: 'pr_internal',
      createdBy: owner.user.id,
    })
    expect(entry.type).toBe(BudgetEntryType.COMMITMENT)

    const listRes = await GET(
      buildRequest({
        method: 'GET',
        path: `/api/projects/${owner.project.id}/budget/entries?type=COMMITMENT`,
        session: owner.session,
        params: { id: owner.project.id },
      }),
    )
    const listed = await expectMatchesContract(listRes, budgetContracts.listEntries.output)
    expect(listed.items.map((item) => item.id)).toContain(entry.id)
  })

  it('returns 422 for unknown categoryId', async () => {
    const owner = await seedOwner()
    await putBudget(owner)

    const res = await POST(
      buildRequest({
        method: 'POST',
        path: `/api/projects/${owner.project.id}/budget/entries`,
        session: owner.session,
        params: { id: owner.project.id },
        body: { amount: 100, categoryId: 'cat_missing' },
      }),
    )
    expect(res.status).toBe(422)
  })
})
