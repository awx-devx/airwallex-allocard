/**
 * B3.11 retrofit sweep — under-permissioned MEMBER fails; granted MEMBER succeeds
 * where the role template permits. Checklist lives in B3-TASKS.md Notes.
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { GET as LIST_ROLES } from '@/app/api/roles/route'
import { GET as GET_ORG, PATCH as PATCH_ORG } from '@/app/api/organizations/[id]/route'
import { GET as LIST_PROJECTS, POST as CREATE_PROJECT } from '@/app/api/projects/route'
import { GET as GET_PROJECT, PATCH as PATCH_PROJECT } from '@/app/api/projects/[id]/route'
import { POST as TRANSITION } from '@/app/api/projects/[id]/transition/route'
import { GET as LIST_WS, POST as CREATE_WS } from '@/app/api/projects/[id]/workstreams/route'
import { PATCH as PATCH_OWNER } from '@/app/api/projects/[id]/owner/route'
import { GET as GET_HISTORY } from '@/app/api/projects/[id]/history/route'
import { POST as ADD_MEMBER } from '@/app/api/projects/[id]/members/route'
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
import { permissionForTransition } from '@/server/services/projects/transition'
import { seedRoleTemplates } from '@/server/services/organizations/seedRoleTemplates'
import { AccessScopeLevel } from '@/shared/enums/accessScopeLevel'
import { ErrorCode } from '@/shared/enums/errors'
import { OrgRole } from '@/shared/enums/orgRole'
import { ProjectStatus } from '@/shared/enums/projectStatus'
import { useTestDb } from '../helpers/db'
import { buildRequest, installTestSessionResolver, readBody } from '../helpers/request'

describe('B3.11 B1/B2 permission retrofit', () => {
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

  async function seedOwner() {
    const user = await users.createUser({
      email: `o-${Date.now()}-${Math.random().toString(16).slice(2)}@example.com`,
      name: 'Owner',
    })
    const org = await organizations.createOrganization({
      name: 'Retrofit Org',
      slug: `org-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      country: 'US',
      baseCurrency: 'USD',
      createdBy: user.id,
    })
    const ctx = { orgId: org.id, userId: user.id, orgRole: OrgRole.OWNER }
    await memberships.createMembership(ctx, { userId: user.id, orgRole: OrgRole.OWNER })
    await seedRoleTemplates(org.id)
    const project = await projectsRepo.createProject(ctx, {
      name: 'Alpha',
      code: `R-${Date.now().toString(16)}`,
      ownerId: user.id,
      startDate: new Date('2026-01-01'),
      endDate: new Date('2026-12-31'),
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

  async function addOrgMember(orgId: string) {
    const user = await users.createUser({
      email: `m-${Date.now()}-${Math.random().toString(16).slice(2)}@example.com`,
      name: 'Member',
    })
    await memberships.createMembership(
      { orgId, userId: user.id, orgRole: OrgRole.MEMBER },
      { userId: user.id, orgRole: OrgRole.MEMBER },
    )
    return {
      user,
      session: {
        userId: user.id,
        orgId,
        orgRole: OrgRole.MEMBER,
        onboarded: true as const,
      },
    }
  }

  async function assignRole(
    owner: Awaited<ReturnType<typeof seedOwner>>,
    userId: string,
    roleKey: string,
  ) {
    const role = await rolesRepo.findRoleByKey(owner.ctx, roleKey)
    expect(role).not.toBeNull()
    const res = await ADD_MEMBER(
      buildRequest({
        method: 'POST',
        path: `/api/projects/${owner.project.id}/members`,
        session: owner.session,
        params: { id: owner.project.id },
        body: {
          userId,
          roleId: role!.id,
          scope: { level: AccessScopeLevel.PROJECT },
        },
      }),
    )
    expect(res.status).toBe(201)
    return role!
  }

  describe('permissionForTransition map', () => {
    it('maps targets to edit / approve / close', () => {
      expect(permissionForTransition(ProjectStatus.PENDING_APPROVAL)).toBe('project.edit')
      expect(permissionForTransition(ProjectStatus.CANCELLED)).toBe('project.edit')
      expect(permissionForTransition(ProjectStatus.ACTIVE)).toBe('request.approve')
      expect(permissionForTransition(ProjectStatus.CLOSING)).toBe('project.close')
      expect(permissionForTransition(ProjectStatus.CLOSED)).toBe('project.close')
      expect(permissionForTransition(ProjectStatus.ARCHIVED)).toBe('project.close')
    })
  })

  describe('B1 — org.manage stays OWNER/ADMIN only', () => {
    it('MEMBER cannot PATCH organization even with finance_administrator project role', async () => {
      const owner = await seedOwner()
      const member = await addOrgMember(owner.org.id)
      await assignRole(owner, member.user.id, 'finance_administrator')

      const res = await PATCH_ORG(
        buildRequest({
          method: 'PATCH',
          path: `/api/organizations/${owner.org.id}`,
          session: member.session,
          params: { id: owner.org.id },
          body: { name: 'Hijacked' },
        }),
      )
      expect(res.status).toBe(403)
      expect((await readBody<{ error: { code: string } }>(res)).error.code).toBe(
        ErrorCode.PERMISSION_DENIED,
      )
    })

    it('MEMBER can still GET own organization', async () => {
      const owner = await seedOwner()
      const member = await addOrgMember(owner.org.id)
      const res = await GET_ORG(
        buildRequest({
          method: 'GET',
          path: `/api/organizations/${owner.org.id}`,
          session: member.session,
          params: { id: owner.org.id },
        }),
      )
      expect(res.status).toBe(200)
    })
  })

  describe('B2 — project subject + role grants', () => {
    it('MEMBER without membership is denied project.view / project.edit', async () => {
      const owner = await seedOwner()
      const member = await addOrgMember(owner.org.id)

      const list = await LIST_PROJECTS(
        buildRequest({ method: 'GET', path: '/api/projects', session: member.session }),
      )
      expect(list.status).toBe(403)

      const get = await GET_PROJECT(
        buildRequest({
          method: 'GET',
          path: `/api/projects/${owner.project.id}`,
          session: member.session,
          params: { id: owner.project.id },
        }),
      )
      expect(get.status).toBe(403)

      const patch = await PATCH_PROJECT(
        buildRequest({
          method: 'PATCH',
          path: `/api/projects/${owner.project.id}`,
          session: member.session,
          params: { id: owner.project.id },
          body: { name: 'Nope' },
        }),
      )
      expect(patch.status).toBe(403)
    })

    it('viewer MEMBER can view and list assigned project but cannot edit', async () => {
      const owner = await seedOwner()
      await projectsRepo.createProject(owner.ctx, {
        name: 'Hidden',
        code: `H-${Date.now().toString(16)}`,
      })
      const member = await addOrgMember(owner.org.id)
      await assignRole(owner, member.user.id, 'viewer')

      const list = await LIST_PROJECTS(
        buildRequest({ method: 'GET', path: '/api/projects', session: member.session }),
      )
      expect(list.status).toBe(200)
      const listed = await readBody<{ items: { id: string }[] }>(list)
      expect(listed.items.map((p) => p.id)).toEqual([owner.project.id])

      const get = await GET_PROJECT(
        buildRequest({
          method: 'GET',
          path: `/api/projects/${owner.project.id}`,
          session: member.session,
          params: { id: owner.project.id },
        }),
      )
      expect(get.status).toBe(200)

      const history = await GET_HISTORY(
        buildRequest({
          method: 'GET',
          path: `/api/projects/${owner.project.id}/history`,
          session: member.session,
          params: { id: owner.project.id },
        }),
      )
      expect(history.status).toBe(200)

      const ws = await LIST_WS(
        buildRequest({
          method: 'GET',
          path: `/api/projects/${owner.project.id}/workstreams`,
          session: member.session,
          params: { id: owner.project.id },
        }),
      )
      expect(ws.status).toBe(200)

      const patch = await PATCH_PROJECT(
        buildRequest({
          method: 'PATCH',
          path: `/api/projects/${owner.project.id}`,
          session: member.session,
          params: { id: owner.project.id },
          body: { name: 'Nope' },
        }),
      )
      expect(patch.status).toBe(403)

      const createWs = await CREATE_WS(
        buildRequest({
          method: 'POST',
          path: `/api/projects/${owner.project.id}/workstreams`,
          session: member.session,
          params: { id: owner.project.id },
          body: { name: 'WS' },
        }),
      )
      expect(createWs.status).toBe(403)

      const ownerChange = await PATCH_OWNER(
        buildRequest({
          method: 'PATCH',
          path: `/api/projects/${owner.project.id}/owner`,
          session: member.session,
          params: { id: owner.project.id },
          body: { ownerId: member.user.id },
        }),
      )
      expect(ownerChange.status).toBe(403)
    })

    it('project_manager MEMBER can edit and create projects; viewer cannot create', async () => {
      const owner = await seedOwner()
      const pm = await addOrgMember(owner.org.id)
      const viewer = await addOrgMember(owner.org.id)
      await assignRole(owner, pm.user.id, 'project_manager')
      await assignRole(owner, viewer.user.id, 'viewer')

      const edit = await PATCH_PROJECT(
        buildRequest({
          method: 'PATCH',
          path: `/api/projects/${owner.project.id}`,
          session: pm.session,
          params: { id: owner.project.id },
          body: { description: 'Updated by PM' },
        }),
      )
      expect(edit.status).toBe(200)

      const create = await CREATE_PROJECT(
        buildRequest({
          method: 'POST',
          path: '/api/projects',
          session: pm.session,
          body: { name: 'PM Draft', code: `PM-${Date.now().toString(16)}` },
        }),
      )
      expect(create.status).toBe(201)

      const denied = await CREATE_PROJECT(
        buildRequest({
          method: 'POST',
          path: '/api/projects',
          session: viewer.session,
          body: { name: 'Viewer Draft', code: `V-${Date.now().toString(16)}` },
        }),
      )
      expect(denied.status).toBe(403)
    })

    it('transition permissions: edit for cancel, approve for ACTIVE, close denied for viewer', async () => {
      const owner = await seedOwner()
      const viewer = await addOrgMember(owner.org.id)
      const approver = await addOrgMember(owner.org.id)
      const pm = await addOrgMember(owner.org.id)
      await assignRole(owner, viewer.user.id, 'viewer')
      await assignRole(owner, approver.user.id, 'approver')
      await assignRole(owner, pm.user.id, 'project_manager')

      const cancelDenied = await TRANSITION(
        buildRequest({
          method: 'POST',
          path: `/api/projects/${owner.project.id}/transition`,
          session: viewer.session,
          params: { id: owner.project.id },
          body: { to: ProjectStatus.CANCELLED },
        }),
      )
      expect(cancelDenied.status).toBe(403)

      const cancelOk = await TRANSITION(
        buildRequest({
          method: 'POST',
          path: `/api/projects/${owner.project.id}/transition`,
          session: pm.session,
          params: { id: owner.project.id },
          body: { to: ProjectStatus.CANCELLED },
        }),
      )
      expect(cancelOk.status).toBe(200)

      const draft2 = await projectsRepo.createProject(owner.ctx, {
        name: 'Approve Me',
        code: `A-${Date.now().toString(16)}`,
        ownerId: owner.user.id,
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-12-31'),
      })
      // Re-assign approver/pm onto second project
      for (const [userId, key] of [
        [approver.user.id, 'approver'],
        [pm.user.id, 'project_manager'],
      ] as const) {
        const role = await rolesRepo.findRoleByKey(owner.ctx, key)
        await ADD_MEMBER(
          buildRequest({
            method: 'POST',
            path: `/api/projects/${draft2.id}/members`,
            session: owner.session,
            params: { id: draft2.id },
            body: {
              userId,
              roleId: role!.id,
              scope: { level: AccessScopeLevel.PROJECT },
            },
          }),
        )
      }

      await TRANSITION(
        buildRequest({
          method: 'POST',
          path: `/api/projects/${draft2.id}/transition`,
          session: pm.session,
          params: { id: draft2.id },
          body: { to: ProjectStatus.PENDING_APPROVAL },
        }),
      )

      const approveDenied = await TRANSITION(
        buildRequest({
          method: 'POST',
          path: `/api/projects/${draft2.id}/transition`,
          session: pm.session,
          params: { id: draft2.id },
          body: { to: ProjectStatus.ACTIVE },
        }),
      )
      expect(approveDenied.status).toBe(403)

      const approveOk = await TRANSITION(
        buildRequest({
          method: 'POST',
          path: `/api/projects/${draft2.id}/transition`,
          session: approver.session,
          params: { id: draft2.id },
          body: { to: ProjectStatus.ACTIVE },
        }),
      )
      expect(approveOk.status).toBe(200)
    })
  })

  describe('B3 org-wide — roles via project membership', () => {
    it('MEMBER with member.view can list roles; bare MEMBER cannot', async () => {
      const owner = await seedOwner()
      const bare = await addOrgMember(owner.org.id)
      const pm = await addOrgMember(owner.org.id)
      await assignRole(owner, pm.user.id, 'project_manager')

      const denied = await LIST_ROLES(
        buildRequest({ method: 'GET', path: '/api/roles', session: bare.session }),
      )
      expect(denied.status).toBe(403)

      const allowed = await LIST_ROLES(
        buildRequest({ method: 'GET', path: '/api/roles', session: pm.session }),
      )
      expect(allowed.status).toBe(200)
    })
  })
})
