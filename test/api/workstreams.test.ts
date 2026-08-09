import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { DELETE, PATCH } from '@/app/api/projects/[id]/workstreams/[wsId]/route'
import { GET, POST } from '@/app/api/projects/[id]/workstreams/route'
import { AuditLogModel } from '@/server/models/AuditLog'
import { BudgetModel } from '@/server/models/Budget'
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
import { ErrorCode } from '@/shared/enums/errors'
import { OrgRole } from '@/shared/enums/orgRole'
import { expectMatchesContract } from '../helpers/contract'
import { useTestDb } from '../helpers/db'
import { buildRequest, installTestSessionResolver, readBody } from '../helpers/request'

describe('/api/projects/:id/workstreams', () => {
  useTestDb()

  beforeAll(async () => {
    await Promise.all([
      UserModel.syncIndexes(),
      OrganizationModel.syncIndexes(),
      MembershipModel.syncIndexes(),
      ProjectModel.syncIndexes(),
      BudgetModel.syncIndexes(),
      AuditLogModel.syncIndexes(),
    ])
  })

  afterEach(() => {
    installTestSessionResolver()
  })

  async function seedOwner() {
    const user = await users.createUser({
      email: `user-${Date.now()}-${Math.random().toString(16).slice(2)}@example.com`,
      name: 'Owner',
    })
    const org = await organizations.createOrganization({
      name: 'WS Org',
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
      name: 'Project',
      code: `WS-${Date.now()}`,
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

  describe('GET/POST collection', () => {
    it('returns 401 when unauthenticated', async () => {
      const res = await GET(
        buildRequest({
          method: 'GET',
          path: '/api/projects/x/workstreams',
          session: null,
          params: { id: 'x' },
        }),
      )
      expect(res.status).toBe(401)
    })

    it('returns 403 when lacking project.view', async () => {
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
          path: `/api/projects/${owner.project.id}/workstreams`,
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

    it('returns 404 for a project in another org', async () => {
      const a = await seedOwner()
      const b = await seedOwner()
      const res = await GET(
        buildRequest({
          method: 'GET',
          path: `/api/projects/${a.project.id}/workstreams`,
          session: b.session,
          params: { id: a.project.id },
        }),
      )
      expect(res.status).toBe(404)
    })

    it('lists empty then creates and lists workstreams', async () => {
      const { session, project } = await seedOwner()

      const empty = await GET(
        buildRequest({
          method: 'GET',
          path: `/api/projects/${project.id}/workstreams`,
          session,
          params: { id: project.id },
        }),
      )
      expect(empty.status).toBe(200)
      const emptyBody = await expectMatchesContract(empty, projectContracts.listWorkstreams.output)
      expect(emptyBody).toEqual([])

      const created = await POST(
        buildRequest({
          method: 'POST',
          path: `/api/projects/${project.id}/workstreams`,
          session,
          params: { id: project.id },
          body: { name: 'Retail' },
        }),
      )
      expect(created.status).toBe(201)
      const ws = await expectMatchesContract(created, projectContracts.createWorkstream.output)
      expect(ws.name).toBe('Retail')

      const listed = await GET(
        buildRequest({
          method: 'GET',
          path: `/api/projects/${project.id}/workstreams`,
          session,
          params: { id: project.id },
        }),
      )
      const items = await expectMatchesContract(listed, projectContracts.listWorkstreams.output)
      expect(items).toHaveLength(1)
      expect(items[0]?.id).toBe(ws.id)

      const audits = await AuditLogModel.find({
        orgId: session.orgId,
        action: 'workstream.created',
        subjectId: ws.id,
      }).exec()
      expect(audits).toHaveLength(1)
    })

    it('returns 422 for invalid create payload', async () => {
      const { session, project } = await seedOwner()
      const res = await POST(
        buildRequest({
          method: 'POST',
          path: `/api/projects/${project.id}/workstreams`,
          session,
          params: { id: project.id },
          body: { name: '' },
        }),
      )
      expect(res.status).toBe(422)
    })
  })

  describe('PATCH/DELETE :wsId', () => {
    it('updates and deletes a workstream', async () => {
      const { session, project, ctx } = await seedOwner()
      const ws = await projectsRepo.addWorkstream(ctx, project.id, 'Retail')

      const patched = await PATCH(
        buildRequest({
          method: 'PATCH',
          path: `/api/projects/${project.id}/workstreams/${ws!.id}`,
          session,
          params: { id: project.id, wsId: ws!.id },
          body: { name: 'Retail EU' },
        }),
      )
      expect(patched.status).toBe(200)
      const updated = await expectMatchesContract(patched, projectContracts.updateWorkstream.output)
      expect(updated.name).toBe('Retail EU')

      const deleted = await DELETE(
        buildRequest({
          method: 'DELETE',
          path: `/api/projects/${project.id}/workstreams/${ws!.id}`,
          session,
          params: { id: project.id, wsId: ws!.id },
        }),
      )
      expect(deleted.status).toBe(204)

      const after = await projectsRepo.findProjectById(ctx, project.id)
      expect(after?.workstreams).toEqual([])

      const audits = await AuditLogModel.find({
        orgId: session.orgId,
        subjectId: ws!.id,
      }).exec()
      expect(audits.map((a) => a.action).sort()).toEqual([
        'workstream.deleted',
        'workstream.updated',
      ])
    })

    it('returns 404 for unknown workstream', async () => {
      const { session, project } = await seedOwner()
      const res = await PATCH(
        buildRequest({
          method: 'PATCH',
          path: `/api/projects/${project.id}/workstreams/missing`,
          session,
          params: { id: project.id, wsId: 'missing' },
          body: { name: 'X' },
        }),
      )
      expect(res.status).toBe(404)
    })

    it('returns 403 when lacking project.edit', async () => {
      const owner = await seedOwner()
      const member = await users.createUser({
        email: `m2-${Date.now()}@example.com`,
        name: 'Member',
      })
      await memberships.createMembership(
        { orgId: owner.org.id, userId: member.id, orgRole: OrgRole.MEMBER },
        { userId: member.id, orgRole: OrgRole.MEMBER },
      )
      const ws = await projectsRepo.addWorkstream(owner.ctx, owner.project.id, 'Retail')

      const res = await DELETE(
        buildRequest({
          method: 'DELETE',
          path: `/api/projects/${owner.project.id}/workstreams/${ws!.id}`,
          session: {
            userId: member.id,
            orgId: owner.org.id,
            orgRole: OrgRole.MEMBER,
            onboarded: true,
          },
          params: { id: owner.project.id, wsId: ws!.id },
        }),
      )
      expect(res.status).toBe(403)
      const body = await readBody<{ error: { message: string } }>(res)
      expect(body.error.message).toContain('project.edit')
    })

    it('returns 409 when a budget category references the workstream', async () => {
      const { session, project, ctx } = await seedOwner()
      const ws = await projectsRepo.addWorkstream(ctx, project.id, 'Linked')
      await budgets.upsertBudgetFields(ctx, project.id, {
        currency: 'USD',
        approvedAmount: 50_000,
      })
      await budgets.addCategory(ctx, project.id, {
        name: 'Field',
        allocated: 1_000,
        workstreamId: ws!.id,
      })

      const res = await DELETE(
        buildRequest({
          method: 'DELETE',
          path: `/api/projects/${project.id}/workstreams/${ws!.id}`,
          session,
          params: { id: project.id, wsId: ws!.id },
        }),
      )
      expect(res.status).toBe(409)
      const body = await readBody<{ error: { code: string } }>(res)
      expect(body.error.code).toBe(ErrorCode.CONFLICT)
    })
  })
})
