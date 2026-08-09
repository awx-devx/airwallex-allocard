import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { GET } from '@/app/api/projects/[id]/budget/history/route'
import { PUT as PUT_BUDGET } from '@/app/api/projects/[id]/budget/route'
import { POST as POST_CATEGORY } from '@/app/api/projects/[id]/budget/categories/route'
import { resetEventPublisher } from '@/server/events/bus'
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
import { audit } from '@/server/services/audit/log'
import { resetRedis } from '@/server/redis'
import { budgetContracts } from '@/shared/contracts/budget'
import { ActorType } from '@/shared/enums/audit'
import { ErrorCode } from '@/shared/enums/errors'
import { OrgRole } from '@/shared/enums/orgRole'
import { expectMatchesContract } from '../helpers/contract'
import { useTestDb } from '../helpers/db'
import { buildRequest, installTestSessionResolver, readBody } from '../helpers/request'

describe('/api/projects/:id/budget/history', () => {
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
      name: 'Hist Org',
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
      name: 'Hist Project',
      code: `BH-${Date.now()}`,
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

  it('returns 401 when unauthenticated', async () => {
    const res = await GET(
      buildRequest({
        method: 'GET',
        path: '/api/projects/x/budget/history',
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
        path: '/api/projects/x/budget/history',
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
        path: `/api/projects/${a.project.id}/budget/history`,
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
        path: `/api/projects/${owner.project.id}/budget/history`,
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

  it('returns budget audits newest first and excludes non-budget actions', async () => {
    const owner = await seedOwner()

    await PUT_BUDGET(
      buildRequest({
        method: 'PUT',
        path: `/api/projects/${owner.project.id}/budget`,
        session: owner.session,
        params: { id: owner.project.id },
        body: { currency: 'USD', approvedAmount: 50_000 },
      }),
    )

    await POST_CATEGORY(
      buildRequest({
        method: 'POST',
        path: `/api/projects/${owner.project.id}/budget/categories`,
        session: owner.session,
        params: { id: owner.project.id },
        body: { name: 'Media', allocated: 1_000 },
      }),
    )

    await audit(owner.ctx, {
      action: 'project.updated',
      subjectType: 'project',
      subjectId: owner.project.id,
      projectId: owner.project.id,
      actorType: ActorType.USER,
      actorId: owner.user.id,
      after: { name: 'noise' },
    })

    const res = await GET(
      buildRequest({
        method: 'GET',
        path: `/api/projects/${owner.project.id}/budget/history`,
        session: owner.session,
        params: { id: owner.project.id },
      }),
    )
    expect(res.status).toBe(200)
    const body = await expectMatchesContract(res, budgetContracts.history.output)
    expect(body.length).toBeGreaterThanOrEqual(2)
    expect(body.every((item) => item.action.startsWith('budget.'))).toBe(true)
    expect(body.some((item) => item.action === 'project.updated')).toBe(false)

    const times = body.map((item) => Date.parse(item.at))
    for (let i = 1; i < times.length; i++) {
      expect(times[i - 1]!).toBeGreaterThanOrEqual(times[i]!)
    }
  })
})
