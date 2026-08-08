import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { DELETE, PATCH } from '@/app/api/roles/[id]/route'
import { GET, POST } from '@/app/api/roles/route'
import { AuditLogModel } from '@/server/models/AuditLog'
import { MembershipModel } from '@/server/models/Membership'
import { OrganizationModel } from '@/server/models/Organization'
import { ProjectMemberModel } from '@/server/models/ProjectMember'
import { RoleModel } from '@/server/models/Role'
import { UserModel } from '@/server/models/User'
import * as memberships from '@/server/repositories/memberships'
import * as organizations from '@/server/repositories/organizations'
import * as projectMembers from '@/server/repositories/projectMembers'
import * as rolesRepo from '@/server/repositories/roles'
import * as users from '@/server/repositories/users'
import { seedRoleTemplates } from '@/server/services/organizations/seedRoleTemplates'
import { roleContracts } from '@/shared/contracts/role'
import { AccessScopeLevel } from '@/shared/enums/accessScopeLevel'
import { ErrorCode } from '@/shared/enums/errors'
import { OrgRole } from '@/shared/enums/orgRole'
import { Permission } from '@/shared/enums/permissions'
import { expectMatchesContract } from '../helpers/contract'
import { useTestDb } from '../helpers/db'
import { buildRequest, installTestSessionResolver, readBody } from '../helpers/request'

describe('/api/roles', () => {
  useTestDb()

  beforeAll(async () => {
    await Promise.all([
      UserModel.syncIndexes(),
      OrganizationModel.syncIndexes(),
      MembershipModel.syncIndexes(),
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

  async function seedMember(opts?: { role?: OrgRole }) {
    const user = await seedUser()
    const org = await organizations.createOrganization({
      name: 'Roles Org',
      slug: `org-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      country: 'US',
      baseCurrency: 'USD',
      createdBy: user.id,
    })
    const role = opts?.role ?? OrgRole.OWNER
    await memberships.createMembership(
      { orgId: org.id, userId: user.id, orgRole: role },
      { userId: user.id, orgRole: role },
    )
    await seedRoleTemplates(org.id)
    return {
      user,
      org,
      session: {
        userId: user.id,
        orgId: org.id,
        orgRole: role,
        onboarded: true as const,
      },
      ctx: { orgId: org.id, userId: user.id, orgRole: role },
    }
  }

  describe('GET /api/roles', () => {
    // Matrix #1
    it('returns 401 when unauthenticated', async () => {
      const res = await GET(buildRequest({ method: 'GET', path: '/api/roles', session: null }))
      expect(res.status).toBe(401)
      expect((await readBody<{ error: { code: string } }>(res)).error.code).toBe(
        ErrorCode.UNAUTHENTICATED,
      )
    })

    // Matrix #2
    it('returns 403 when onboarding is incomplete', async () => {
      const user = await seedUser()
      const res = await GET(
        buildRequest({
          method: 'GET',
          path: '/api/roles',
          session: { userId: user.id, orgId: null, orgRole: null, onboarded: false },
        }),
      )
      expect(res.status).toBe(403)
      expect((await readBody<{ error: { code: string } }>(res)).error.code).toBe(
        ErrorCode.ONBOARDING_INCOMPLETE,
      )
    })

    // Matrix #4
    it('returns 403 when MEMBER lacks elevated access', async () => {
      const { session } = await seedMember({ role: OrgRole.MEMBER })
      const res = await GET(buildRequest({ method: 'GET', path: '/api/roles', session }))
      expect(res.status).toBe(403)
      expect((await readBody<{ error: { code: string } }>(res)).error.code).toBe(
        ErrorCode.PERMISSION_DENIED,
      )
    })

    // Matrix #7
    it('lists templates for the org', async () => {
      const { session } = await seedMember()
      const res = await GET(buildRequest({ method: 'GET', path: '/api/roles', session }))
      expect(res.status).toBe(200)
      const body = await expectMatchesContract(res, roleContracts.list.output)
      expect(body.some((r) => r.key === 'viewer')).toBe(true)
    })
  })

  describe('POST /api/roles', () => {
    // Matrix #1
    it('returns 401 when unauthenticated', async () => {
      const res = await POST(
        buildRequest({
          method: 'POST',
          path: '/api/roles',
          session: null,
          body: { name: 'Custom', permissions: [Permission.PROJECT_VIEW] },
        }),
      )
      expect(res.status).toBe(401)
    })

    // Matrix #6
    it('returns 422 for invalid payload', async () => {
      const { session } = await seedMember()
      const res = await POST(
        buildRequest({
          method: 'POST',
          path: '/api/roles',
          session,
          body: { name: 'Custom', permissions: [] },
        }),
      )
      expect(res.status).toBe(422)
    })

    // Matrix #4
    it('returns 403 for MEMBER', async () => {
      const { session } = await seedMember({ role: OrgRole.MEMBER })
      const res = await POST(
        buildRequest({
          method: 'POST',
          path: '/api/roles',
          session,
          body: { name: 'Custom', permissions: [Permission.PROJECT_VIEW] },
        }),
      )
      expect(res.status).toBe(403)
    })

    // Matrix #7 + #10
    it('creates a custom role and writes audit', async () => {
      const { session, org } = await seedMember()
      const res = await POST(
        buildRequest({
          method: 'POST',
          path: '/api/roles',
          session,
          body: {
            name: 'Budget Analyst',
            permissions: [Permission.BUDGET_VIEW, Permission.REPORT_EXPORT],
          },
        }),
      )
      expect(res.status).toBe(201)
      const body = await expectMatchesContract(res, roleContracts.create.output)
      expect(body.isTemplate).toBe(false)
      expect(body.key).toBe('budget_analyst')

      const audits = await AuditLogModel.find({
        orgId: org.id,
        action: 'role.created',
        subjectId: body.id,
      }).exec()
      expect(audits).toHaveLength(1)
    })
  })

  describe('PATCH /api/roles/:id', () => {
    // Matrix #8
    it('returns 404 for unknown role', async () => {
      const { session } = await seedMember()
      const res = await PATCH(
        buildRequest({
          method: 'PATCH',
          path: '/api/roles/507f1f77bcf86cd799439011',
          session,
          params: { id: '507f1f77bcf86cd799439011' },
          body: { name: 'X' },
        }),
      )
      expect(res.status).toBe(404)
    })

    // Matrix #3
    it('returns 404 for a role in another org', async () => {
      const a = await seedMember()
      const b = await seedMember()
      const role = await rolesRepo.findRoleByKey(a.ctx, 'viewer')
      expect(role).not.toBeNull()

      const res = await PATCH(
        buildRequest({
          method: 'PATCH',
          path: `/api/roles/${role!.id}`,
          session: b.session,
          params: { id: role!.id },
          body: { name: 'Hijacked' },
        }),
      )
      expect(res.status).toBe(404)
    })

    it('rejects template-in-use edits without force', async () => {
      const { session, ctx } = await seedMember()
      const role = await rolesRepo.findRoleByKey(ctx, 'viewer')
      expect(role).not.toBeNull()

      await projectMembers.addProjectMember(ctx, {
        projectId: 'proj_1',
        userId: 'assignee_1',
        roleId: role!.id,
        scope: { level: AccessScopeLevel.PROJECT },
        effectivePermissions: [...role!.permissions],
        addedBy: ctx.userId,
      })

      const res = await PATCH(
        buildRequest({
          method: 'PATCH',
          path: `/api/roles/${role!.id}`,
          session,
          params: { id: role!.id },
          body: { name: 'Viewer Plus' },
        }),
      )
      expect(res.status).toBe(409)
    })

    it('allows template-in-use edits with force and recomputes assignees', async () => {
      const { session, ctx, org } = await seedMember()
      const role = await rolesRepo.findRoleByKey(ctx, 'viewer')
      expect(role).not.toBeNull()

      const member = await projectMembers.addProjectMember(ctx, {
        projectId: 'proj_1',
        userId: 'assignee_force',
        roleId: role!.id,
        scope: { level: AccessScopeLevel.PROJECT },
        effectivePermissions: [...role!.permissions],
        addedBy: ctx.userId,
      })

      const res = await PATCH(
        buildRequest({
          method: 'PATCH',
          path: `/api/roles/${role!.id}`,
          session,
          params: { id: role!.id },
          body: {
            force: true,
            permissions: [Permission.PROJECT_VIEW, Permission.BUDGET_VIEW],
          },
        }),
      )
      expect(res.status).toBe(200)
      await expectMatchesContract(res, roleContracts.update.output)

      const refreshed = await projectMembers.findProjectMemberById(ctx, member.id)
      expect(refreshed?.effectivePermissions).toEqual([
        Permission.PROJECT_VIEW,
        Permission.BUDGET_VIEW,
      ])

      const audits = await AuditLogModel.find({
        orgId: org.id,
        action: 'role.updated',
        subjectId: role!.id,
      }).exec()
      expect(audits).toHaveLength(1)
    })
  })

  describe('DELETE /api/roles/:id', () => {
    it('rejects delete while assigned', async () => {
      const { session, ctx } = await seedMember()
      const custom = await rolesRepo.createRole(ctx, {
        key: 'doomed',
        name: 'Doomed',
        permissions: [Permission.PROJECT_VIEW],
      })
      await projectMembers.addProjectMember(ctx, {
        projectId: 'proj_1',
        userId: 'u1',
        roleId: custom.id,
        scope: { level: AccessScopeLevel.PROJECT },
        effectivePermissions: [Permission.PROJECT_VIEW],
        addedBy: ctx.userId,
      })

      const res = await DELETE(
        buildRequest({
          method: 'DELETE',
          path: `/api/roles/${custom.id}`,
          session,
          params: { id: custom.id },
        }),
      )
      expect(res.status).toBe(409)
    })

    // Matrix #7 + #10
    it('deletes an unassigned custom role and audits', async () => {
      const { session, ctx, org } = await seedMember()
      const custom = await rolesRepo.createRole(ctx, {
        key: 'temp_custom',
        name: 'Temp Custom',
        permissions: [Permission.PROJECT_VIEW],
      })

      const res = await DELETE(
        buildRequest({
          method: 'DELETE',
          path: `/api/roles/${custom.id}`,
          session,
          params: { id: custom.id },
        }),
      )
      expect(res.status).toBe(204)
      expect(await rolesRepo.findRoleById(ctx, custom.id)).toBeNull()

      const audits = await AuditLogModel.find({
        orgId: org.id,
        action: 'role.deleted',
        subjectId: custom.id,
      }).exec()
      expect(audits).toHaveLength(1)
    })

    // Matrix #3
    it('returns 404 when deleting another org’s role', async () => {
      const a = await seedMember()
      const b = await seedMember()
      const role = await rolesRepo.findRoleByKey(a.ctx, 'contractor')
      expect(role).not.toBeNull()

      const res = await DELETE(
        buildRequest({
          method: 'DELETE',
          path: `/api/roles/${role!.id}`,
          session: b.session,
          params: { id: role!.id },
        }),
      )
      expect(res.status).toBe(404)
    })
  })
})
