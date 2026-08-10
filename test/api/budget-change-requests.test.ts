import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { POST as DECIDE } from '@/app/api/budget/change-requests/[id]/decide/route'
import { GET, POST } from '@/app/api/projects/[id]/budget/change-requests/route'
import { PUT as PUT_BUDGET } from '@/app/api/projects/[id]/budget/route'
import { GET as GET_BUDGET } from '@/app/api/projects/[id]/budget/route'
import { resetEventPublisher } from '@/server/events/bus'
import { AuditLogModel } from '@/server/models/AuditLog'
import { BudgetModel } from '@/server/models/Budget'
import { BudgetChangeRequestModel } from '@/server/models/BudgetChangeRequest'
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
import { BudgetChangeRequestStatus } from '@/shared/enums/budgetChangeRequestStatus'
import { BudgetEntryType } from '@/shared/enums/budgetEntryType'
import { ErrorCode } from '@/shared/enums/errors'
import { OrgRole } from '@/shared/enums/orgRole'
import { expectMatchesContract } from '../helpers/contract'
import { useTestDb } from '../helpers/db'
import { buildRequest, installTestSessionResolver, readBody } from '../helpers/request'

describe('/api/projects/:id/budget/change-requests', () => {
  useTestDb()

  beforeAll(async () => {
    await Promise.all([
      UserModel.syncIndexes(),
      OrganizationModel.syncIndexes(),
      MembershipModel.syncIndexes(),
      ProjectModel.syncIndexes(),
      BudgetModel.syncIndexes(),
      BudgetEntryModel.syncIndexes(),
      BudgetChangeRequestModel.syncIndexes(),
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
      name: 'CR Org',
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
      name: 'CR Project',
      code: `CR-${Date.now()}`,
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

  // Matrix #1
  it('returns 401 when unauthenticated', async () => {
    const res = await GET(
      buildRequest({
        method: 'GET',
        path: '/api/projects/x/budget/change-requests',
        session: null,
        params: { id: 'x' },
      }),
    )
    expect(res.status).toBe(401)
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
        path: '/api/projects/x/budget/change-requests',
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
        path: `/api/projects/${a.project.id}/budget/change-requests`,
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
        path: `/api/projects/${owner.project.id}/budget/change-requests`,
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

  // Matrix #4 (mutate)
  it('returns 403 when the caller lacks budget.request on create', async () => {
    const owner = await seedOwner()
    await putBudget(owner)
    const member = await users.createUser({
      email: `m-${Date.now()}@example.com`,
      name: 'Member',
    })
    await memberships.createMembership(
      { orgId: owner.org.id, userId: member.id, orgRole: OrgRole.MEMBER },
      { userId: member.id, orgRole: OrgRole.MEMBER },
    )

    const res = await POST(
      buildRequest({
        method: 'POST',
        path: `/api/projects/${owner.project.id}/budget/change-requests`,
        session: {
          userId: member.id,
          orgId: owner.org.id,
          orgRole: OrgRole.MEMBER,
          onboarded: true,
        },
        params: { id: owner.project.id },
        body: { deltaAmount: 1_000, reason: 'nope' },
      }),
    )
    expect(res.status).toBe(403)
  })

  // Matrix #6
  it('returns 422 on invalid create payload', async () => {
    const owner = await seedOwner()
    await putBudget(owner)
    const res = await POST(
      buildRequest({
        method: 'POST',
        path: `/api/projects/${owner.project.id}/budget/change-requests`,
        session: owner.session,
        params: { id: owner.project.id },
        body: { deltaAmount: 0, reason: 'zero' },
      }),
    )
    expect(res.status).toBe(422)
  })

  it('create PENDING, list, approve appends ADJUSTMENT, reject decides only', async () => {
    const owner = await seedOwner()
    await putBudget(owner, 100_000)

    const createRes = await POST(
      buildRequest({
        method: 'POST',
        path: `/api/projects/${owner.project.id}/budget/change-requests`,
        session: owner.session,
        params: { id: owner.project.id },
        body: { deltaAmount: 25_000, reason: 'Need more media spend' },
      }),
    )
    expect(createRes.status).toBe(201)
    const created = await expectMatchesContract(
      createRes,
      budgetContracts.createChangeRequest.output,
    )
    expect(created.status).toBe(BudgetChangeRequestStatus.PENDING)
    expect(created.deltaAmount).toBe(25_000)

    const listRes = await GET(
      buildRequest({
        method: 'GET',
        path: `/api/projects/${owner.project.id}/budget/change-requests`,
        session: owner.session,
        params: { id: owner.project.id },
      }),
    )
    const listed = await expectMatchesContract(listRes, budgetContracts.listChangeRequests.output)
    expect(listed.map((item) => item.id)).toContain(created.id)

    const approveRes = await DECIDE(
      buildRequest({
        method: 'POST',
        path: `/api/budget/change-requests/${created.id}/decide`,
        session: owner.session,
        params: { id: created.id },
        body: { decision: 'APPROVE', note: 'ok' },
      }),
    )
    expect(approveRes.status).toBe(200)
    const approved = await expectMatchesContract(
      approveRes,
      budgetContracts.decideChangeRequest.output,
    )
    expect(approved.status).toBe(BudgetChangeRequestStatus.APPROVED)
    expect(approved.decidedBy).toBe(owner.user.id)
    expect(approved.decidedAt).not.toBeNull()

    const budgetRes = await GET_BUDGET(
      buildRequest({
        method: 'GET',
        path: `/api/projects/${owner.project.id}/budget`,
        session: owner.session,
        params: { id: owner.project.id },
      }),
    )
    const detail = await expectMatchesContract(budgetRes, budgetContracts.get.output)
    expect(detail.budget?.approvedAmount).toBe(125_000)
    expect(detail.projection.approved).toBe(125_000)

    const entries = await BudgetEntryModel.find({
      orgId: owner.org.id,
      projectId: owner.project.id,
      type: BudgetEntryType.ADJUSTMENT,
      sourceId: created.id,
    }).exec()
    expect(entries).toHaveLength(1)
    expect(entries[0]!.amount).toBe(25_000)

    const rejectCreate = await POST(
      buildRequest({
        method: 'POST',
        path: `/api/projects/${owner.project.id}/budget/change-requests`,
        session: owner.session,
        params: { id: owner.project.id },
        body: { deltaAmount: -1_000, reason: 'too much' },
      }),
    )
    const toReject = await expectMatchesContract(
      rejectCreate,
      budgetContracts.createChangeRequest.output,
    )

    const rejectRes = await DECIDE(
      buildRequest({
        method: 'POST',
        path: `/api/budget/change-requests/${toReject.id}/decide`,
        session: owner.session,
        params: { id: toReject.id },
        body: { decision: 'REJECT' },
      }),
    )
    const rejected = await expectMatchesContract(
      rejectRes,
      budgetContracts.decideChangeRequest.output,
    )
    expect(rejected.status).toBe(BudgetChangeRequestStatus.REJECTED)

    const afterReject = await GET_BUDGET(
      buildRequest({
        method: 'GET',
        path: `/api/projects/${owner.project.id}/budget`,
        session: owner.session,
        params: { id: owner.project.id },
      }),
    )
    const afterDetail = await expectMatchesContract(afterReject, budgetContracts.get.output)
    expect(afterDetail.budget?.approvedAmount).toBe(125_000)
  })

  it('concurrent double-decide → one wins, other 409', async () => {
    const owner = await seedOwner()
    await putBudget(owner)

    const createRes = await POST(
      buildRequest({
        method: 'POST',
        path: `/api/projects/${owner.project.id}/budget/change-requests`,
        session: owner.session,
        params: { id: owner.project.id },
        body: { deltaAmount: 5_000, reason: 'race' },
      }),
    )
    const created = await expectMatchesContract(
      createRes,
      budgetContracts.createChangeRequest.output,
    )

    const [a, b] = await Promise.all([
      DECIDE(
        buildRequest({
          method: 'POST',
          path: `/api/budget/change-requests/${created.id}/decide`,
          session: owner.session,
          params: { id: created.id },
          body: { decision: 'APPROVE' },
        }),
      ),
      DECIDE(
        buildRequest({
          method: 'POST',
          path: `/api/budget/change-requests/${created.id}/decide`,
          session: owner.session,
          params: { id: created.id },
          body: { decision: 'REJECT' },
        }),
      ),
    ])

    const statuses = [a.status, b.status].sort()
    expect(statuses).toEqual([200, 409])
    const conflict = a.status === 409 ? a : b
    const body = await readBody<{ error: { code: string } }>(conflict)
    expect(body.error.code).toBe(ErrorCode.CONFLICT)
  })

  describe('/api/budget/change-requests/:id/decide', () => {
    async function createPending(owner: Awaited<ReturnType<typeof seedOwner>>) {
      await putBudget(owner)
      const createRes = await POST(
        buildRequest({
          method: 'POST',
          path: `/api/projects/${owner.project.id}/budget/change-requests`,
          session: owner.session,
          params: { id: owner.project.id },
          body: { deltaAmount: 1_000, reason: 'decide matrix' },
        }),
      )
      return expectMatchesContract(createRes, budgetContracts.createChangeRequest.output)
    }

    // Matrix #1
    it('returns 401 when unauthenticated', async () => {
      const res = await DECIDE(
        buildRequest({
          method: 'POST',
          path: '/api/budget/change-requests/x/decide',
          session: null,
          params: { id: 'x' },
          body: { decision: 'APPROVE' },
        }),
      )
      expect(res.status).toBe(401)
    })

    // Matrix #2
    it('returns 403 when onboarding is incomplete', async () => {
      const user = await users.createUser({
        email: `u-${Date.now()}@example.com`,
        name: 'U',
      })
      const res = await DECIDE(
        buildRequest({
          method: 'POST',
          path: '/api/budget/change-requests/x/decide',
          session: { userId: user.id, orgId: null, orgRole: null, onboarded: false },
          params: { id: 'x' },
          body: { decision: 'APPROVE' },
        }),
      )
      expect(res.status).toBe(403)
      const body = await readBody<{ error: { code: string } }>(res)
      expect(body.error.code).toBe(ErrorCode.ONBOARDING_INCOMPLETE)
    })

    // Matrix #3
    it('returns 404 for cross-org change request', async () => {
      const a = await seedOwner()
      const b = await seedOwner()
      const pending = await createPending(a)

      const res = await DECIDE(
        buildRequest({
          method: 'POST',
          path: `/api/budget/change-requests/${pending.id}/decide`,
          session: b.session,
          params: { id: pending.id },
          body: { decision: 'APPROVE' },
        }),
      )
      expect(res.status).toBe(404)
    })

    // Matrix #4
    it('returns 403 when the caller lacks budget.edit', async () => {
      const owner = await seedOwner()
      const pending = await createPending(owner)
      const member = await users.createUser({
        email: `m-${Date.now()}@example.com`,
        name: 'Member',
      })
      await memberships.createMembership(
        { orgId: owner.org.id, userId: member.id, orgRole: OrgRole.MEMBER },
        { userId: member.id, orgRole: OrgRole.MEMBER },
      )

      const res = await DECIDE(
        buildRequest({
          method: 'POST',
          path: `/api/budget/change-requests/${pending.id}/decide`,
          session: {
            userId: member.id,
            orgId: owner.org.id,
            orgRole: OrgRole.MEMBER,
            onboarded: true,
          },
          params: { id: pending.id },
          body: { decision: 'APPROVE' },
        }),
      )
      expect(res.status).toBe(403)
    })

    // Matrix #6
    it('returns 422 on invalid decide payload', async () => {
      const owner = await seedOwner()
      const pending = await createPending(owner)
      const res = await DECIDE(
        buildRequest({
          method: 'POST',
          path: `/api/budget/change-requests/${pending.id}/decide`,
          session: owner.session,
          params: { id: pending.id },
          body: { decision: 'MAYBE' },
        }),
      )
      expect(res.status).toBe(422)
    })
  })
})
