import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { GET } from '@/app/api/me/permissions/route'
import { POST as ADD_MEMBER } from '@/app/api/projects/[id]/members/route'
import { ALL_PERMISSIONS } from '@/shared/constants/roleTemplates'
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
import { mePermissionsContracts } from '@/shared/contracts/mePermissions'
import { AccessScopeLevel } from '@/shared/enums/accessScopeLevel'
import { ErrorCode } from '@/shared/enums/errors'
import { OrgRole } from '@/shared/enums/orgRole'
import { expectMatchesContract } from '../helpers/contract'
import { useTestDb } from '../helpers/db'
import { buildRequest, installTestSessionResolver, readBody } from '../helpers/request'

describe('/api/me/permissions', () => {
  useTestDb()

  beforeAll(async () => {
    await Promise.all([
      UserModel.syncIndexes(),
      OrganizationModel.syncIndexes(),
      MembershipModel.syncIndexes(),
      ProjectModel.syncIndexes(),
      RoleModel.syncIndexes(),
      ProjectMemberModel.syncIndexes(),
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
      name: 'Perms Org',
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
      code: `MP-${Date.now().toString(16)}`,
    })
    return {
      user,
      org,
      project,
      ctx,
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
      buildRequest({ method: 'GET', path: '/api/me/permissions', session: null }),
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
        path: '/api/me/permissions',
        session: { userId: user.id, orgId: null, orgRole: null, onboarded: false },
      }),
    )
    expect(res.status).toBe(403)
    expect((await readBody<{ error: { code: string } }>(res)).error.code).toBe(
      ErrorCode.ONBOARDING_INCOMPLETE,
    )
  })

  it('OWNER gets full permissions on every org project', async () => {
    const setup = await seedOwnerWithProject()
    const res = await GET(
      buildRequest({ method: 'GET', path: '/api/me/permissions', session: setup.session }),
    )
    expect(res.status).toBe(200)
    const body = await expectMatchesContract(res, mePermissionsContracts.get.output)
    expect(body.projects).toHaveLength(1)
    expect(body.projects[0]?.projectId).toBe(setup.project.id)
    expect(body.projects[0]?.permissions).toEqual([...ALL_PERMISSIONS])
    expect(body.projects[0]?.scope.level).toBe(AccessScopeLevel.PROJECT)
  })

  it('MEMBER gets recomputed permissions for assigned projects only', async () => {
    const setup = await seedOwnerWithProject()
    const member = await users.createUser({
      email: `m-${Date.now()}@example.com`,
      name: 'Member',
    })
    await memberships.createMembership(
      { orgId: setup.org.id, userId: member.id, orgRole: OrgRole.MEMBER },
      { userId: member.id, orgRole: OrgRole.MEMBER },
    )
    const viewer = await rolesRepo.findRoleByKey(setup.ctx, 'viewer')
    expect(viewer).not.toBeNull()

    await ADD_MEMBER(
      buildRequest({
        method: 'POST',
        path: `/api/projects/${setup.project.id}/members`,
        session: setup.session,
        params: { id: setup.project.id },
        body: {
          userId: member.id,
          roleId: viewer!.id,
          scope: { level: AccessScopeLevel.OWN },
        },
      }),
    )

    // Second project with no membership — should not appear for MEMBER
    await projectsRepo.createProject(setup.ctx, {
      name: 'Other',
      code: `OT-${Date.now().toString(16)}`,
    })

    const res = await GET(
      buildRequest({
        method: 'GET',
        path: '/api/me/permissions',
        session: {
          userId: member.id,
          orgId: setup.org.id,
          orgRole: OrgRole.MEMBER,
          onboarded: true,
        },
      }),
    )
    expect(res.status).toBe(200)
    const body = await expectMatchesContract(res, mePermissionsContracts.get.output)
    expect(body.projects).toHaveLength(1)
    expect(body.projects[0]?.projectId).toBe(setup.project.id)
    expect(body.projects[0]?.permissions).toEqual([...viewer!.permissions])
    expect(body.projects[0]?.scope.level).toBe(AccessScopeLevel.OWN)
  })

  it('MEMBER with no project memberships gets an empty projects list', async () => {
    const setup = await seedOwnerWithProject()
    const member = await users.createUser({
      email: `empty-${Date.now()}@example.com`,
      name: 'Empty',
    })
    await memberships.createMembership(
      { orgId: setup.org.id, userId: member.id, orgRole: OrgRole.MEMBER },
      { userId: member.id, orgRole: OrgRole.MEMBER },
    )

    const res = await GET(
      buildRequest({
        method: 'GET',
        path: '/api/me/permissions',
        session: {
          userId: member.id,
          orgId: setup.org.id,
          orgRole: OrgRole.MEMBER,
          onboarded: true,
        },
      }),
    )
    const body = await expectMatchesContract(res, mePermissionsContracts.get.output)
    expect(body.projects).toEqual([])
  })
})
