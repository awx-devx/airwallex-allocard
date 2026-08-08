/**
 * B3.12 — one audit assertion per mutating B3 endpoint.
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { POST as RESOLVE_REVIEW } from '@/app/api/access-reviews/[id]/resolve/route'
import {
  DELETE as REMOVE_MEMBER,
  PATCH as UPDATE_MEMBER,
} from '@/app/api/projects/[id]/members/[userId]/route'
import { POST as ADD_MEMBER } from '@/app/api/projects/[id]/members/route'
import { DELETE as DELETE_ROLE, PATCH as UPDATE_ROLE } from '@/app/api/roles/[id]/route'
import { POST as CREATE_ROLE } from '@/app/api/roles/route'
import { resetEventPublisher } from '@/server/events/bus'
import { AccessReviewModel } from '@/server/models/AccessReview'
import { AuditLogModel } from '@/server/models/AuditLog'
import { MembershipModel } from '@/server/models/Membership'
import { OrganizationModel } from '@/server/models/Organization'
import { ProjectMemberModel } from '@/server/models/ProjectMember'
import { ProjectModel } from '@/server/models/Project'
import { RoleModel } from '@/server/models/Role'
import { UserModel } from '@/server/models/User'
import * as accessReviews from '@/server/repositories/accessReviews'
import * as memberships from '@/server/repositories/memberships'
import * as organizations from '@/server/repositories/organizations'
import * as projectsRepo from '@/server/repositories/projects'
import * as rolesRepo from '@/server/repositories/roles'
import * as users from '@/server/repositories/users'
import { seedRoleTemplates } from '@/server/services/organizations/seedRoleTemplates'
import { AccessScopeLevel } from '@/shared/enums/accessScopeLevel'
import { OrgRole } from '@/shared/enums/orgRole'
import { Permission } from '@/shared/enums/permissions'
import { useTestDb } from '../helpers/db'
import { buildRequest, installTestSessionResolver, readBody } from '../helpers/request'

async function findAudits(filter: { orgId: string; action: string; subjectId?: string }) {
  return AuditLogModel.find({ ...filter }).exec()
}

describe('audit/b3', () => {
  useTestDb()

  beforeAll(async () => {
    await Promise.all([
      UserModel.syncIndexes(),
      OrganizationModel.syncIndexes(),
      MembershipModel.syncIndexes(),
      ProjectModel.syncIndexes(),
      RoleModel.syncIndexes(),
      ProjectMemberModel.syncIndexes(),
      AccessReviewModel.syncIndexes(),
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

  async function seedOwnerWithProject() {
    const user = await users.createUser({
      email: `owner-${Date.now()}-${Math.random().toString(16).slice(2)}@example.com`,
      name: 'Owner',
    })
    const org = await organizations.createOrganization({
      name: 'Audit B3 Org',
      slug: `ab3-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      country: 'US',
      baseCurrency: 'USD',
      createdBy: user.id,
    })
    const ctx = { orgId: org.id, userId: user.id, orgRole: OrgRole.OWNER }
    await memberships.createMembership(ctx, { userId: user.id, orgRole: OrgRole.OWNER })
    await seedRoleTemplates(org.id)
    const project = await projectsRepo.createProject(ctx, {
      name: 'Audit Project',
      code: `AB-${Date.now().toString(16)}`,
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

  async function seedOrgMember(orgId: string) {
    const user = await users.createUser({
      email: `m-${Date.now()}-${Math.random().toString(16).slice(2)}@example.com`,
      name: 'Member',
    })
    await memberships.createMembership(
      { orgId, userId: user.id, orgRole: OrgRole.MEMBER },
      { userId: user.id, orgRole: OrgRole.MEMBER },
    )
    return user
  }

  it('POST /api/roles writes role.created', async () => {
    const { session } = await seedOwnerWithProject()
    const res = await CREATE_ROLE(
      buildRequest({
        method: 'POST',
        path: '/api/roles',
        session,
        body: { name: 'Custom Analyst', permissions: [Permission.PROJECT_VIEW] },
      }),
    )
    expect(res.status).toBe(201)
    const role = await readBody<{ id: string }>(res)

    const audits = await findAudits({
      orgId: session.orgId,
      action: 'role.created',
      subjectId: role.id,
    })
    expect(audits).toHaveLength(1)
    expect(audits[0]?.actorId).toBe(session.userId)
    expect(audits[0]?.subjectType).toBe('role')
    expect(audits[0]?.after).toMatchObject({ id: role.id, name: 'Custom Analyst' })
  })

  it('PATCH /api/roles/:id writes role.updated with before/after', async () => {
    const { session, ctx } = await seedOwnerWithProject()
    const role = await rolesRepo.createRole(ctx, {
      key: `custom-${Date.now().toString(16)}`,
      name: 'Before',
      permissions: [Permission.PROJECT_VIEW],
    })

    const res = await UPDATE_ROLE(
      buildRequest({
        method: 'PATCH',
        path: `/api/roles/${role.id}`,
        session,
        params: { id: role.id },
        body: { name: 'After' },
      }),
    )
    expect(res.status).toBe(200)

    const audits = await findAudits({
      orgId: session.orgId,
      action: 'role.updated',
      subjectId: role.id,
    })
    expect(audits).toHaveLength(1)
    expect(audits[0]?.actorId).toBe(session.userId)
    expect(audits[0]?.before).toMatchObject({ name: 'Before' })
    expect(audits[0]?.after).toMatchObject({ name: 'After' })
  })

  it('DELETE /api/roles/:id writes role.deleted', async () => {
    const { session, ctx } = await seedOwnerWithProject()
    const role = await rolesRepo.createRole(ctx, {
      key: `del-${Date.now().toString(16)}`,
      name: 'Disposable',
      permissions: [Permission.PROJECT_VIEW],
    })

    const res = await DELETE_ROLE(
      buildRequest({
        method: 'DELETE',
        path: `/api/roles/${role.id}`,
        session,
        params: { id: role.id },
      }),
    )
    expect(res.status).toBe(204)

    const audits = await findAudits({
      orgId: session.orgId,
      action: 'role.deleted',
      subjectId: role.id,
    })
    expect(audits).toHaveLength(1)
    expect(audits[0]?.actorId).toBe(session.userId)
    expect(audits[0]?.before).toMatchObject({ id: role.id, name: 'Disposable' })
  })

  it('POST /api/projects/:id/members writes member.added', async () => {
    const setup = await seedOwnerWithProject()
    const member = await seedOrgMember(setup.org.id)

    const res = await ADD_MEMBER(
      buildRequest({
        method: 'POST',
        path: `/api/projects/${setup.project.id}/members`,
        session: setup.session,
        params: { id: setup.project.id },
        body: {
          userId: member.id,
          roleId: setup.viewer.id,
          scope: { level: AccessScopeLevel.PROJECT },
        },
      }),
    )
    expect(res.status).toBe(201)
    const body = await readBody<{ id: string }>(res)

    const audits = await findAudits({
      orgId: setup.org.id,
      action: 'member.added',
      subjectId: body.id,
    })
    expect(audits).toHaveLength(1)
    expect(audits[0]?.actorId).toBe(setup.session.userId)
    expect(audits[0]?.subjectType).toBe('projectMember')
    expect(audits[0]?.projectId).toBe(setup.project.id)
    expect(audits[0]?.after).toMatchObject({ id: body.id, userId: member.id })
  })

  it('PATCH /api/projects/:id/members/:userId writes member.updated', async () => {
    const setup = await seedOwnerWithProject()
    const member = await seedOrgMember(setup.org.id)
    await ADD_MEMBER(
      buildRequest({
        method: 'POST',
        path: `/api/projects/${setup.project.id}/members`,
        session: setup.session,
        params: { id: setup.project.id },
        body: {
          userId: member.id,
          roleId: setup.viewer.id,
          scope: { level: AccessScopeLevel.PROJECT },
        },
      }),
    )

    const res = await UPDATE_MEMBER(
      buildRequest({
        method: 'PATCH',
        path: `/api/projects/${setup.project.id}/members/${member.id}`,
        session: setup.session,
        params: { id: setup.project.id, userId: member.id },
        body: { roleId: setup.spender.id },
      }),
    )
    expect(res.status).toBe(200)
    const body = await readBody<{ id: string }>(res)

    const audits = await findAudits({
      orgId: setup.org.id,
      action: 'member.updated',
      subjectId: body.id,
    })
    expect(audits).toHaveLength(1)
    expect(audits[0]?.actorId).toBe(setup.session.userId)
    expect(audits[0]?.before).toMatchObject({ roleId: setup.viewer.id })
    expect(audits[0]?.after).toMatchObject({ roleId: setup.spender.id })
    expect(audits[0]?.metadata).toMatchObject({ roleChanged: true })
  })

  it('DELETE /api/projects/:id/members/:userId writes member.removed', async () => {
    const setup = await seedOwnerWithProject()
    const member = await seedOrgMember(setup.org.id)
    const added = await ADD_MEMBER(
      buildRequest({
        method: 'POST',
        path: `/api/projects/${setup.project.id}/members`,
        session: setup.session,
        params: { id: setup.project.id },
        body: {
          userId: member.id,
          roleId: setup.viewer.id,
          scope: { level: AccessScopeLevel.PROJECT },
        },
      }),
    )
    const body = await readBody<{ id: string }>(added)

    const res = await REMOVE_MEMBER(
      buildRequest({
        method: 'DELETE',
        path: `/api/projects/${setup.project.id}/members/${member.id}`,
        session: setup.session,
        params: { id: setup.project.id, userId: member.id },
      }),
    )
    expect(res.status).toBe(204)

    const audits = await findAudits({
      orgId: setup.org.id,
      action: 'member.removed',
      subjectId: body.id,
    })
    expect(audits).toHaveLength(1)
    expect(audits[0]?.actorId).toBe(setup.session.userId)
    expect(audits[0]?.subjectType).toBe('projectMember')
    expect(audits[0]?.projectId).toBe(setup.project.id)
  })

  it('POST /api/access-reviews/:id/resolve writes accessReview.resolved', async () => {
    const setup = await seedOwnerWithProject()
    const member = await seedOrgMember(setup.org.id)
    const added = await ADD_MEMBER(
      buildRequest({
        method: 'POST',
        path: `/api/projects/${setup.project.id}/members`,
        session: setup.session,
        params: { id: setup.project.id },
        body: {
          userId: member.id,
          roleId: setup.viewer.id,
          scope: { level: AccessScopeLevel.PROJECT },
        },
      }),
    )
    const pm = await readBody<{ id: string }>(added)

    const review = await accessReviews.createAccessReview(setup.ctx, {
      projectId: setup.project.id,
      userId: member.id,
      subjectId: pm.id,
      reason: 'Periodic review',
    })

    const res = await RESOLVE_REVIEW(
      buildRequest({
        method: 'POST',
        path: `/api/access-reviews/${review.id}/resolve`,
        session: setup.session,
        params: { id: review.id },
        body: { resolution: 'CONFIRM', note: 'Still needed' },
      }),
    )
    expect(res.status).toBe(200)

    const audits = await findAudits({
      orgId: setup.org.id,
      action: 'accessReview.resolved',
      subjectId: review.id,
    })
    expect(audits).toHaveLength(1)
    expect(audits[0]?.actorId).toBe(setup.session.userId)
    expect(audits[0]?.subjectType).toBe('accessReview')
    expect(audits[0]?.projectId).toBe(setup.project.id)
    expect(audits[0]?.metadata).toMatchObject({
      resolution: 'CONFIRM',
      note: 'Still needed',
    })
  })
})
