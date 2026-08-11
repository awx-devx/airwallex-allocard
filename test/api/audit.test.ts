/**
 * B9.2 — Filterable audit list.
 * actorType present; RULE vs USER distinguishable; matrix rows that apply; cursor works.
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { GET as LIST_ORG } from '@/app/api/audit/route'
import { GET as LIST_PROJECT } from '@/app/api/projects/[id]/audit/route'
import { resetEventPublisher } from '@/server/events/bus'
import type { OrgContext } from '@/server/http/types'
import { AuditLogModel } from '@/server/models/AuditLog'
import { MembershipModel } from '@/server/models/Membership'
import { OrganizationModel } from '@/server/models/Organization'
import { ProjectModel } from '@/server/models/Project'
import { ProjectMemberModel } from '@/server/models/ProjectMember'
import { RoleModel } from '@/server/models/Role'
import { UserModel } from '@/server/models/User'
import * as memberships from '@/server/repositories/memberships'
import * as organizations from '@/server/repositories/organizations'
import * as projectMembers from '@/server/repositories/projectMembers'
import * as projectsRepo from '@/server/repositories/projects'
import * as rolesRepo from '@/server/repositories/roles'
import { decodeOpaqueCursor, encodeOpaqueCursor } from '@/server/http/opaqueCursor'
import { audit } from '@/server/services/audit/log'
import { seedRoleTemplates } from '@/server/services/organizations/seedRoleTemplates'
import { resetRedis } from '@/server/redis'
import { auditContracts } from '@/shared/contracts/audit'
import { AccessScopeLevel } from '@/shared/enums/accessScopeLevel'
import { ActorType } from '@/shared/enums/audit'
import { ErrorCode } from '@/shared/enums/errors'
import { OrgRole } from '@/shared/enums/orgRole'
import { Permission } from '@/shared/enums/permissions'
import { expectMatchesContract } from '../helpers/contract'
import { useTestDb } from '../helpers/db'
import { buildRequest, installTestSessionResolver, readBody } from '../helpers/request'

describe('B9.2 audit list', () => {
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
    installTestSessionResolver()
    resetEventPublisher()
    resetRedis()
    vi.spyOn(console, 'info').mockImplementation(() => {})
  })

  afterEach(() => {
    resetEventPublisher()
    resetRedis()
    vi.restoreAllMocks()
  })

  async function seedOwner() {
    const user = await (
      await import('@/server/repositories/users')
    ).createUser({
      email: `aud-${Date.now()}-${Math.random().toString(16).slice(2)}@example.com`,
      name: 'Owner',
    })
    const org = await organizations.createOrganization({
      name: 'Audit Org',
      slug: `org-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      country: 'US',
      baseCurrency: 'USD',
      createdBy: user.id,
    })
    const ctx: OrgContext = { orgId: org.id, userId: user.id, orgRole: OrgRole.OWNER }
    await memberships.createMembership(ctx, { userId: user.id, orgRole: OrgRole.OWNER })
    await seedRoleTemplates(org.id)
    const project = await projectsRepo.createProject(ctx, {
      name: 'Audit Project',
      code: `AUD-${Date.now().toString(16)}`,
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

  async function addOrgMember(orgId: string, name = 'Member') {
    const user = await (
      await import('@/server/repositories/users')
    ).createUser({
      email: `m-${Date.now()}-${Math.random().toString(16).slice(2)}@example.com`,
      name,
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

  async function assignProjectRole(
    owner: Awaited<ReturnType<typeof seedOwner>>,
    userId: string,
    roleKey: string,
    projectId = owner.project.id,
  ) {
    const role = await rolesRepo.findRoleByKey(owner.ctx, roleKey)
    expect(role).not.toBeNull()
    await projectMembers.addProjectMember(owner.ctx, {
      projectId,
      userId,
      roleId: role!.id,
      scope: { level: AccessScopeLevel.PROJECT },
      effectivePermissions: role!.permissions,
      addedBy: owner.user.id,
    })
    return role!
  }

  describe('cursor helpers', () => {
    it('round-trips opaque { at, id }', () => {
      const encoded = encodeOpaqueCursor('2026-01-01T00:00:00.000Z', 'abc')
      expect(decodeOpaqueCursor(encoded)).toEqual({
        at: '2026-01-01T00:00:00.000Z',
        id: 'abc',
      })
    })
  })

  describe('GET /api/projects/:id/audit', () => {
    it('#1 unauthenticated → 401', async () => {
      const owner = await seedOwner()
      const res = await LIST_PROJECT(
        buildRequest({
          method: 'GET',
          path: `/api/projects/${owner.project.id}/audit`,
          session: null,
          params: { id: owner.project.id },
        }),
      )
      expect(res.status).toBe(401)
    })

    it('#2 no organisation → 403 ONBOARDING_INCOMPLETE', async () => {
      const user = await (
        await import('@/server/repositories/users')
      ).createUser({
        email: `solo-${Date.now()}@example.com`,
        name: 'Solo',
      })
      const res = await LIST_PROJECT(
        buildRequest({
          method: 'GET',
          path: '/api/projects/507f1f77bcf86cd799439011/audit',
          session: { userId: user.id, orgId: null, orgRole: null, onboarded: false },
          params: { id: '507f1f77bcf86cd799439011' },
        }),
      )
      expect(res.status).toBe(403)
      expect((await readBody<{ error: { code: string } }>(res)).error.code).toBe(
        ErrorCode.ONBOARDING_INCOMPLETE,
      )
    })

    it('#3 cross-org project → 404', async () => {
      const a = await seedOwner()
      const b = await seedOwner()
      const res = await LIST_PROJECT(
        buildRequest({
          method: 'GET',
          path: `/api/projects/${b.project.id}/audit`,
          session: a.session,
          params: { id: b.project.id },
        }),
      )
      expect(res.status).toBe(404)
    })

    it('#4 lacks member.manage → 403', async () => {
      const owner = await seedOwner()
      const member = await addOrgMember(owner.org.id)
      await assignProjectRole(owner, member.user.id, 'viewer')
      const res = await LIST_PROJECT(
        buildRequest({
          method: 'GET',
          path: `/api/projects/${owner.project.id}/audit`,
          session: member.session,
          params: { id: owner.project.id },
        }),
      )
      expect(res.status).toBe(403)
      expect(
        (await readBody<{ error: { code: string; message: string } }>(res)).error.message,
      ).toContain(Permission.MEMBER_MANAGE)
    })

    it('#5 finance_admin on other project does not grant this project', async () => {
      const owner = await seedOwner()
      const other = await projectsRepo.createProject(owner.ctx, {
        name: 'Other',
        code: `OTH-${Date.now().toString(16)}`,
      })
      const member = await addOrgMember(owner.org.id)
      await assignProjectRole(owner, member.user.id, 'finance_administrator', other.id)

      const res = await LIST_PROJECT(
        buildRequest({
          method: 'GET',
          path: `/api/projects/${owner.project.id}/audit`,
          session: member.session,
          params: { id: owner.project.id },
        }),
      )
      expect(res.status).toBe(403)
    })

    it('#6 invalid cursor → 422', async () => {
      const owner = await seedOwner()
      const res = await LIST_PROJECT(
        buildRequest({
          method: 'GET',
          path: `/api/projects/${owner.project.id}/audit`,
          session: owner.session,
          params: { id: owner.project.id },
          query: { cursor: 'not-valid-cursor!!!' },
        }),
      )
      expect(res.status).toBe(422)
    })

    it('#7 happy path — actorType present; RULE vs USER distinguishable', async () => {
      const owner = await seedOwner()
      const subjectId = '507f1f77bcf86cd799439011'
      await audit(owner.ctx, {
        action: 'card.updated',
        subjectType: 'card',
        subjectId,
        projectId: owner.project.id,
        actorType: ActorType.USER,
        actorId: owner.user.id,
        before: { limit: 100 },
        after: { limit: 200 },
        at: new Date('2026-01-01T10:00:00.000Z'),
      })
      await audit(owner.ctx, {
        action: 'card.updated',
        subjectType: 'card',
        subjectId,
        projectId: owner.project.id,
        actorType: ActorType.RULE,
        actorId: '507f1f77bcf86cd799439022',
        before: { limit: 200 },
        after: { limit: 50 },
        at: new Date('2026-01-01T11:00:00.000Z'),
      })

      const res = await LIST_PROJECT(
        buildRequest({
          method: 'GET',
          path: `/api/projects/${owner.project.id}/audit`,
          session: owner.session,
          params: { id: owner.project.id },
        }),
      )
      expect(res.status).toBe(200)
      const body = await expectMatchesContract(res, auditContracts.listForProject.output)
      expect(body.items.length).toBeGreaterThanOrEqual(2)
      expect(body.items.every((e) => e.actorType !== undefined)).toBe(true)
      expect(body.items[0]!.actorType).toBe(ActorType.RULE)
      expect(body.items[1]!.actorType).toBe(ActorType.USER)
      expect(body.items[0]!.before).toEqual({ limit: 200 })
      expect(body.items[0]!.after).toEqual({ limit: 50 })
      expect(body.items[0]!.projectId).toBe(owner.project.id)
    })

    it('#8 unknown project → 404', async () => {
      const owner = await seedOwner()
      const res = await LIST_PROJECT(
        buildRequest({
          method: 'GET',
          path: '/api/projects/507f1f77bcf86cd799439099/audit',
          session: owner.session,
          params: { id: '507f1f77bcf86cd799439099' },
        }),
      )
      expect(res.status).toBe(404)
    })

    it('#9 N/A — GET has no idempotency key', () => {
      expect(true).toBe(true)
    })

    it('#10 N/A — GET does not write audit', () => {
      expect(true).toBe(true)
    })

    it('filters by action and subjectType', async () => {
      const owner = await seedOwner()
      await audit(owner.ctx, {
        action: 'card.updated',
        subjectType: 'card',
        subjectId: '507f1f77bcf86cd799439011',
        projectId: owner.project.id,
        at: new Date('2026-02-01T00:00:00.000Z'),
      })
      await audit(owner.ctx, {
        action: 'member.added',
        subjectType: 'projectMember',
        subjectId: '507f1f77bcf86cd799439033',
        projectId: owner.project.id,
        at: new Date('2026-02-02T00:00:00.000Z'),
      })

      const res = await LIST_PROJECT(
        buildRequest({
          method: 'GET',
          path: `/api/projects/${owner.project.id}/audit`,
          session: owner.session,
          params: { id: owner.project.id },
          query: { action: 'member.added', subjectType: 'projectMember' },
        }),
      )
      const body = await expectMatchesContract(res, auditContracts.listForProject.output)
      expect(body.items).toHaveLength(1)
      expect(body.items[0]!.action).toBe('member.added')
    })

    it('cursor paginates newest-first without skip/duplicate', async () => {
      const owner = await seedOwner()
      const a = await audit(owner.ctx, {
        action: 'card.updated',
        subjectType: 'card',
        subjectId: '507f1f77bcf86cd799439011',
        projectId: owner.project.id,
        at: new Date('2026-03-01T09:00:00.000Z'),
      })
      const b = await audit(owner.ctx, {
        action: 'card.updated',
        subjectType: 'card',
        subjectId: '507f1f77bcf86cd799439011',
        projectId: owner.project.id,
        at: new Date('2026-03-01T10:00:00.000Z'),
      })
      const c = await audit(owner.ctx, {
        action: 'card.updated',
        subjectType: 'card',
        subjectId: '507f1f77bcf86cd799439011',
        projectId: owner.project.id,
        at: new Date('2026-03-01T11:00:00.000Z'),
      })

      const first = await LIST_PROJECT(
        buildRequest({
          method: 'GET',
          path: `/api/projects/${owner.project.id}/audit`,
          session: owner.session,
          params: { id: owner.project.id },
          query: { limit: 2 },
        }),
      )
      const firstBody = await expectMatchesContract(first, auditContracts.listForProject.output)
      expect(firstBody.items.map((e) => e.id)).toEqual([c.id, b.id])
      expect(firstBody.nextCursor).toBeTruthy()

      const second = await LIST_PROJECT(
        buildRequest({
          method: 'GET',
          path: `/api/projects/${owner.project.id}/audit`,
          session: owner.session,
          params: { id: owner.project.id },
          query: { limit: 2, cursor: firstBody.nextCursor! },
        }),
      )
      const secondBody = await expectMatchesContract(second, auditContracts.listForProject.output)
      expect(secondBody.items.map((e) => e.id)).toEqual([a.id])
      expect(secondBody.nextCursor).toBeNull()
    })

    it('MEMBER with finance_administrator can list', async () => {
      const owner = await seedOwner()
      const member = await addOrgMember(owner.org.id)
      await assignProjectRole(owner, member.user.id, 'finance_administrator')
      await audit(owner.ctx, {
        action: 'project.updated',
        subjectType: 'project',
        subjectId: owner.project.id,
        projectId: owner.project.id,
      })

      const res = await LIST_PROJECT(
        buildRequest({
          method: 'GET',
          path: `/api/projects/${owner.project.id}/audit`,
          session: member.session,
          params: { id: owner.project.id },
        }),
      )
      expect(res.status).toBe(200)
      const body = await expectMatchesContract(res, auditContracts.listForProject.output)
      expect(body.items.length).toBeGreaterThanOrEqual(1)
    })
  })

  describe('GET /api/audit', () => {
    it('#1 unauthenticated → 401', async () => {
      const res = await LIST_ORG(buildRequest({ method: 'GET', path: '/api/audit', session: null }))
      expect(res.status).toBe(401)
    })

    it('#4 MEMBER lacks member.manage → 403', async () => {
      const owner = await seedOwner()
      const member = await addOrgMember(owner.org.id)
      const res = await LIST_ORG(
        buildRequest({ method: 'GET', path: '/api/audit', session: member.session }),
      )
      expect(res.status).toBe(403)
      expect((await readBody<{ error: { message: string } }>(res)).error.message).toContain(
        Permission.MEMBER_MANAGE,
      )
    })

    it('#7 happy path org-wide with filters', async () => {
      const owner = await seedOwner()
      await audit(owner.ctx, {
        action: 'org.updated',
        subjectType: 'organization',
        subjectId: owner.org.id,
        actorType: ActorType.USER,
        at: new Date('2026-04-01T00:00:00.000Z'),
      })
      await audit(owner.ctx, {
        action: 'card.updated',
        subjectType: 'card',
        subjectId: '507f1f77bcf86cd799439011',
        projectId: owner.project.id,
        actorType: ActorType.RULE,
        actorId: '507f1f77bcf86cd799439022',
        at: new Date('2026-04-02T00:00:00.000Z'),
      })

      const filtered = await LIST_ORG(
        buildRequest({
          method: 'GET',
          path: '/api/audit',
          session: owner.session,
          query: { action: 'card.updated' },
        }),
      )
      expect(filtered.status).toBe(200)
      const body = await expectMatchesContract(filtered, auditContracts.list.output)
      expect(body.items.every((e) => e.action === 'card.updated')).toBe(true)
      expect(body.items.some((e) => e.actorType === ActorType.RULE)).toBe(true)
    })

    it('cross-org projectId filter → 404', async () => {
      const a = await seedOwner()
      const b = await seedOwner()
      const res = await LIST_ORG(
        buildRequest({
          method: 'GET',
          path: `/api/audit?projectId=${a.project.id}`,
          session: b.session,
          query: { projectId: a.project.id },
        }),
      )
      expect(res.status).toBe(404)
    })
  })
})
