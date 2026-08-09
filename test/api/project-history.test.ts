import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { GET } from '@/app/api/projects/[id]/history/route'
import { PATCH as UPDATE_PROJECT } from '@/app/api/projects/[id]/route'
import { POST as TRANSITION } from '@/app/api/projects/[id]/transition/route'
import { AuditLogModel } from '@/server/models/AuditLog'
import { MembershipModel } from '@/server/models/Membership'
import { OrganizationModel } from '@/server/models/Organization'
import { ProjectModel } from '@/server/models/Project'
import { UserModel } from '@/server/models/User'
import * as budgets from '@/server/repositories/budgets'
import * as memberships from '@/server/repositories/memberships'
import * as organizations from '@/server/repositories/organizations'
import * as projectsRepo from '@/server/repositories/projects'
import * as users from '@/server/repositories/users'
import { projectContracts } from '@/shared/contracts/project'
import { OrgRole } from '@/shared/enums/orgRole'
import { ProjectStatus } from '@/shared/enums/projectStatus'
import { expectMatchesContract } from '../helpers/contract'
import { useTestDb } from '../helpers/db'
import { buildRequest, installTestSessionResolver } from '../helpers/request'

describe('/api/projects/:id/history', () => {
  useTestDb()

  beforeAll(async () => {
    await Promise.all([
      UserModel.syncIndexes(),
      OrganizationModel.syncIndexes(),
      MembershipModel.syncIndexes(),
      ProjectModel.syncIndexes(),
      AuditLogModel.syncIndexes(),
    ])
  })

  afterEach(() => {
    installTestSessionResolver()
  })

  async function seedOwnerWithProject() {
    const owner = await users.createUser({
      email: `owner-${Date.now()}-${Math.random().toString(16).slice(2)}@example.com`,
      name: 'Owner',
    })
    const org = await organizations.createOrganization({
      name: 'History Org',
      slug: `org-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      country: 'US',
      baseCurrency: 'USD',
      createdBy: owner.id,
    })
    await memberships.createMembership(
      { orgId: org.id, userId: owner.id, orgRole: OrgRole.OWNER },
      { userId: owner.id, orgRole: OrgRole.OWNER },
    )
    const ctx = { orgId: org.id, userId: owner.id, orgRole: OrgRole.OWNER }
    const project = await projectsRepo.createProject(ctx, {
      name: 'Hist',
      code: `HIST-${Date.now()}`,
      ownerId: owner.id,
      startDate: new Date('2026-01-01T00:00:00.000Z'),
      endDate: new Date('2026-12-31T00:00:00.000Z'),
    })
    return {
      owner,
      org,
      ctx,
      project,
      session: {
        userId: owner.id,
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
        path: '/api/projects/x/history',
        session: null,
        params: { id: 'x' },
      }),
    )
    expect(res.status).toBe(401)
  })

  it('returns 404 for a project in another org', async () => {
    const a = await seedOwnerWithProject()
    const b = await seedOwnerWithProject()
    const res = await GET(
      buildRequest({
        method: 'GET',
        path: `/api/projects/${a.project.id}/history`,
        session: b.session,
        params: { id: a.project.id },
      }),
    )
    expect(res.status).toBe(404)
  })

  it('returns status and field-change history newest first', async () => {
    const { session, project, ctx } = await seedOwnerWithProject()
    await budgets.upsertBudgetFields(ctx, project.id, {
      currency: 'USD',
      approvedAmount: 100_000,
    })

    await UPDATE_PROJECT(
      buildRequest({
        method: 'PATCH',
        path: `/api/projects/${project.id}`,
        session,
        params: { id: project.id },
        body: { description: 'Updated' },
      }),
    )
    await TRANSITION(
      buildRequest({
        method: 'POST',
        path: `/api/projects/${project.id}/transition`,
        session,
        params: { id: project.id },
        body: { to: ProjectStatus.PENDING_APPROVAL },
      }),
    )

    const res = await GET(
      buildRequest({
        method: 'GET',
        path: `/api/projects/${project.id}/history`,
        session,
        params: { id: project.id },
      }),
    )
    expect(res.status).toBe(200)
    const history = await expectMatchesContract(res, projectContracts.history.output)
    expect(history.length).toBeGreaterThanOrEqual(2)
    expect(history.map((h) => h.action)).toEqual(
      expect.arrayContaining(['project.updated', 'project.transitioned']),
    )
    // Newest first
    for (let i = 1; i < history.length; i += 1) {
      expect(history[i - 1]!.at >= history[i]!.at).toBe(true)
    }
  })

  it('returns 403 when lacking project.view', async () => {
    const { project, org } = await seedOwnerWithProject()
    const member = await users.createUser({
      email: `mem-${Date.now()}@example.com`,
      name: 'Member',
    })
    await memberships.createMembership(
      { orgId: org.id, userId: member.id, orgRole: OrgRole.MEMBER },
      { userId: member.id, orgRole: OrgRole.MEMBER },
    )

    const res = await GET(
      buildRequest({
        method: 'GET',
        path: `/api/projects/${project.id}/history`,
        session: {
          userId: member.id,
          orgId: org.id,
          orgRole: OrgRole.MEMBER,
          onboarded: true,
        },
        params: { id: project.id },
      }),
    )
    expect(res.status).toBe(403)
  })
})
