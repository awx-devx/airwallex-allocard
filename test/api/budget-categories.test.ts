import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { DELETE, PATCH } from '@/app/api/projects/[id]/budget/categories/[catId]/route'
import { GET, POST } from '@/app/api/projects/[id]/budget/categories/route'
import { PUT as PUT_BUDGET } from '@/app/api/projects/[id]/budget/route'
import { resetEventPublisher } from '@/server/events/bus'
import { AuditLogModel } from '@/server/models/AuditLog'
import { BudgetModel } from '@/server/models/Budget'
import { BudgetEntryModel } from '@/server/models/BudgetEntry'
import { MembershipModel } from '@/server/models/Membership'
import { OrganizationModel } from '@/server/models/Organization'
import { ProjectModel } from '@/server/models/Project'
import { UserModel } from '@/server/models/User'
import * as budgetEntries from '@/server/repositories/budgetEntries'
import * as memberships from '@/server/repositories/memberships'
import * as organizations from '@/server/repositories/organizations'
import * as projectsRepo from '@/server/repositories/projects'
import * as users from '@/server/repositories/users'
import { resetRedis } from '@/server/redis'
import { budgetContracts } from '@/shared/contracts/budget'
import { BudgetEntrySourceType } from '@/shared/enums/budgetEntrySourceType'
import { BudgetEntryType } from '@/shared/enums/budgetEntryType'
import { ErrorCode } from '@/shared/enums/errors'
import { OrgRole } from '@/shared/enums/orgRole'
import type { BudgetCategory } from '@/shared/types/budget'
import { expectMatchesContract } from '../helpers/contract'
import { useTestDb } from '../helpers/db'
import { buildRequest, installTestSessionResolver, readBody } from '../helpers/request'

describe('/api/projects/:id/budget/categories', () => {
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
      name: 'Cat Org',
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
      name: 'Cat Project',
      code: `CAT-${Date.now()}`,
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

  async function putBudget(owner: Awaited<ReturnType<typeof seedOwner>>, approvedAmount = 100_000) {
    const res = await PUT_BUDGET(
      buildRequest({
        method: 'PUT',
        path: `/api/projects/${owner.project.id}/budget`,
        session: owner.session,
        params: { id: owner.project.id },
        body: { currency: 'USD', approvedAmount },
      }),
    )
    expect(res.status).toBe(200)
  }

  it('returns 401 when unauthenticated', async () => {
    const res = await GET(
      buildRequest({
        method: 'GET',
        path: '/api/projects/x/budget/categories',
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
        path: '/api/projects/x/budget/categories',
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
        path: `/api/projects/${a.project.id}/budget/categories`,
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
        path: `/api/projects/${owner.project.id}/budget/categories`,
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

  it('GET returns empty list when budget is missing', async () => {
    const owner = await seedOwner()
    const res = await GET(
      buildRequest({
        method: 'GET',
        path: `/api/projects/${owner.project.id}/budget/categories`,
        session: owner.session,
        params: { id: owner.project.id },
      }),
    )
    expect(res.status).toBe(200)
    const body = await expectMatchesContract(res, budgetContracts.listCategories.output)
    expect(body).toEqual([])
  })

  it('POST creates category; formula wins over allocated', async () => {
    const owner = await seedOwner()
    await putBudget(owner, 100_000)

    const res = await POST(
      buildRequest({
        method: 'POST',
        path: `/api/projects/${owner.project.id}/budget/categories`,
        session: owner.session,
        params: { id: owner.project.id },
        body: {
          name: 'Media',
          allocated: 1,
          formula: 'pct(approvedAmount, 10)',
        },
      }),
    )
    expect(res.status).toBe(201)
    const body = await expectMatchesContract(res, budgetContracts.createCategory.output)
    expect(body.name).toBe('Media')
    expect(body.allocated).toBe(10_000)
    expect(body.formula).toBe('pct(approvedAmount, 10)')

    const audits = await AuditLogModel.find({
      orgId: owner.org.id,
      action: 'budget.category_created',
    }).exec()
    expect(audits).toHaveLength(1)
  })

  it('rejects create when allocations exceed approvedAmount', async () => {
    const owner = await seedOwner()
    await putBudget(owner, 10_000)

    const first = await POST(
      buildRequest({
        method: 'POST',
        path: `/api/projects/${owner.project.id}/budget/categories`,
        session: owner.session,
        params: { id: owner.project.id },
        body: { name: 'A', allocated: 8_000 },
      }),
    )
    expect(first.status).toBe(201)

    const second = await POST(
      buildRequest({
        method: 'POST',
        path: `/api/projects/${owner.project.id}/budget/categories`,
        session: owner.session,
        params: { id: owner.project.id },
        body: { name: 'B', allocated: 3_000 },
      }),
    )
    expect(second.status).toBe(422)
    const body = await readBody<{ error: { code: string } }>(second)
    expect(body.error.code).toBe(ErrorCode.VALIDATION_FAILED)
  })

  it('rejects unknown workstreamId', async () => {
    const owner = await seedOwner()
    await putBudget(owner)

    const res = await POST(
      buildRequest({
        method: 'POST',
        path: `/api/projects/${owner.project.id}/budget/categories`,
        session: owner.session,
        params: { id: owner.project.id },
        body: { name: 'Ops', allocated: 100, workstreamId: 'ws_missing' },
      }),
    )
    expect(res.status).toBe(422)
  })

  it('PATCH updates category; DELETE removes unused category', async () => {
    const owner = await seedOwner()
    await putBudget(owner)
    const ws = await projectsRepo.addWorkstream(owner.ctx, owner.project.id, 'Field')

    const created = await POST(
      buildRequest({
        method: 'POST',
        path: `/api/projects/${owner.project.id}/budget/categories`,
        session: owner.session,
        params: { id: owner.project.id },
        body: { name: 'Travel', allocated: 5_000 },
      }),
    )
    const category = await expectMatchesContract(created, budgetContracts.createCategory.output)

    const patched = await PATCH(
      buildRequest({
        method: 'PATCH',
        path: `/api/projects/${owner.project.id}/budget/categories/${category.id}`,
        session: owner.session,
        params: { id: owner.project.id, catId: category.id },
        body: { name: 'Travel+Meals', workstreamId: ws!.id, allocated: 6_000 },
      }),
    )
    expect(patched.status).toBe(200)
    const updated = await expectMatchesContract(patched, budgetContracts.updateCategory.output)
    expect(updated).toMatchObject({
      name: 'Travel+Meals',
      workstreamId: ws!.id,
      allocated: 6_000,
    })

    const listed = await GET(
      buildRequest({
        method: 'GET',
        path: `/api/projects/${owner.project.id}/budget/categories`,
        session: owner.session,
        params: { id: owner.project.id },
      }),
    )
    const items = await expectMatchesContract(listed, budgetContracts.listCategories.output)
    expect(items.map((c: BudgetCategory) => c.id)).toEqual([category.id])

    const deleted = await DELETE(
      buildRequest({
        method: 'DELETE',
        path: `/api/projects/${owner.project.id}/budget/categories/${category.id}`,
        session: owner.session,
        params: { id: owner.project.id, catId: category.id },
      }),
    )
    expect(deleted.status).toBe(204)

    const after = await GET(
      buildRequest({
        method: 'GET',
        path: `/api/projects/${owner.project.id}/budget/categories`,
        session: owner.session,
        params: { id: owner.project.id },
      }),
    )
    const empty = await expectMatchesContract(after, budgetContracts.listCategories.output)
    expect(empty).toEqual([])
  })

  it('DELETE returns 409 when entries reference the category', async () => {
    const owner = await seedOwner()
    await putBudget(owner)

    const created = await POST(
      buildRequest({
        method: 'POST',
        path: `/api/projects/${owner.project.id}/budget/categories`,
        session: owner.session,
        params: { id: owner.project.id },
        body: { name: 'Locked', allocated: 1_000 },
      }),
    )
    const category = await expectMatchesContract(created, budgetContracts.createCategory.output)

    await budgetEntries.appendEntry(owner.ctx, {
      projectId: owner.project.id,
      type: BudgetEntryType.ADJUSTMENT,
      amount: 100,
      currency: 'USD',
      sourceType: BudgetEntrySourceType.MANUAL,
      sourceId: 'manual_1',
      createdBy: owner.user.id,
      categoryId: category.id,
    })

    const deleted = await DELETE(
      buildRequest({
        method: 'DELETE',
        path: `/api/projects/${owner.project.id}/budget/categories/${category.id}`,
        session: owner.session,
        params: { id: owner.project.id, catId: category.id },
      }),
    )
    expect(deleted.status).toBe(409)
    const body = await readBody<{ error: { code: string } }>(deleted)
    expect(body.error.code).toBe(ErrorCode.CONFLICT)
  })
})
