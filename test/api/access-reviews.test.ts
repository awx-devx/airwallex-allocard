import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { GET } from '@/app/api/access-reviews/route'
import { POST as RESOLVE } from '@/app/api/access-reviews/[id]/resolve/route'
import { POST as ADD_MEMBER } from '@/app/api/projects/[id]/members/route'
import { GET as LIST_MEMBERS } from '@/app/api/projects/[id]/members/route'
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
import { accessReviewContracts } from '@/shared/contracts/accessReview'
import { projectMemberContracts } from '@/shared/contracts/projectMember'
import { AccessReviewResolution, AccessReviewStatus } from '@/shared/enums/accessReviewStatus'
import { AccessScopeLevel } from '@/shared/enums/accessScopeLevel'
import { ErrorCode } from '@/shared/enums/errors'
import { OrgRole } from '@/shared/enums/orgRole'
import { expectMatchesContract } from '../helpers/contract'
import { useTestDb } from '../helpers/db'
import { buildRequest, installTestSessionResolver, readBody } from '../helpers/request'

describe('/api/access-reviews', () => {
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
    vi.spyOn(console, 'info').mockImplementation(() => {})
  })

  afterEach(() => {
    installTestSessionResolver()
    vi.restoreAllMocks()
  })

  async function seedOwnerWithMember() {
    const user = await users.createUser({
      email: `owner-${Date.now()}-${Math.random().toString(16).slice(2)}@example.com`,
      name: 'Owner',
    })
    const org = await organizations.createOrganization({
      name: 'Reviews Org',
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
      code: `AR-${Date.now().toString(16)}`,
    })
    const viewer = await rolesRepo.findRoleByKey(ctx, 'viewer')
    expect(viewer).not.toBeNull()

    const assignee = await users.createUser({
      email: `assignee-${Date.now()}@example.com`,
      name: 'Assignee',
    })
    await memberships.createMembership(
      { orgId: org.id, userId: assignee.id, orgRole: OrgRole.MEMBER },
      { userId: assignee.id, orgRole: OrgRole.MEMBER },
    )

    const addRes = await ADD_MEMBER(
      buildRequest({
        method: 'POST',
        path: `/api/projects/${project.id}/members`,
        session: {
          userId: user.id,
          orgId: org.id,
          orgRole: OrgRole.OWNER,
          onboarded: true,
        },
        params: { id: project.id },
        body: {
          userId: assignee.id,
          roleId: viewer!.id,
          scope: { level: AccessScopeLevel.PROJECT },
        },
      }),
    )
    const member = await expectMatchesContract(addRes, projectMemberContracts.add.output)

    const review = await accessReviews.createAccessReview(ctx, {
      projectId: project.id,
      reason: 'Elevated access flagged for review',
      subjectId: member.id,
      userId: assignee.id,
      flaggedBy: null,
    })

    return {
      ctx,
      org,
      project,
      assignee,
      member,
      review,
      session: {
        userId: user.id,
        orgId: org.id,
        orgRole: OrgRole.OWNER,
        onboarded: true as const,
      },
    }
  }

  it('returns 401 when unauthenticated', async () => {
    const res = await GET(
      buildRequest({ method: 'GET', path: '/api/access-reviews', session: null }),
    )
    expect(res.status).toBe(401)
  })

  it('lists open reviews and filters by status', async () => {
    const setup = await seedOwnerWithMember()
    const res = await GET(
      buildRequest({
        method: 'GET',
        path: '/api/access-reviews?status=OPEN',
        session: setup.session,
        query: { status: AccessReviewStatus.OPEN },
      }),
    )
    expect(res.status).toBe(200)
    const body = await expectMatchesContract(res, accessReviewContracts.list.output)
    expect(body.some((r) => r.id === setup.review.id)).toBe(true)
    expect(body.every((r) => r.status === AccessReviewStatus.OPEN)).toBe(true)
  })

  it('returns 404 when filtering by another org projectId', async () => {
    const a = await seedOwnerWithMember()
    const b = await seedOwnerWithMember()
    const res = await GET(
      buildRequest({
        method: 'GET',
        path: `/api/access-reviews?projectId=${a.project.id}`,
        session: b.session,
        query: { projectId: a.project.id },
      }),
    )
    expect(res.status).toBe(404)
  })

  it('CONFIRMs a review without removing the member', async () => {
    const setup = await seedOwnerWithMember()
    const res = await RESOLVE(
      buildRequest({
        method: 'POST',
        path: `/api/access-reviews/${setup.review.id}/resolve`,
        session: setup.session,
        params: { id: setup.review.id },
        body: { resolution: AccessReviewResolution.CONFIRM, note: 'Looks fine' },
      }),
    )
    expect(res.status).toBe(200)
    const body = await expectMatchesContract(res, accessReviewContracts.resolve.output)
    expect(body.status).toBe(AccessReviewStatus.RESOLVED)
    expect(body.resolution).toBe(AccessReviewResolution.CONFIRM)

    const members = await LIST_MEMBERS(
      buildRequest({
        method: 'GET',
        path: `/api/projects/${setup.project.id}/members`,
        session: setup.session,
        params: { id: setup.project.id },
      }),
    )
    const listed = await expectMatchesContract(members, projectMemberContracts.list.output)
    expect(listed.some((m) => m.userId === setup.assignee.id)).toBe(true)

    const audits = await AuditLogModel.find({
      orgId: setup.org.id,
      action: 'accessReview.resolved',
      subjectId: setup.review.id,
    }).exec()
    expect(audits).toHaveLength(1)
  })

  it('REVOKEs a review and soft-removes the member', async () => {
    const setup = await seedOwnerWithMember()
    const res = await RESOLVE(
      buildRequest({
        method: 'POST',
        path: `/api/access-reviews/${setup.review.id}/resolve`,
        session: setup.session,
        params: { id: setup.review.id },
        body: { resolution: AccessReviewResolution.REVOKE },
      }),
    )
    expect(res.status).toBe(200)
    expect(
      (await expectMatchesContract(res, accessReviewContracts.resolve.output)).resolution,
    ).toBe(AccessReviewResolution.REVOKE)

    const members = await LIST_MEMBERS(
      buildRequest({
        method: 'GET',
        path: `/api/projects/${setup.project.id}/members`,
        session: setup.session,
        params: { id: setup.project.id },
      }),
    )
    const listed = await expectMatchesContract(members, projectMemberContracts.list.output)
    expect(listed).toHaveLength(0)
  })

  it('returns 409 when resolving twice', async () => {
    const setup = await seedOwnerWithMember()
    await RESOLVE(
      buildRequest({
        method: 'POST',
        path: `/api/access-reviews/${setup.review.id}/resolve`,
        session: setup.session,
        params: { id: setup.review.id },
        body: { resolution: AccessReviewResolution.CONFIRM },
      }),
    )
    const res = await RESOLVE(
      buildRequest({
        method: 'POST',
        path: `/api/access-reviews/${setup.review.id}/resolve`,
        session: setup.session,
        params: { id: setup.review.id },
        body: { resolution: AccessReviewResolution.REVOKE },
      }),
    )
    expect(res.status).toBe(409)
  })

  it('returns 404 when resolving another org’s review', async () => {
    const a = await seedOwnerWithMember()
    const b = await seedOwnerWithMember()
    const res = await RESOLVE(
      buildRequest({
        method: 'POST',
        path: `/api/access-reviews/${a.review.id}/resolve`,
        session: b.session,
        params: { id: a.review.id },
        body: { resolution: AccessReviewResolution.CONFIRM },
      }),
    )
    expect(res.status).toBe(404)
    expect((await readBody<{ error: { code: string } }>(res)).error.code).toBe(ErrorCode.NOT_FOUND)
  })
})
