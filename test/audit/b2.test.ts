/**
 * B2.10 — one audit assertion per mutating B2 endpoint.
 * Confirms exactly one entry with the correct actor/subject; before/after on field changes.
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { PATCH as CHANGE_OWNER } from '@/app/api/projects/[id]/owner/route'
import { PATCH as UPDATE_PROJECT } from '@/app/api/projects/[id]/route'
import { POST as TRANSITION } from '@/app/api/projects/[id]/transition/route'
import {
  DELETE as DELETE_WS,
  PATCH as UPDATE_WS,
} from '@/app/api/projects/[id]/workstreams/[wsId]/route'
import { POST as CREATE_WS } from '@/app/api/projects/[id]/workstreams/route'
import { POST as CREATE_PROJECT } from '@/app/api/projects/route'
import { resetEventPublisher } from '@/server/events/bus'
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
import { OrgRole } from '@/shared/enums/orgRole'
import { ProjectStatus } from '@/shared/enums/projectStatus'
import { useTestDb } from '../helpers/db'
import { buildRequest, installTestSessionResolver, readBody } from '../helpers/request'

async function findAudits(filter: { orgId: string; action: string; subjectId?: string }) {
  return AuditLogModel.find({ ...filter }).exec()
}

describe('audit/b2', () => {
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

  beforeEach(() => {
    resetEventPublisher()
    vi.spyOn(console, 'info').mockImplementation(() => {})
  })

  afterEach(() => {
    installTestSessionResolver()
    resetEventPublisher()
    vi.restoreAllMocks()
  })

  async function seedOwner() {
    const user = await users.createUser({
      email: `owner-${Date.now()}-${Math.random().toString(16).slice(2)}@example.com`,
      name: 'Owner',
    })
    const org = await organizations.createOrganization({
      name: 'Audit Org',
      slug: `audit-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      country: 'US',
      baseCurrency: 'USD',
      createdBy: user.id,
    })
    await memberships.createMembership(
      { orgId: org.id, userId: user.id, orgRole: OrgRole.OWNER },
      { userId: user.id, orgRole: OrgRole.OWNER },
    )
    const ctx = { orgId: org.id, userId: user.id, orgRole: OrgRole.OWNER }
    return {
      user,
      org,
      ctx,
      session: {
        userId: user.id,
        orgId: org.id,
        orgRole: OrgRole.OWNER,
        onboarded: true as const,
      },
    }
  }

  it('POST /api/projects writes project.created', async () => {
    const { session } = await seedOwner()
    const res = await CREATE_PROJECT(
      buildRequest({
        method: 'POST',
        path: '/api/projects',
        session,
        body: { name: 'Audit Create', code: `AC-${Date.now()}` },
      }),
    )
    expect(res.status).toBe(201)
    const project = await readBody<{ id: string }>(res)

    const audits = await findAudits({
      orgId: session.orgId,
      action: 'project.created',
      subjectId: project.id,
    })
    expect(audits).toHaveLength(1)
    expect(audits[0]?.actorId).toBe(session.userId)
    expect(audits[0]?.subjectType).toBe('project')
    expect(audits[0]?.projectId).toBe(project.id)
    expect(audits[0]?.after).toMatchObject({ id: project.id, name: 'Audit Create' })
  })

  it('PATCH /api/projects/:id writes project.updated with before/after', async () => {
    const { session, ctx } = await seedOwner()
    const project = await projectsRepo.createProject(ctx, {
      name: 'Before',
      code: `UP-${Date.now()}`,
    })

    const res = await UPDATE_PROJECT(
      buildRequest({
        method: 'PATCH',
        path: `/api/projects/${project.id}`,
        session,
        params: { id: project.id },
        body: { name: 'After' },
      }),
    )
    expect(res.status).toBe(200)

    const audits = await findAudits({
      orgId: session.orgId,
      action: 'project.updated',
      subjectId: project.id,
    })
    expect(audits).toHaveLength(1)
    expect(audits[0]?.actorId).toBe(session.userId)
    expect(audits[0]?.before).toMatchObject({ name: 'Before' })
    expect(audits[0]?.after).toMatchObject({ name: 'After' })
  })

  it('POST /api/projects/:id/transition writes project.transitioned with before/after', async () => {
    const { session, ctx } = await seedOwner()
    const project = await projectsRepo.createProject(ctx, {
      name: 'Ready',
      code: `TR-${Date.now()}`,
      ownerId: ctx.userId,
      startDate: new Date('2026-01-01T00:00:00.000Z'),
      endDate: new Date('2026-12-31T00:00:00.000Z'),
    })
    await budgets.upsertBudgetFields(ctx, project.id, {
      currency: 'USD',
      approvedAmount: 100_000,
    })

    const res = await TRANSITION(
      buildRequest({
        method: 'POST',
        path: `/api/projects/${project.id}/transition`,
        session,
        params: { id: project.id },
        body: { to: ProjectStatus.PENDING_APPROVAL, reason: 'submit' },
      }),
    )
    expect(res.status).toBe(200)

    const audits = await findAudits({
      orgId: session.orgId,
      action: 'project.transitioned',
      subjectId: project.id,
    })
    expect(audits).toHaveLength(1)
    expect(audits[0]?.actorId).toBe(session.userId)
    expect(audits[0]?.before).toMatchObject({ status: ProjectStatus.DRAFT })
    expect(audits[0]?.after).toMatchObject({ status: ProjectStatus.PENDING_APPROVAL })
    expect(audits[0]?.metadata).toMatchObject({ reason: 'submit' })
  })

  it('POST /api/projects/:id/workstreams writes workstream.created', async () => {
    const { session, ctx } = await seedOwner()
    const project = await projectsRepo.createProject(ctx, {
      name: 'WS',
      code: `WC-${Date.now()}`,
    })

    const res = await CREATE_WS(
      buildRequest({
        method: 'POST',
        path: `/api/projects/${project.id}/workstreams`,
        session,
        params: { id: project.id },
        body: { name: 'Retail' },
      }),
    )
    expect(res.status).toBe(201)
    const ws = await readBody<{ id: string }>(res)

    const audits = await findAudits({
      orgId: session.orgId,
      action: 'workstream.created',
      subjectId: ws.id,
    })
    expect(audits).toHaveLength(1)
    expect(audits[0]?.actorId).toBe(session.userId)
    expect(audits[0]?.subjectType).toBe('workstream')
    expect(audits[0]?.projectId).toBe(project.id)
    expect(audits[0]?.after).toMatchObject({ id: ws.id, name: 'Retail' })
  })

  it('PATCH /api/projects/:id/workstreams/:wsId writes workstream.updated with before/after', async () => {
    const { session, ctx } = await seedOwner()
    const project = await projectsRepo.createProject(ctx, {
      name: 'WS',
      code: `WU-${Date.now()}`,
    })
    const ws = await projectsRepo.addWorkstream(ctx, project.id, 'Retail')

    const res = await UPDATE_WS(
      buildRequest({
        method: 'PATCH',
        path: `/api/projects/${project.id}/workstreams/${ws!.id}`,
        session,
        params: { id: project.id, wsId: ws!.id },
        body: { name: 'Retail EU' },
      }),
    )
    expect(res.status).toBe(200)

    const audits = await findAudits({
      orgId: session.orgId,
      action: 'workstream.updated',
      subjectId: ws!.id,
    })
    expect(audits).toHaveLength(1)
    expect(audits[0]?.before).toMatchObject({ name: 'Retail' })
    expect(audits[0]?.after).toMatchObject({ name: 'Retail EU' })
  })

  it('DELETE /api/projects/:id/workstreams/:wsId writes workstream.deleted', async () => {
    const { session, ctx } = await seedOwner()
    const project = await projectsRepo.createProject(ctx, {
      name: 'WS',
      code: `WD-${Date.now()}`,
    })
    const ws = await projectsRepo.addWorkstream(ctx, project.id, 'Retail')

    const res = await DELETE_WS(
      buildRequest({
        method: 'DELETE',
        path: `/api/projects/${project.id}/workstreams/${ws!.id}`,
        session,
        params: { id: project.id, wsId: ws!.id },
      }),
    )
    expect(res.status).toBe(204)

    const audits = await findAudits({
      orgId: session.orgId,
      action: 'workstream.deleted',
      subjectId: ws!.id,
    })
    expect(audits).toHaveLength(1)
    expect(audits[0]?.actorId).toBe(session.userId)
    expect(audits[0]?.before).toMatchObject({ id: ws!.id, name: 'Retail' })
  })

  it('PATCH /api/projects/:id/owner writes project.owner_changed with before/after', async () => {
    const { session, ctx, org } = await seedOwner()
    const project = await projectsRepo.createProject(ctx, {
      name: 'Owned',
      code: `OW-${Date.now()}`,
      ownerId: ctx.userId,
    })
    const teammate = await users.createUser({
      email: `mate-${Date.now()}@example.com`,
      name: 'Teammate',
    })
    await memberships.createMembership(
      { orgId: org.id, userId: teammate.id, orgRole: OrgRole.ADMIN },
      { userId: teammate.id, orgRole: OrgRole.ADMIN },
    )

    const res = await CHANGE_OWNER(
      buildRequest({
        method: 'PATCH',
        path: `/api/projects/${project.id}/owner`,
        session,
        params: { id: project.id },
        body: { ownerId: teammate.id },
      }),
    )
    expect(res.status).toBe(200)

    const audits = await findAudits({
      orgId: session.orgId,
      action: 'project.owner_changed',
      subjectId: project.id,
    })
    expect(audits).toHaveLength(1)
    expect(audits[0]?.actorId).toBe(session.userId)
    expect(audits[0]?.before).toMatchObject({ ownerId: ctx.userId })
    expect(audits[0]?.after).toMatchObject({ ownerId: teammate.id })
  })
})
