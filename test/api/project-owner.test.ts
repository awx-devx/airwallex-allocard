import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { PATCH } from '@/app/api/projects/[id]/owner/route'
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
import { expectMatchesContract } from '../helpers/contract'
import { useTestDb } from '../helpers/db'
import { buildRequest, installTestSessionResolver, readBody } from '../helpers/request'

describe('/api/projects/:id/owner', () => {
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

  async function seedOwnerWithProject() {
    const owner = await users.createUser({
      email: `owner-${Date.now()}-${Math.random().toString(16).slice(2)}@example.com`,
      name: 'Owner',
    })
    const org = await organizations.createOrganization({
      name: 'Owner Org',
      slug: `org-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      country: 'US',
      baseCurrency: 'USD',
      createdBy: owner.id,
    })
    await memberships.createMembership(
      { orgId: org.id, userId: owner.id, orgRole: OrgRole.OWNER },
      { userId: owner.id, orgRole: OrgRole.OWNER },
    )
    const ctx = { orgId: org.id, userId: owner.id, orgRole: OrgRole.OWNER }
    const project = await projectsRepo.createProject(ctx, {
      name: 'Owned',
      code: `OWN-${Date.now()}`,
      ownerId: owner.id,
    })
    return {
      owner,
      org,
      ctx,
      project,
      session: {
        userId: owner.id,
        orgId: org.id,
        orgRole: OrgRole.OWNER,
        onboarded: true as const,
      },
    }
  }

  it('returns 401 when unauthenticated', async () => {
    const res = await PATCH(
      buildRequest({
        method: 'PATCH',
        path: '/api/projects/x/owner',
        session: null,
        params: { id: 'x' },
        body: { ownerId: 'y' },
      }),
    )
    expect(res.status).toBe(401)
  })

  it('returns 404 for a project in another org', async () => {
    const a = await seedOwnerWithProject()
    const b = await seedOwnerWithProject()
    const res = await PATCH(
      buildRequest({
        method: 'PATCH',
        path: `/api/projects/${a.project.id}/owner`,
        session: b.session,
        params: { id: a.project.id },
        body: { ownerId: b.owner.id },
      }),
    )
    expect(res.status).toBe(404)
  })

  it('returns 422 when ownerId is not an active member', async () => {
    const { session, project } = await seedOwnerWithProject()
    const stranger = await users.createUser({
      email: `stranger-${Date.now()}@example.com`,
      name: 'Stranger',
    })

    const res = await PATCH(
      buildRequest({
        method: 'PATCH',
        path: `/api/projects/${project.id}/owner`,
        session,
        params: { id: project.id },
        body: { ownerId: stranger.id },
      }),
    )
    expect(res.status).toBe(422)
    const body = await readBody<{ error: { code: string } }>(res)
    expect(body.error.code).toBe(ErrorCode.VALIDATION_FAILED)
  })

  it('changes owner and audits before/after', async () => {
    const { session, project, org, ctx } = await seedOwnerWithProject()
    const teammate = await users.createUser({
      email: `mate-${Date.now()}@example.com`,
      name: 'Teammate',
    })
    await memberships.createMembership(
      { orgId: org.id, userId: teammate.id, orgRole: OrgRole.ADMIN },
      { userId: teammate.id, orgRole: OrgRole.ADMIN },
    )

    const res = await PATCH(
      buildRequest({
        method: 'PATCH',
        path: `/api/projects/${project.id}/owner`,
        session,
        params: { id: project.id },
        body: { ownerId: teammate.id },
      }),
    )
    expect(res.status).toBe(200)
    const updated = await expectMatchesContract(res, projectContracts.changeOwner.output)
    expect(updated.ownerId).toBe(teammate.id)

    const audits = await AuditLogModel.find({
      orgId: ctx.orgId,
      action: 'project.owner_changed',
      subjectId: project.id,
    }).exec()
    expect(audits).toHaveLength(1)
    expect(audits[0]?.before).toMatchObject({ ownerId: session.userId })
    expect(audits[0]?.after).toMatchObject({ ownerId: teammate.id })
  })

  it('returns 403 when lacking project.edit', async () => {
    const { project, org, ctx } = await seedOwnerWithProject()
    const member = await users.createUser({
      email: `mem-${Date.now()}@example.com`,
      name: 'Member',
    })
    await memberships.createMembership(
      { orgId: org.id, userId: member.id, orgRole: OrgRole.MEMBER },
      { userId: member.id, orgRole: OrgRole.MEMBER },
    )

    const res = await PATCH(
      buildRequest({
        method: 'PATCH',
        path: `/api/projects/${project.id}/owner`,
        session: {
          userId: member.id,
          orgId: org.id,
          orgRole: OrgRole.MEMBER,
          onboarded: true,
        },
        params: { id: project.id },
        body: { ownerId: ctx.userId },
      }),
    )
    expect(res.status).toBe(403)
  })
})
