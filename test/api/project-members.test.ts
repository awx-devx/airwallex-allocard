import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { DELETE, PATCH } from '@/app/api/projects/[id]/members/[userId]/route'
import { GET, POST } from '@/app/api/projects/[id]/members/route'
import { getPublishedEvents, resetEventPublisher } from '@/server/events/bus'
import { DomainEventType } from '@/server/events/types'
import { AuditLogModel } from '@/server/models/AuditLog'
import { MembershipModel } from '@/server/models/Membership'
import { OrganizationModel } from '@/server/models/Organization'
import { ProjectMemberModel } from '@/server/models/ProjectMember'
import { ProjectModel } from '@/server/models/Project'
import { RoleModel } from '@/server/models/Role'
import { UserModel } from '@/server/models/User'
import { CardholderModel } from '@/server/models/Cardholder'
import * as memberships from '@/server/repositories/memberships'
import * as cardholdersRepo from '@/server/repositories/cardholders'
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

describe('/api/projects/:id/members', () => {
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
      CardholderModel.syncIndexes(),
    ])
  })

  beforeEach(() => {
    resetEventPublisher()
    vi.spyOn(console, 'info').mockImplementation(() => {})
  })

  afterEach(() => {
    installTestSessionResolver()
    resetEventPublisher()
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
      name: 'Members Org',
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
      code: `P-${Date.now().toString(16)}`,
    })
    const viewer = await rolesRepo.findRoleByKey(ctx, 'viewer')
    const spender = await rolesRepo.findRoleByKey(ctx, 'project_spender')
    expect(viewer).not.toBeNull()
    expect(spender).not.toBeNull()

    return {
      user,
      org,
      project,
      viewer: viewer!,
      spender: spender!,
      ctx,
      session: {
        userId: user.id,
        orgId: org.id,
        orgRole: OrgRole.OWNER,
        onboarded: true as const,
      },
    }
  }

  async function seedOrgUser(orgId: string, opts?: { role?: OrgRole; name?: string }) {
    const user = await seedUser(opts?.name ?? 'Member')
    const role = opts?.role ?? OrgRole.MEMBER
    await memberships.createMembership(
      { orgId, userId: user.id, orgRole: role },
      { userId: user.id, orgRole: role },
    )
    return user
  }

  describe('GET /api/projects/:id/members', () => {
    // Matrix #1
    it('returns 401 when unauthenticated', async () => {
      const res = await GET(
        buildRequest({
          method: 'GET',
          path: '/api/projects/x/members',
          session: null,
          params: { id: '507f1f77bcf86cd799439011' },
        }),
      )
      expect(res.status).toBe(401)
    })

    // Matrix #2
    it('returns 403 when onboarding is incomplete', async () => {
      const user = await seedUser()
      const res = await GET(
        buildRequest({
          method: 'GET',
          path: '/api/projects/x/members',
          session: { userId: user.id, orgId: null, orgRole: null, onboarded: false },
          params: { id: '507f1f77bcf86cd799439011' },
        }),
      )
      expect(res.status).toBe(403)
      expect((await readBody<{ error: { code: string } }>(res)).error.code).toBe(
        ErrorCode.ONBOARDING_INCOMPLETE,
      )
    })

    // Matrix #3
    it('returns 404 for a project in another org', async () => {
      const a = await seedOwnerWithProject()
      const b = await seedOwnerWithProject()
      const res = await GET(
        buildRequest({
          method: 'GET',
          path: `/api/projects/${a.project.id}/members`,
          session: b.session,
          params: { id: a.project.id },
        }),
      )
      expect(res.status).toBe(404)
    })

    // Matrix #7
    it('lists members with role and user summaries', async () => {
      const setup = await seedOwnerWithProject()
      const assignee = await seedOrgUser(setup.org.id, { name: 'Assignee' })

      await POST(
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

      const res = await GET(
        buildRequest({
          method: 'GET',
          path: `/api/projects/${setup.project.id}/members`,
          session: setup.session,
          params: { id: setup.project.id },
        }),
      )
      expect(res.status).toBe(200)
      const body = await expectMatchesContract(res, projectMemberContracts.list.output)
      expect(body).toHaveLength(1)
      expect(body[0]?.user.name).toBe('Assignee')
      expect(body[0]?.role.key).toBe('viewer')
    })
  })

  describe('POST /api/projects/:id/members', () => {
    // Matrix #6
    it('returns 422 for invalid payload', async () => {
      const setup = await seedOwnerWithProject()
      const res = await POST(
        buildRequest({
          method: 'POST',
          path: `/api/projects/${setup.project.id}/members`,
          session: setup.session,
          params: { id: setup.project.id },
          body: { userId: setup.user.id },
        }),
      )
      expect(res.status).toBe(422)
    })

    // Matrix #4
    it('returns 403 for MEMBER without elevated access', async () => {
      const setup = await seedOwnerWithProject()
      const memberUser = await seedOrgUser(setup.org.id)
      const res = await POST(
        buildRequest({
          method: 'POST',
          path: `/api/projects/${setup.project.id}/members`,
          session: {
            userId: memberUser.id,
            orgId: setup.org.id,
            orgRole: OrgRole.MEMBER,
            onboarded: true,
          },
          params: { id: setup.project.id },
          body: {
            userId: memberUser.id,
            roleId: setup.viewer.id,
            scope: { level: AccessScopeLevel.PROJECT },
          },
        }),
      )
      expect(res.status).toBe(403)
    })

    // Matrix #7 + #10 + events
    it('adds a member, materialises permissions, audits, and emits member.added', async () => {
      const setup = await seedOwnerWithProject()
      const assignee = await seedOrgUser(setup.org.id)

      const res = await POST(
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
      expect(res.status).toBe(201)
      const body = await expectMatchesContract(res, projectMemberContracts.add.output)
      expect(body.effectivePermissions).toEqual([...setup.viewer.permissions])
      expect(body.removedAt).toBeNull()

      const audits = await AuditLogModel.find({
        orgId: setup.org.id,
        action: 'member.added',
        subjectId: body.id,
      }).exec()
      expect(audits).toHaveLength(1)

      const events = getPublishedEvents().filter((e) => e.type === DomainEventType.MEMBER_ADDED)
      expect(events).toHaveLength(1)
      expect(events[0]?.projectId).toBe(setup.project.id)

      const cardholder = await cardholdersRepo.findCardholderByUserId(setup.ctx, assignee.id)
      expect(cardholder).not.toBeNull()
      expect(cardholder?.type).toBe('INDIVIDUAL')
      expect(cardholder?.userId).toBe(assignee.id)
    })

    it('rejects adding a user who is not an org member', async () => {
      const setup = await seedOwnerWithProject()
      const outsider = await seedUser('Outsider')

      const res = await POST(
        buildRequest({
          method: 'POST',
          path: `/api/projects/${setup.project.id}/members`,
          session: setup.session,
          params: { id: setup.project.id },
          body: {
            userId: outsider.id,
            roleId: setup.viewer.id,
            scope: { level: AccessScopeLevel.PROJECT },
          },
        }),
      )
      expect(res.status).toBe(409)
    })
  })

  describe('PATCH /api/projects/:id/members/:userId', () => {
    it('updates role and scope, recomputes, and emits change events', async () => {
      const setup = await seedOwnerWithProject()
      const assignee = await seedOrgUser(setup.org.id)

      await POST(
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
      resetEventPublisher()

      const res = await PATCH(
        buildRequest({
          method: 'PATCH',
          path: `/api/projects/${setup.project.id}/members/${assignee.id}`,
          session: setup.session,
          params: { id: setup.project.id, userId: assignee.id },
          body: {
            roleId: setup.spender.id,
            scope: { level: AccessScopeLevel.OWN },
          },
        }),
      )
      expect(res.status).toBe(200)
      const body = await expectMatchesContract(res, projectMemberContracts.update.output)
      expect(body.roleId).toBe(setup.spender.id)
      expect(body.scope.level).toBe(AccessScopeLevel.OWN)
      expect(body.effectivePermissions).toEqual([...setup.spender.permissions])

      const types = getPublishedEvents().map((e) => e.type)
      expect(types).toContain(DomainEventType.MEMBER_ROLE_CHANGED)
      expect(types).toContain(DomainEventType.MEMBER_SCOPE_CHANGED)
    })

    // Matrix #8
    it('returns 404 when member is missing', async () => {
      const setup = await seedOwnerWithProject()
      const res = await PATCH(
        buildRequest({
          method: 'PATCH',
          path: `/api/projects/${setup.project.id}/members/507f1f77bcf86cd799439011`,
          session: setup.session,
          params: { id: setup.project.id, userId: '507f1f77bcf86cd799439011' },
          body: { roleId: setup.viewer.id },
        }),
      )
      expect(res.status).toBe(404)
    })
  })

  describe('DELETE /api/projects/:id/members/:userId', () => {
    it('soft-removes, audits, and emits member.removed', async () => {
      const setup = await seedOwnerWithProject()
      const assignee = await seedOrgUser(setup.org.id)

      await POST(
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
      resetEventPublisher()

      const res = await DELETE(
        buildRequest({
          method: 'DELETE',
          path: `/api/projects/${setup.project.id}/members/${assignee.id}`,
          session: setup.session,
          params: { id: setup.project.id, userId: assignee.id },
        }),
      )
      expect(res.status).toBe(204)

      const listed = await GET(
        buildRequest({
          method: 'GET',
          path: `/api/projects/${setup.project.id}/members`,
          session: setup.session,
          params: { id: setup.project.id },
        }),
      )
      const body = await expectMatchesContract(listed, projectMemberContracts.list.output)
      expect(body).toHaveLength(0)

      const events = getPublishedEvents().filter((e) => e.type === DomainEventType.MEMBER_REMOVED)
      expect(events).toHaveLength(1)
      expect(events[0]?.subjectType).toBe('projectMember')

      const audits = await AuditLogModel.find({
        orgId: setup.org.id,
        action: 'member.removed',
        projectId: setup.project.id,
      }).exec()
      expect(audits).toHaveLength(1)
    })

    // Matrix #3
    it('returns 404 when removing via another org session', async () => {
      const a = await seedOwnerWithProject()
      const assignee = await seedOrgUser(a.org.id)
      await POST(
        buildRequest({
          method: 'POST',
          path: `/api/projects/${a.project.id}/members`,
          session: a.session,
          params: { id: a.project.id },
          body: {
            userId: assignee.id,
            roleId: a.viewer.id,
            scope: { level: AccessScopeLevel.PROJECT },
          },
        }),
      )

      const b = await seedOwnerWithProject()
      const res = await DELETE(
        buildRequest({
          method: 'DELETE',
          path: `/api/projects/${a.project.id}/members/${assignee.id}`,
          session: b.session,
          params: { id: a.project.id, userId: assignee.id },
        }),
      )
      expect(res.status).toBe(404)
    })
  })
})
