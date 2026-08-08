import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { POST } from '@/app/api/projects/[id]/members/preview/route'
import { requirePermission } from '@/server/http/requirePermission'
import { AuditLogModel } from '@/server/models/AuditLog'
import { MembershipModel } from '@/server/models/Membership'
import { OrganizationModel } from '@/server/models/Organization'
import { ProjectMemberModel } from '@/server/models/ProjectMember'
import { ProjectModel } from '@/server/models/Project'
import { RoleModel } from '@/server/models/Role'
import { UserModel } from '@/server/models/User'
import * as memberships from '@/server/repositories/memberships'
import * as organizations from '@/server/repositories/organizations'
import * as projectMembers from '@/server/repositories/projectMembers'
import * as projectsRepo from '@/server/repositories/projects'
import * as rolesRepo from '@/server/repositories/roles'
import * as users from '@/server/repositories/users'
import { computeEffectivePermissions } from '@/server/services/access/computeEffectivePermissions'
import { seedRoleTemplates } from '@/server/services/organizations/seedRoleTemplates'
import { projectMemberContracts } from '@/shared/contracts/projectMember'
import { AccessScopeLevel } from '@/shared/enums/accessScopeLevel'
import { ErrorCode } from '@/shared/enums/errors'
import { OrgRole } from '@/shared/enums/orgRole'
import { Permission } from '@/shared/enums/permissions'
import { expectMatchesContract } from '../helpers/contract'
import { useTestDb } from '../helpers/db'
import { buildRequest, installTestSessionResolver, readBody } from '../helpers/request'

describe('/api/projects/:id/members/preview', () => {
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

  async function seedUser(name = 'User') {
    return users.createUser({
      email: `user-${Date.now()}-${Math.random().toString(16).slice(2)}@example.com`,
      name,
    })
  }

  async function seedOwnerWithProject() {
    const user = await seedUser('Owner')
    const org = await organizations.createOrganization({
      name: 'Preview Org',
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
      code: `PV-${Date.now().toString(16)}`,
    })
    const contractor = await rolesRepo.findRoleByKey(ctx, 'contractor')
    const viewer = await rolesRepo.findRoleByKey(ctx, 'viewer')
    expect(contractor).not.toBeNull()
    expect(viewer).not.toBeNull()

    return {
      user,
      org,
      project,
      contractor: contractor!,
      viewer: viewer!,
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
    const res = await POST(
      buildRequest({
        method: 'POST',
        path: '/api/projects/x/members/preview',
        session: null,
        params: { id: '507f1f77bcf86cd799439011' },
        body: {
          roleId: '507f1f77bcf86cd799439011',
          scope: { level: AccessScopeLevel.PROJECT },
        },
      }),
    )
    expect(res.status).toBe(401)
  })

  // Matrix #3
  it('returns 404 for a project in another org', async () => {
    const a = await seedOwnerWithProject()
    const b = await seedOwnerWithProject()
    const res = await POST(
      buildRequest({
        method: 'POST',
        path: `/api/projects/${a.project.id}/members/preview`,
        session: b.session,
        params: { id: a.project.id },
        body: {
          roleId: a.contractor.id,
          scope: { level: AccessScopeLevel.PROJECT },
        },
      }),
    )
    expect(res.status).toBe(404)
  })

  // Matrix #6
  it('returns 422 for invalid payload', async () => {
    const setup = await seedOwnerWithProject()
    const res = await POST(
      buildRequest({
        method: 'POST',
        path: `/api/projects/${setup.project.id}/members/preview`,
        session: setup.session,
        params: { id: setup.project.id },
        body: { roleId: setup.contractor.id },
      }),
    )
    expect(res.status).toBe(422)
  })

  // Matrix #7 — matches pure computeEffectivePermissions fixtures
  it('preview output matches computeEffectivePermissions for the same fixtures', async () => {
    const setup = await seedOwnerWithProject()
    const now = new Date()
    const scope = {
      level: AccessScopeLevel.CARD,
      cardIds: ['card_x'],
      validFrom: '2020-01-01T00:00:00.000Z',
      validTo: '2099-12-31T00:00:00.000Z',
    }

    const expected = computeEffectivePermissions({
      orgRole: OrgRole.MEMBER,
      role: setup.contractor,
      scope,
      now,
    })

    const res = await POST(
      buildRequest({
        method: 'POST',
        path: `/api/projects/${setup.project.id}/members/preview`,
        session: setup.session,
        params: { id: setup.project.id },
        body: { roleId: setup.contractor.id, scope },
      }),
    )
    expect(res.status).toBe(200)
    const body = await expectMatchesContract(res, projectMemberContracts.preview.output)
    expect(body.permissions).toEqual(expected.permissions)
    expect(body.scope).toEqual(expected.scope)
    expect(body.reasons).toEqual(expected.reasons)
  })

  it('preview matches what enforcement allows after add (same fixtures)', async () => {
    const setup = await seedOwnerWithProject()
    const assignee = await users.createUser({
      email: `assignee-${Date.now()}@example.com`,
      name: 'Assignee',
    })
    await memberships.createMembership(
      { orgId: setup.org.id, userId: assignee.id, orgRole: OrgRole.MEMBER },
      { userId: assignee.id, orgRole: OrgRole.MEMBER },
    )

    const scope = { level: AccessScopeLevel.PROJECT }

    const previewRes = await POST(
      buildRequest({
        method: 'POST',
        path: `/api/projects/${setup.project.id}/members/preview`,
        session: setup.session,
        params: { id: setup.project.id },
        body: { roleId: setup.viewer.id, scope },
      }),
    )
    const preview = await expectMatchesContract(previewRes, projectMemberContracts.preview.output)

    await projectMembers.addProjectMember(setup.ctx, {
      projectId: setup.project.id,
      userId: assignee.id,
      roleId: setup.viewer.id,
      scope,
      effectivePermissions: preview.permissions,
      addedBy: setup.user.id,
    })

    const memberCtx = {
      orgId: setup.org.id,
      userId: assignee.id,
      orgRole: OrgRole.MEMBER,
    }

    for (const permission of preview.permissions) {
      await expect(
        requirePermission(memberCtx, permission, { projectId: setup.project.id }),
      ).resolves.toBeUndefined()
    }

    await expect(
      requirePermission(memberCtx, Permission.CARD_MANAGE, {
        projectId: setup.project.id,
      }),
    ).rejects.toMatchObject({ code: ErrorCode.PERMISSION_DENIED })
  })

  it('expired scope preview yields empty permissions (matches enforcement)', async () => {
    const setup = await seedOwnerWithProject()
    const scope = {
      level: AccessScopeLevel.PROJECT,
      validTo: '2020-01-01T00:00:00.000Z',
    }

    const expected = computeEffectivePermissions({
      orgRole: OrgRole.MEMBER,
      role: setup.contractor,
      scope,
      now: new Date('2026-06-15T00:00:00.000Z'),
    })
    expect(expected.permissions).toEqual([])

    // Service uses Date.now(); seed an expired window relative to now.
    const res = await POST(
      buildRequest({
        method: 'POST',
        path: `/api/projects/${setup.project.id}/members/preview`,
        session: setup.session,
        params: { id: setup.project.id },
        body: {
          roleId: setup.contractor.id,
          scope: {
            level: AccessScopeLevel.PROJECT,
            validTo: '2000-01-01T00:00:00.000Z',
          },
        },
      }),
    )
    const body = await expectMatchesContract(res, projectMemberContracts.preview.output)
    expect(body.permissions).toEqual([])
    expect(body.reasons.every((r) => !r.allowed)).toBe(true)
  })

  it('returns 404 for unknown roleId in-org project', async () => {
    const setup = await seedOwnerWithProject()
    const res = await POST(
      buildRequest({
        method: 'POST',
        path: `/api/projects/${setup.project.id}/members/preview`,
        session: setup.session,
        params: { id: setup.project.id },
        body: {
          roleId: '507f1f77bcf86cd799439011',
          scope: { level: AccessScopeLevel.PROJECT },
        },
      }),
    )
    expect(res.status).toBe(404)
    expect((await readBody<{ error: { code: string } }>(res)).error.code).toBe(ErrorCode.NOT_FOUND)
  })
})
