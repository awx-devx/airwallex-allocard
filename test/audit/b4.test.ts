/**
 * B4.14 — one audit assertion per mutating B4 endpoint.
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { POST as DECIDE } from '@/app/api/budget/change-requests/[id]/decide/route'
import {
  DELETE as DELETE_CATEGORY,
  PATCH as UPDATE_CATEGORY,
} from '@/app/api/projects/[id]/budget/categories/[catId]/route'
import { POST as CREATE_CATEGORY } from '@/app/api/projects/[id]/budget/categories/route'
import {
  GET as LIST_CRS,
  POST as CREATE_CR,
} from '@/app/api/projects/[id]/budget/change-requests/route'
import { POST as CREATE_ENTRY } from '@/app/api/projects/[id]/budget/entries/route'
import { PUT as PUT_BUDGET } from '@/app/api/projects/[id]/budget/route'
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
import { OrgRole } from '@/shared/enums/orgRole'
import { useTestDb } from '../helpers/db'
import { buildRequest, installTestSessionResolver, readBody } from '../helpers/request'

async function findAudits(filter: { orgId: string; action: string; subjectId?: string }) {
  return AuditLogModel.find({ ...filter }).exec()
}

describe('audit/b4', () => {
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
      name: 'Audit B4 Org',
      slug: `ab4-${Date.now()}-${Math.random().toString(16).slice(2)}`,
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
      name: 'Audit Budget',
      code: `AB4-${Date.now()}`,
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
    return res
  }

  it('PUT budget writes budget.created then budget.updated', async () => {
    const owner = await seedOwner()

    await putBudget(owner, 50_000)
    const created = await findAudits({
      orgId: owner.org.id,
      action: 'budget.created',
    })
    expect(created).toHaveLength(1)
    expect(created[0]?.actorId).toBe(owner.user.id)
    expect(created[0]?.subjectType).toBe('budget')

    await putBudget(owner, 60_000)
    const updated = await findAudits({
      orgId: owner.org.id,
      action: 'budget.updated',
    })
    expect(updated).toHaveLength(1)
    expect(updated[0]?.actorId).toBe(owner.user.id)
  })

  it('category CUD writes created/updated/deleted audits', async () => {
    const owner = await seedOwner()
    await putBudget(owner)

    const createRes = await CREATE_CATEGORY(
      buildRequest({
        method: 'POST',
        path: `/api/projects/${owner.project.id}/budget/categories`,
        session: owner.session,
        params: { id: owner.project.id },
        body: { name: 'Media', allocated: 1_000 },
      }),
    )
    expect(createRes.status).toBe(201)
    const category = await readBody<{ id: string }>(createRes)

    const created = await findAudits({
      orgId: owner.org.id,
      action: 'budget.category_created',
      subjectId: category.id,
    })
    expect(created).toHaveLength(1)

    const patchRes = await UPDATE_CATEGORY(
      buildRequest({
        method: 'PATCH',
        path: `/api/projects/${owner.project.id}/budget/categories/${category.id}`,
        session: owner.session,
        params: { id: owner.project.id, catId: category.id },
        body: { name: 'Media+', allocated: 2_000 },
      }),
    )
    expect(patchRes.status).toBe(200)
    const updated = await findAudits({
      orgId: owner.org.id,
      action: 'budget.category_updated',
      subjectId: category.id,
    })
    expect(updated).toHaveLength(1)

    const deleteRes = await DELETE_CATEGORY(
      buildRequest({
        method: 'DELETE',
        path: `/api/projects/${owner.project.id}/budget/categories/${category.id}`,
        session: owner.session,
        params: { id: owner.project.id, catId: category.id },
      }),
    )
    expect(deleteRes.status).toBe(204)
    const deleted = await findAudits({
      orgId: owner.org.id,
      action: 'budget.category_deleted',
      subjectId: category.id,
    })
    expect(deleted).toHaveLength(1)
  })

  it('POST entry writes budget.entry_created', async () => {
    const owner = await seedOwner()
    await putBudget(owner)

    const res = await CREATE_ENTRY(
      buildRequest({
        method: 'POST',
        path: `/api/projects/${owner.project.id}/budget/entries`,
        session: owner.session,
        params: { id: owner.project.id },
        body: { amount: -100, note: 'tweak' },
      }),
    )
    expect(res.status).toBe(201)
    const entry = await readBody<{ id: string }>(res)

    const audits = await findAudits({
      orgId: owner.org.id,
      action: 'budget.entry_created',
      subjectId: entry.id,
    })
    expect(audits).toHaveLength(1)
    expect(audits[0]?.actorId).toBe(owner.user.id)
  })

  it('change-request create and decide write audits', async () => {
    const owner = await seedOwner()
    await putBudget(owner)

    const createRes = await CREATE_CR(
      buildRequest({
        method: 'POST',
        path: `/api/projects/${owner.project.id}/budget/change-requests`,
        session: owner.session,
        params: { id: owner.project.id },
        body: { deltaAmount: 5_000, reason: 'more media' },
      }),
    )
    expect(createRes.status).toBe(201)
    const cr = await readBody<{ id: string }>(createRes)

    const created = await findAudits({
      orgId: owner.org.id,
      action: 'budget.change_request_created',
      subjectId: cr.id,
    })
    expect(created).toHaveLength(1)

    const decideRes = await DECIDE(
      buildRequest({
        method: 'POST',
        path: `/api/budget/change-requests/${cr.id}/decide`,
        session: owner.session,
        params: { id: cr.id },
        body: { decision: 'APPROVE' },
      }),
    )
    expect(decideRes.status).toBe(200)

    const decided = await findAudits({
      orgId: owner.org.id,
      action: 'budget.change_request_decided',
      subjectId: cr.id,
    })
    expect(decided).toHaveLength(1)
    expect(decided[0]?.metadata).toMatchObject({ decision: 'APPROVE' })

    // Sanity: list still works after decide
    const listed = await LIST_CRS(
      buildRequest({
        method: 'GET',
        path: `/api/projects/${owner.project.id}/budget/change-requests`,
        session: owner.session,
        params: { id: owner.project.id },
      }),
    )
    expect(listed.status).toBe(200)
  })
})
