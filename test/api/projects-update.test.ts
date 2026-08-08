import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { PATCH } from '@/app/api/projects/[id]/route'
import { AuditLogModel } from '@/server/models/AuditLog'
import { MembershipModel } from '@/server/models/Membership'
import { OrganizationModel } from '@/server/models/Organization'
import { ProjectModel } from '@/server/models/Project'
import { UserModel } from '@/server/models/User'
import * as memberships from '@/server/repositories/memberships'
import * as organizations from '@/server/repositories/organizations'
import * as projectsRepo from '@/server/repositories/projects'
import * as users from '@/server/repositories/users'
import { projectContracts } from '@/shared/contracts/project'
import { ErrorCode } from '@/shared/enums/errors'
import { OrgRole } from '@/shared/enums/orgRole'
import { ProjectStatus } from '@/shared/enums/projectStatus'
import { expectMatchesContract } from '../helpers/contract'
import { useTestDb } from '../helpers/db'
import { buildRequest, installTestSessionResolver, readBody } from '../helpers/request'

describe('/api/projects/:id PATCH', () => {
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

  afterEach(() => {
    installTestSessionResolver()
  })

  async function seedUser(name = 'User') {
    return users.createUser({
      email: `user-${Date.now()}-${Math.random().toString(16).slice(2)}@example.com`,
      name,
    })
  }

  async function seedOwner() {
    const user = await seedUser('Owner')
    const org = await organizations.createOrganization({
      name: 'Update Org',
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

  // Matrix #1
  it('returns 401 when unauthenticated', async () => {
    const res = await PATCH(
      buildRequest({
        method: 'PATCH',
        path: '/api/projects/x',
        session: null,
        params: { id: 'x' },
        body: { name: 'X' },
      }),
    )
    expect(res.status).toBe(401)
  })

  // Matrix #2
  it('returns 403 when onboarding is incomplete', async () => {
    const user = await seedUser()
    const res = await PATCH(
      buildRequest({
        method: 'PATCH',
        path: '/api/projects/x',
        session: { userId: user.id, orgId: null, orgRole: null, onboarded: false },
        params: { id: 'x' },
        body: { name: 'X' },
      }),
    )
    expect(res.status).toBe(403)
  })

  // Matrix #3
  it('returns 404 for a project in another org', async () => {
    const a = await seedOwner()
    const b = await seedOwner()
    const project = await projectsRepo.createProject(a.ctx, { name: 'A', code: 'A-1' })

    const res = await PATCH(
      buildRequest({
        method: 'PATCH',
        path: `/api/projects/${project.id}`,
        session: b.session,
        params: { id: project.id },
        body: { name: 'Hijack' },
      }),
    )
    expect(res.status).toBe(404)
  })

  // Matrix #4
  it('returns 403 when the caller lacks project.edit', async () => {
    const owner = await seedOwner()
    const member = await seedUser('Member')
    await memberships.createMembership(
      { orgId: owner.org.id, userId: member.id, orgRole: OrgRole.MEMBER },
      { userId: member.id, orgRole: OrgRole.MEMBER },
    )
    const project = await projectsRepo.createProject(owner.ctx, { name: 'P', code: 'P-1' })

    const res = await PATCH(
      buildRequest({
        method: 'PATCH',
        path: `/api/projects/${project.id}`,
        session: {
          userId: member.id,
          orgId: owner.org.id,
          orgRole: OrgRole.MEMBER,
          onboarded: true,
        },
        params: { id: project.id },
        body: { name: 'Nope' },
      }),
    )
    expect(res.status).toBe(403)
    const body = await readBody<{ error: { message: string } }>(res)
    expect(body.error.message).toContain('project.edit')
  })

  // Matrix #6
  it('returns 422 for an empty patch', async () => {
    const { session, ctx } = await seedOwner()
    const project = await projectsRepo.createProject(ctx, { name: 'P', code: 'P-2' })

    const res = await PATCH(
      buildRequest({
        method: 'PATCH',
        path: `/api/projects/${project.id}`,
        session,
        params: { id: project.id },
        body: {},
      }),
    )
    expect(res.status).toBe(422)
  })

  // Matrix #8
  it('returns 404 when the project does not exist', async () => {
    const { session } = await seedOwner()
    const res = await PATCH(
      buildRequest({
        method: 'PATCH',
        path: '/api/projects/507f1f77bcf86cd799439011',
        session,
        params: { id: '507f1f77bcf86cd799439011' },
        body: { name: 'Ghost' },
      }),
    )
    expect(res.status).toBe(404)
  })

  // Matrix #7 + #10 — DRAFT partial OK
  it('updates a DRAFT partially and audits before/after', async () => {
    const { session, ctx } = await seedOwner()
    const project = await projectsRepo.createProject(ctx, {
      name: 'Before',
      code: 'DRAFT-1',
      description: '',
    })

    const res = await PATCH(
      buildRequest({
        method: 'PATCH',
        path: `/api/projects/${project.id}`,
        session,
        params: { id: project.id },
        body: {
          name: 'After',
          description: 'Wizard step',
          startDate: '2026-03-01T00:00:00.000Z',
        },
      }),
    )

    expect(res.status).toBe(200)
    const updated = await expectMatchesContract(res, projectContracts.update.output)
    expect(updated.name).toBe('After')
    expect(updated.description).toBe('Wizard step')
    expect(updated.startDate).toBe('2026-03-01T00:00:00.000Z')
    expect(updated.code).toBe('DRAFT-1')

    const audits = await AuditLogModel.find({
      orgId: session.orgId,
      action: 'project.updated',
      subjectId: project.id,
    }).exec()
    expect(audits).toHaveLength(1)
    expect(audits[0]?.before).toMatchObject({ name: 'Before' })
    expect(audits[0]?.after).toMatchObject({ name: 'After' })
  })

  it('rejects PATCH on a CLOSED project', async () => {
    const { session, ctx } = await seedOwner()
    const project = await projectsRepo.createProject(ctx, { name: 'Done', code: 'CL-1' })
    await projectsRepo.updateStatus(ctx, project.id, ProjectStatus.DRAFT, ProjectStatus.CLOSED)

    const res = await PATCH(
      buildRequest({
        method: 'PATCH',
        path: `/api/projects/${project.id}`,
        session,
        params: { id: project.id },
        body: { name: 'Nope' },
      }),
    )
    expect(res.status).toBe(409)
    const body = await readBody<{ error: { code: string } }>(res)
    expect(body.error.code).toBe(ErrorCode.CONFLICT)
  })

  it('rejects PATCH on an ARCHIVED project', async () => {
    const { session, ctx } = await seedOwner()
    const project = await projectsRepo.createProject(ctx, { name: 'Old', code: 'AR-1' })
    await projectsRepo.updateStatus(ctx, project.id, ProjectStatus.DRAFT, ProjectStatus.ARCHIVED)

    const res = await PATCH(
      buildRequest({
        method: 'PATCH',
        path: `/api/projects/${project.id}`,
        session,
        params: { id: project.id },
        body: { description: 'Nope' },
      }),
    )
    expect(res.status).toBe(409)
  })
})
