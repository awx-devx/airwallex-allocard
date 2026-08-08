import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { GET } from '@/app/api/projects/[id]/access-history/route'
import { POST as ADD_MEMBER } from '@/app/api/projects/[id]/members/route'
import { DELETE as REMOVE_MEMBER } from '@/app/api/projects/[id]/members/[userId]/route'
import { AuditLogModel } from '@/server/models/AuditLog'
import { MembershipModel } from '@/server/models/Membership'
import { OrganizationModel } from '@/server/models/Organization'
import { ProjectMemberModel } from '@/server/models/ProjectMember'
import { ProjectModel } from '@/server/models/Project'
import { RoleModel } from '@/server/models/Role'
import { UserModel } from '@/server/models/User'
import * as memberships from '@/server/repositories/memberships'
import * as organizations from '@/server/repositories/organizations'
import * as projectsRepo from '@/server/repositories/projects'
import * as rolesRepo from '@/server/repositories/roles'
import * as users from '@/server/repositories/users'
import { seedRoleTemplates } from '@/server/services/organizations/seedRoleTemplates'
import { projectMemberContracts } from '@/shared/contracts/projectMember'
import { AccessScopeLevel } from '@/shared/enums/accessScopeLevel'
import { ErrorCode } from '@/shared/enums/errors'
import { OrgRole } from '@/shared/enums/orgRole'
import { expectMatchesContract } from '../helpers/contract'
import { useTestDb } from '../helpers/db'
import { buildRequest, installTestSessionResolver, readBody } from '../helpers/request'

describe('/api/projects/:id/access-history', () => {
  useTestDb()

  beforeAll(async () => {
    await Promise.all([
      UserModel.syncIndexes(),
      OrganizationModel.syncIndexes(),
      MembershipModel.syncIndexes(),
      ProjectModel.syncIndexes(),
      RoleModel.syncIndexes(),
      ProjectMemberModel.syncIndexes(),
      AuditLogModel.syncIndexes(),
    ])
  })

  beforeEach(() => {
    vi.spyOn(console, 'info').mockImplementation(() => {})
  })

  afterEach(() => {
    installTestSessionResolver()
    vi.restoreAllMocks()
  })

  async function seedOwnerWithProject() {
    const user = await users.createUser({
      email: `owner-${Date.now()}-${Math.random().toString(16).slice(2)}@example.com`,
      name: 'Owner',
    })
    const org = await organizations.createOrganization({
      name: 'History Org',
      slug: `org-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      country: 'US',
      baseCurrency: 'USD',
      createdBy: user.id,
    })
    const ctx = { orgId: org.id, userId: user.id, orgRole: OrgRole.OWNER }
    await memberships.createMembership(ctx, { userId: user.id, orgRole: OrgRole.OWNER })
    await seedRoleTemplates(org.id)
    const project = await projectsRepo.createProject(ctx, {
      name: 'APAC',
      code: `AH-${Date.now().toString(16)}`,
    })
    const viewer = await rolesRepo.findRoleByKey(ctx, 'viewer')
    expect(viewer).not.toBeNull()
    return {
      org,
      project,
      viewer: viewer!,
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
        path: '/api/projects/x/access-history',
        session: null,
        params: { id: '507f1f77bcf86cd799439011' },
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
        path: `/api/projects/${a.project.id}/access-history`,
        session: b.session,
        params: { id: a.project.id },
      }),
    )
    expect(res.status).toBe(404)
  })

  it('returns membership audit entries newest first', async () => {
    const setup = await seedOwnerWithProject()
    const assignee = await users.createUser({
      email: `a-${Date.now()}@example.com`,
      name: 'Assignee',
    })
    await memberships.createMembership(
      { orgId: setup.org.id, userId: assignee.id, orgRole: OrgRole.MEMBER },
      { userId: assignee.id, orgRole: OrgRole.MEMBER },
    )

    await ADD_MEMBER(
      buildRequest({
        method: 'POST',
        path: `/api/projects/${setup.project.id}/members`,
        session: setup.session,
        params: { id: setup.project.id },
        body: {
          userId: assignee.id,
          roleId: setup.viewer.id,
          scope: { level: AccessScopeLevel.PROJECT },
        },
      }),
    )
    await REMOVE_MEMBER(
      buildRequest({
        method: 'DELETE',
        path: `/api/projects/${setup.project.id}/members/${assignee.id}`,
        session: setup.session,
        params: { id: setup.project.id, userId: assignee.id },
      }),
    )

    const res = await GET(
      buildRequest({
        method: 'GET',
        path: `/api/projects/${setup.project.id}/access-history`,
        session: setup.session,
        params: { id: setup.project.id },
      }),
    )
    expect(res.status).toBe(200)
    const body = await expectMatchesContract(res, projectMemberContracts.accessHistory.output)
    expect(body.map((e) => e.action)).toEqual(['member.removed', 'member.added'])
    expect(body.every((e) => e.subjectType === 'projectMember')).toBe(true)
  })

  it('returns 403 for MEMBER without elevated access', async () => {
    const setup = await seedOwnerWithProject()
    const member = await users.createUser({
      email: `m-${Date.now()}@example.com`,
      name: 'Member',
    })
    await memberships.createMembership(
      { orgId: setup.org.id, userId: member.id, orgRole: OrgRole.MEMBER },
      { userId: member.id, orgRole: OrgRole.MEMBER },
    )
    const res = await GET(
      buildRequest({
        method: 'GET',
        path: `/api/projects/${setup.project.id}/access-history`,
        session: {
          userId: member.id,
          orgId: setup.org.id,
          orgRole: OrgRole.MEMBER,
          onboarded: true,
        },
        params: { id: setup.project.id },
      }),
    )
    expect(res.status).toBe(403)
    expect((await readBody<{ error: { code: string } }>(res)).error.code).toBe(
      ErrorCode.PERMISSION_DENIED,
    )
  })
})
