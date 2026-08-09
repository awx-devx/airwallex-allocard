import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { GET, PUT } from '@/app/api/projects/[id]/budget/route'
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
import { budgetContracts } from '@/shared/contracts/budget'
import { ErrorCode } from '@/shared/enums/errors'
import { OrgRole } from '@/shared/enums/orgRole'
import { expectMatchesContract } from '../helpers/contract'
import { useTestDb } from '../helpers/db'
import { buildRequest, installTestSessionResolver, readBody } from '../helpers/request'

describe('/api/projects/:id/budget', () => {
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
      name: 'Budget Org',
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
      name: 'Budget Project',
      code: `BUD-${Date.now()}`,
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

  // Matrix #1
  it('returns 401 when unauthenticated', async () => {
    const res = await GET(
      buildRequest({
        method: 'GET',
        path: '/api/projects/x/budget',
        session: null,
        params: { id: 'x' },
      }),
    )
    expect(res.status).toBe(401)
    const body = await readBody<{ error: { code: string } }>(res)
    expect(body.error.code).toBe(ErrorCode.UNAUTHENTICATED)
  })

  // Matrix #2
  it('returns 403 when onboarding is incomplete', async () => {
    const user = await users.createUser({
      email: `u-${Date.now()}@example.com`,
      name: 'U',
    })
    const res = await GET(
      buildRequest({
        method: 'GET',
        path: '/api/projects/x/budget',
        session: { userId: user.id, orgId: null, orgRole: null, onboarded: false },
        params: { id: 'x' },
      }),
    )
    expect(res.status).toBe(403)
    const body = await readBody<{ error: { code: string } }>(res)
    expect(body.error.code).toBe(ErrorCode.ONBOARDING_INCOMPLETE)
  })

  // Matrix #3
  it('returns 404 for cross-org project access', async () => {
    const a = await seedOwner()
    const b = await seedOwner()

    const res = await GET(
      buildRequest({
        method: 'GET',
        path: `/api/projects/${a.project.id}/budget`,
        session: b.session,
        params: { id: a.project.id },
      }),
    )
    expect(res.status).toBe(404)
  })

  // Matrix #4
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
        path: `/api/projects/${owner.project.id}/budget`,
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

  // Matrix #6
  it('returns 422 on invalid PUT payload', async () => {
    const owner = await seedOwner()
    const res = await PUT(
      buildRequest({
        method: 'PUT',
        path: `/api/projects/${owner.project.id}/budget`,
        session: owner.session,
        params: { id: owner.project.id },
        body: { currency: 'US', approvedAmount: -1 },
      }),
    )
    expect(res.status).toBe(422)
  })

  // Matrix #7
  it('GET returns null budget + zero projection before PUT', async () => {
    const owner = await seedOwner()
    const res = await GET(
      buildRequest({
        method: 'GET',
        path: `/api/projects/${owner.project.id}/budget`,
        session: owner.session,
        params: { id: owner.project.id },
      }),
    )
    expect(res.status).toBe(200)
    const body = await expectMatchesContract(res, budgetContracts.get.output)
    expect(body.budget).toBeNull()
    expect(body.projection).toMatchObject({
      approved: 0,
      committed: 0,
      actual: 0,
      remaining: 0,
      utilisationPct: 0,
      overCommitted: false,
    })
  })

  it('PUT creates budget, appends APPROVAL, and GET returns detail', async () => {
    const owner = await seedOwner()

    const putRes = await PUT(
      buildRequest({
        method: 'PUT',
        path: `/api/projects/${owner.project.id}/budget`,
        session: owner.session,
        params: { id: owner.project.id },
        body: { currency: 'USD', approvedAmount: 100_000, thresholdPcts: [80, 100] },
      }),
    )
    expect(putRes.status).toBe(200)
    const putBody = await expectMatchesContract(putRes, budgetContracts.put.output)
    expect(putBody.budget).toMatchObject({
      currency: 'USD',
      approvedAmount: 100_000,
      thresholdPcts: [80, 100],
    })
    expect(putBody.projection.approved).toBe(100_000)
    expect(putBody.projection.remaining).toBe(100_000)

    const getRes = await GET(
      buildRequest({
        method: 'GET',
        path: `/api/projects/${owner.project.id}/budget`,
        session: owner.session,
        params: { id: owner.project.id },
      }),
    )
    const getBody = await expectMatchesContract(getRes, budgetContracts.get.output)
    expect(getBody.budget?.id).toBe(putBody.budget?.id)
    expect(getBody.projection.approved).toBe(100_000)

    expect(getPublishedEvents().some((e) => e.type === DomainEventType.BUDGET_APPROVED)).toBe(true)

    const audits = await AuditLogModel.find({
      orgId: owner.org.id,
      action: 'budget.created',
    }).exec()
    expect(audits).toHaveLength(1)
  })

  it('PUT increase appends APPROVAL delta; decrease uses ADJUSTMENT', async () => {
    const owner = await seedOwner()

    await PUT(
      buildRequest({
        method: 'PUT',
        path: `/api/projects/${owner.project.id}/budget`,
        session: owner.session,
        params: { id: owner.project.id },
        body: { currency: 'USD', approvedAmount: 100_000 },
      }),
    )

    const up = await PUT(
      buildRequest({
        method: 'PUT',
        path: `/api/projects/${owner.project.id}/budget`,
        session: owner.session,
        params: { id: owner.project.id },
        body: { currency: 'USD', approvedAmount: 150_000 },
      }),
    )
    const upBody = await expectMatchesContract(up, budgetContracts.put.output)
    expect(upBody.projection.approved).toBe(150_000)

    const down = await PUT(
      buildRequest({
        method: 'PUT',
        path: `/api/projects/${owner.project.id}/budget`,
        session: owner.session,
        params: { id: owner.project.id },
        body: { currency: 'USD', approvedAmount: 120_000 },
      }),
    )
    const downBody = await expectMatchesContract(down, budgetContracts.put.output)
    expect(downBody.projection.approved).toBe(120_000)
    expect(downBody.budget?.approvedAmount).toBe(120_000)
  })
})
