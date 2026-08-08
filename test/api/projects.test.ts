import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { GET as GET_ONE } from '@/app/api/projects/[id]/route'
import { GET, POST } from '@/app/api/projects/route'
import { getPublishedEvents, resetEventPublisher } from '@/server/events/bus'
import { DomainEventType } from '@/server/events/types'
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

describe('/api/projects', () => {
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

  async function seedUser(name = 'User') {
    return users.createUser({
      email: `user-${Date.now()}-${Math.random().toString(16).slice(2)}@example.com`,
      name,
    })
  }

  async function seedMember(opts?: { role?: OrgRole }) {
    const user = await seedUser()
    const org = await organizations.createOrganization({
      name: 'Projects Org',
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
    return {
      user,
      org,
      session: {
        userId: user.id,
        orgId: org.id,
        orgRole: role,
        onboarded: true as const,
      },
    }
  }

  describe('POST /api/projects', () => {
    // Matrix #1
    it('returns 401 when unauthenticated', async () => {
      const res = await POST(
        buildRequest({
          method: 'POST',
          path: '/api/projects',
          session: null,
          body: { name: 'P', code: 'P-1' },
        }),
      )
      expect(res.status).toBe(401)
      const body = await readBody<{ error: { code: string } }>(res)
      expect(body.error.code).toBe(ErrorCode.UNAUTHENTICATED)
    })

    // Matrix #2
    it('returns 403 when onboarding is incomplete', async () => {
      const user = await seedUser()
      const res = await POST(
        buildRequest({
          method: 'POST',
          path: '/api/projects',
          session: { userId: user.id, orgId: null, orgRole: null, onboarded: false },
          body: { name: 'P', code: 'P-1' },
        }),
      )
      expect(res.status).toBe(403)
      const body = await readBody<{ error: { code: string } }>(res)
      expect(body.error.code).toBe(ErrorCode.ONBOARDING_INCOMPLETE)
    })

    // Matrix #3 — N/A (create has no resource id)
    // Matrix #5 — N/A until B3 scopes
    // Matrix #8–9 — N/A

    // Matrix #4
    it('returns 403 when the caller lacks project.create', async () => {
      const { session } = await seedMember({ role: OrgRole.MEMBER })
      const res = await POST(
        buildRequest({
          method: 'POST',
          path: '/api/projects',
          session,
          body: { name: 'P', code: 'P-1' },
        }),
      )
      expect(res.status).toBe(403)
      const body = await readBody<{ error: { code: string; message: string } }>(res)
      expect(body.error.code).toBe(ErrorCode.PERMISSION_DENIED)
      expect(body.error.message).toContain('project.create')
    })

    // Matrix #6
    it('returns 422 for an invalid payload', async () => {
      const { session } = await seedMember()
      const res = await POST(
        buildRequest({
          method: 'POST',
          path: '/api/projects',
          session,
          body: { name: '', code: 'bad code!' },
        }),
      )
      expect(res.status).toBe(422)
      const body = await readBody<{ error: { code: string } }>(res)
      expect(body.error.code).toBe(ErrorCode.VALIDATION_FAILED)
    })

    // Matrix #7 + #10
    it('creates a DRAFT, audits once, and emits project.created', async () => {
      const { session } = await seedMember()
      const res = await POST(
        buildRequest({
          method: 'POST',
          path: '/api/projects',
          session,
          body: { name: 'APAC Launch', code: 'APAC-01', description: 'Go' },
        }),
      )

      expect(res.status).toBe(201)
      const project = await expectMatchesContract(res, projectContracts.create.output)
      expect(project.status).toBe(ProjectStatus.DRAFT)
      expect(project.code).toBe('APAC-01')
      expect(project.orgId).toBe(session.orgId)

      const audits = await AuditLogModel.find({
        orgId: session.orgId,
        action: 'project.created',
        subjectId: project.id,
      }).exec()
      expect(audits).toHaveLength(1)
      expect(audits[0]?.actorId).toBe(session.userId)

      const events = getPublishedEvents().filter((e) => e.type === DomainEventType.PROJECT_CREATED)
      expect(events).toHaveLength(1)
      expect(events[0]).toMatchObject({
        orgId: session.orgId,
        projectId: project.id,
        subjectType: 'project',
        subjectId: project.id,
      })
    })

    it('returns 409 when code is already taken in the org', async () => {
      const { session } = await seedMember()
      await POST(
        buildRequest({
          method: 'POST',
          path: '/api/projects',
          session,
          body: { name: 'A', code: 'DUP' },
        }),
      )
      const res = await POST(
        buildRequest({
          method: 'POST',
          path: '/api/projects',
          session,
          body: { name: 'B', code: 'DUP' },
        }),
      )
      expect(res.status).toBe(409)
    })
  })

  describe('GET /api/projects', () => {
    // Matrix #1
    it('returns 401 when unauthenticated', async () => {
      const res = await GET(buildRequest({ method: 'GET', path: '/api/projects', session: null }))
      expect(res.status).toBe(401)
    })

    // Matrix #2
    it('returns 403 when onboarding is incomplete', async () => {
      const user = await seedUser()
      const res = await GET(
        buildRequest({
          method: 'GET',
          path: '/api/projects',
          session: { userId: user.id, orgId: null, orgRole: null, onboarded: false },
        }),
      )
      expect(res.status).toBe(403)
    })

    // Matrix #4
    it('returns 403 when the caller lacks project.view', async () => {
      const { session } = await seedMember({ role: OrgRole.MEMBER })
      const res = await GET(buildRequest({ method: 'GET', path: '/api/projects', session }))
      expect(res.status).toBe(403)
    })

    // Matrix #7
    it('lists projects with filters and pagination', async () => {
      const { session, user } = await seedMember()
      const ctx = { orgId: session.orgId!, userId: user.id, orgRole: OrgRole.OWNER }
      await projectsRepo.createProject(ctx, {
        name: 'Alpha',
        code: 'A-1',
        ownerId: user.id,
        costCentre: 'MKT',
      })
      await projectsRepo.createProject(ctx, {
        name: 'Beta',
        code: 'B-1',
        ownerId: 'other',
        costCentre: 'ENG',
      })

      const res = await GET(
        buildRequest({
          method: 'GET',
          path: '/api/projects',
          session,
          query: { costCentre: 'MKT', page: 1, pageSize: 10, sort: 'name' },
        }),
      )
      expect(res.status).toBe(200)
      const body = await expectMatchesContract(res, projectContracts.list.output)
      expect(body.total).toBe(1)
      expect(body.items[0]?.code).toBe('A-1')
      expect(body.page).toBe(1)
      expect(body.pageSize).toBe(10)
    })
  })

  describe('GET /api/projects/:id', () => {
    // Matrix #1
    it('returns 401 when unauthenticated', async () => {
      const res = await GET_ONE(
        buildRequest({
          method: 'GET',
          path: '/api/projects/x',
          session: null,
          params: { id: 'x' },
        }),
      )
      expect(res.status).toBe(401)
    })

    // Matrix #2
    it('returns 403 when onboarding is incomplete', async () => {
      const user = await seedUser()
      const res = await GET_ONE(
        buildRequest({
          method: 'GET',
          path: '/api/projects/x',
          session: { userId: user.id, orgId: null, orgRole: null, onboarded: false },
          params: { id: 'x' },
        }),
      )
      expect(res.status).toBe(403)
    })

    // Matrix #3 — cross-org → 404
    it('returns 404 for a project in another org', async () => {
      const a = await seedMember()
      const b = await seedMember()
      const created = await projectsRepo.createProject(
        { orgId: a.org.id, userId: a.user.id, orgRole: OrgRole.OWNER },
        { name: 'Secret', code: 'SEC-1' },
      )

      const res = await GET_ONE(
        buildRequest({
          method: 'GET',
          path: `/api/projects/${created.id}`,
          session: b.session,
          params: { id: created.id },
        }),
      )
      expect(res.status).toBe(404)
    })

    // Matrix #4
    it('returns 403 when the caller lacks project.view', async () => {
      const owner = await seedMember()
      const member = await seedMember({ role: OrgRole.MEMBER })
      // Put member in owner's org as MEMBER
      await memberships.createMembership(
        { orgId: owner.org.id, userId: member.user.id, orgRole: OrgRole.MEMBER },
        { userId: member.user.id, orgRole: OrgRole.MEMBER },
      )
      const created = await projectsRepo.createProject(
        { orgId: owner.org.id, userId: owner.user.id, orgRole: OrgRole.OWNER },
        { name: 'P', code: 'P-VIEW' },
      )

      const res = await GET_ONE(
        buildRequest({
          method: 'GET',
          path: `/api/projects/${created.id}`,
          session: {
            userId: member.user.id,
            orgId: owner.org.id,
            orgRole: OrgRole.MEMBER,
            onboarded: true,
          },
          params: { id: created.id },
        }),
      )
      expect(res.status).toBe(403)
    })

    // Matrix #8
    it('returns 404 when the project does not exist', async () => {
      const { session } = await seedMember()
      const res = await GET_ONE(
        buildRequest({
          method: 'GET',
          path: '/api/projects/507f1f77bcf86cd799439011',
          session,
          params: { id: '507f1f77bcf86cd799439011' },
        }),
      )
      expect(res.status).toBe(404)
    })

    // Matrix #7
    it('returns projectDetail with overview stubs', async () => {
      const { session, user, org } = await seedMember()
      const created = await projectsRepo.createProject(
        { orgId: org.id, userId: user.id, orgRole: OrgRole.OWNER },
        { name: 'Detail', code: 'DET-1' },
      )

      const res = await GET_ONE(
        buildRequest({
          method: 'GET',
          path: `/api/projects/${created.id}`,
          session,
          params: { id: created.id },
        }),
      )
      expect(res.status).toBe(200)
      const detail = await expectMatchesContract(res, projectContracts.get.output)
      expect(detail.id).toBe(created.id)
      expect(detail.overview).toEqual({
        memberCount: 0,
        activeCardCount: 0,
        pendingApprovalCount: 0,
        alertCount: 0,
        budgetRemaining: null,
        budgetSpent: null,
      })
    })
  })
})
