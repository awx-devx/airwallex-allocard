import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { GET, PATCH } from '@/app/api/organizations/[id]/route'
import { POST } from '@/app/api/organizations/route'
import { AuditLogModel } from '@/server/models/AuditLog'
import { MembershipModel } from '@/server/models/Membership'
import { OrganizationModel } from '@/server/models/Organization'
import { UserModel } from '@/server/models/User'
import * as memberships from '@/server/repositories/memberships'
import * as organizations from '@/server/repositories/organizations'
import * as users from '@/server/repositories/users'
import { organizationContracts } from '@/shared/contracts/organization'
import { ErrorCode } from '@/shared/enums/errors'
import { MembershipStatus } from '@/shared/enums/membershipStatus'
import { OrgRole } from '@/shared/enums/orgRole'
import { expectMatchesContract } from '../helpers/contract'
import { useTestDb } from '../helpers/db'
import { buildRequest, installTestSessionResolver, readBody } from '../helpers/request'

describe('/api/organizations', () => {
  useTestDb()

  beforeAll(async () => {
    await Promise.all([
      UserModel.syncIndexes(),
      OrganizationModel.syncIndexes(),
      MembershipModel.syncIndexes(),
      AuditLogModel.syncIndexes(),
    ])
  })

  afterEach(() => {
    installTestSessionResolver()
  })

  async function seedUser(name = 'Org User') {
    return users.createUser({
      email: `user-${Date.now()}-${Math.random().toString(16).slice(2)}@example.com`,
      name,
    })
  }

  async function seedMember(opts?: { role?: OrgRole }) {
    const user = await seedUser()
    const org = await organizations.createOrganization({
      name: 'Existing Org',
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

  describe('POST /api/organizations', () => {
    // Matrix #1
    it('returns 401 when unauthenticated', async () => {
      const res = await POST(
        buildRequest({
          method: 'POST',
          path: '/api/organizations',
          session: null,
          body: { name: 'Acme', country: 'US', baseCurrency: 'USD' },
        }),
      )
      const body = await readBody<{ error: { code: string } }>(res)
      expect(res.status).toBe(401)
      expect(body.error.code).toBe(ErrorCode.UNAUTHENTICATED)
    })

    // Matrix #2 — N/A as failure: create is the onboarding path.
    // Matrix #3–5, #8–9 — N/A for create.

    // Matrix #6
    it('returns 422 for an invalid payload', async () => {
      const user = await seedUser()
      const res = await POST(
        buildRequest({
          method: 'POST',
          path: '/api/organizations',
          session: { userId: user.id, orgId: null, orgRole: null, onboarded: false },
          body: { name: '', country: 'USA', baseCurrency: 'US' },
        }),
      )
      const body = await readBody<{ error: { code: string } }>(res)
      expect(res.status).toBe(422)
      expect(body.error.code).toBe(ErrorCode.VALIDATION_FAILED)
    })

    // Matrix #7 + #10
    it('creates an org, makes the caller OWNER, sets defaultOrgId, and audits', async () => {
      const user = await seedUser()

      const res = await POST(
        buildRequest({
          method: 'POST',
          path: '/api/organizations',
          session: { userId: user.id, orgId: null, orgRole: null, onboarded: false },
          body: {
            name: 'Acme Corp',
            country: 'us',
            baseCurrency: 'usd',
            costCentres: ['ENG'],
          },
        }),
      )

      expect(res.status).toBe(201)
      const body = await expectMatchesContract(res, organizationContracts.create.output)
      expect(body.name).toBe('Acme Corp')
      expect(body.slug).toBe('acme-corp')
      expect(body.country).toBe('US')
      expect(body.baseCurrency).toBe('USD')
      expect(body.costCentres).toEqual(['ENG'])
      expect(body.airwallexAccountId).toBeNull()

      const membership = await memberships.findMembershipInOrg(body.id, user.id)
      expect(membership).toMatchObject({
        orgRole: OrgRole.OWNER,
        status: MembershipStatus.ACTIVE,
      })

      const updated = await users.findUserById(user.id)
      expect(updated?.defaultOrgId).toBe(body.id)

      const audits = await AuditLogModel.find({
        orgId: body.id,
        action: 'organization.created',
      }).exec()
      expect(audits).toHaveLength(1)
      expect(audits[0]?.actorId).toBe(user.id)
      expect(audits[0]?.subjectId).toBe(body.id)
    })

    it('rejects an explicit slug that is already taken', async () => {
      const first = await seedUser()
      await POST(
        buildRequest({
          method: 'POST',
          path: '/api/organizations',
          session: { userId: first.id, orgId: null, orgRole: null, onboarded: false },
          body: { name: 'First', slug: 'taken-slug', country: 'US', baseCurrency: 'USD' },
        }),
      )

      const second = await seedUser()
      const res = await POST(
        buildRequest({
          method: 'POST',
          path: '/api/organizations',
          session: { userId: second.id, orgId: null, orgRole: null, onboarded: false },
          body: { name: 'Second', slug: 'taken-slug', country: 'US', baseCurrency: 'USD' },
        }),
      )
      const body = await readBody<{ error: { code: string } }>(res)
      expect(res.status).toBe(409)
      expect(body.error.code).toBe(ErrorCode.CONFLICT)
    })
  })

  describe('GET /api/organizations/:id', () => {
    // Matrix #1
    it('returns 401 when unauthenticated', async () => {
      const res = await GET(
        buildRequest({
          method: 'GET',
          path: '/api/organizations/x',
          session: null,
          params: { id: 'x' },
        }),
      )
      expect(res.status).toBe(401)
    })

    // Matrix #2
    it('returns 403 when authenticated with no organisation', async () => {
      const user = await seedUser()
      const res = await GET(
        buildRequest({
          method: 'GET',
          path: '/api/organizations/x',
          session: { userId: user.id, orgId: null, orgRole: null, onboarded: false },
          params: { id: 'x' },
        }),
      )
      const body = await readBody<{ error: { code: string } }>(res)
      expect(res.status).toBe(403)
      expect(body.error.code).toBe(ErrorCode.ONBOARDING_INCOMPLETE)
    })

    // Matrix #3
    it('returns 404 for a different org (never 403)', async () => {
      const a = await seedMember()
      const b = await seedMember()

      const res = await GET(
        buildRequest({
          method: 'GET',
          path: `/api/organizations/${b.org.id}`,
          session: a.session,
          params: { id: b.org.id },
        }),
      )
      const body = await readBody<{ error: { code: string } }>(res)
      expect(res.status).toBe(404)
      expect(body.error.code).toBe(ErrorCode.NOT_FOUND)
    })

    // Matrix #4–6, #9–10 — N/A (any member may read; no body; read-only)

    // Matrix #7
    it('returns the organisation for a member', async () => {
      const { org, session } = await seedMember({ role: OrgRole.MEMBER })

      const res = await GET(
        buildRequest({
          method: 'GET',
          path: `/api/organizations/${org.id}`,
          session,
          params: { id: org.id },
        }),
      )

      expect(res.status).toBe(200)
      const body = await expectMatchesContract(res, organizationContracts.get.output)
      expect(body.id).toBe(org.id)
      expect(body.name).toBe(org.name)
    })

    // Matrix #8
    it('returns 404 for an unknown id in the active org slot', async () => {
      const { session } = await seedMember()
      const fakeId = '507f1f77bcf86cd799439011'

      const res = await GET(
        buildRequest({
          method: 'GET',
          path: `/api/organizations/${fakeId}`,
          session: { ...session, orgId: fakeId },
          params: { id: fakeId },
        }),
      )
      expect(res.status).toBe(404)
    })
  })

  describe('PATCH /api/organizations/:id', () => {
    // Matrix #1
    it('returns 401 when unauthenticated', async () => {
      const res = await PATCH(
        buildRequest({
          method: 'PATCH',
          path: '/api/organizations/x',
          session: null,
          params: { id: 'x' },
          body: { name: 'Nope' },
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
          path: '/api/organizations/x',
          session: { userId: user.id, orgId: null, orgRole: null, onboarded: false },
          params: { id: 'x' },
          body: { name: 'Nope' },
        }),
      )
      const body = await readBody<{ error: { code: string } }>(res)
      expect(res.status).toBe(403)
      expect(body.error.code).toBe(ErrorCode.ONBOARDING_INCOMPLETE)
    })

    // Matrix #3
    it('returns 404 when patching a different org', async () => {
      const a = await seedMember()
      const b = await seedMember()

      const res = await PATCH(
        buildRequest({
          method: 'PATCH',
          path: `/api/organizations/${b.org.id}`,
          session: a.session,
          params: { id: b.org.id },
          body: { name: 'Hijack' },
        }),
      )
      expect(res.status).toBe(404)
    })

    // Matrix #4
    it('returns 403 when the member lacks org.manage', async () => {
      const { org, session } = await seedMember({ role: OrgRole.MEMBER })

      const res = await PATCH(
        buildRequest({
          method: 'PATCH',
          path: `/api/organizations/${org.id}`,
          session,
          params: { id: org.id },
          body: { name: 'Denied' },
        }),
      )
      const body = await readBody<{ error: { code: string; message: string } }>(res)
      expect(res.status).toBe(403)
      expect(body.error.code).toBe(ErrorCode.PERMISSION_DENIED)
      expect(body.error.message).toMatch(/org\.manage/)
    })

    // Matrix #5 — N/A (no project access scope)
    // Matrix #9 — N/A (no idempotency key)

    // Matrix #6
    it('returns 422 for an empty patch', async () => {
      const { org, session } = await seedMember()

      const res = await PATCH(
        buildRequest({
          method: 'PATCH',
          path: `/api/organizations/${org.id}`,
          session,
          params: { id: org.id },
          body: {},
        }),
      )
      const body = await readBody<{ error: { code: string } }>(res)
      expect(res.status).toBe(422)
      expect(body.error.code).toBe(ErrorCode.VALIDATION_FAILED)
    })

    // Matrix #7 + #10
    it('updates fields for an OWNER and writes one audit entry', async () => {
      const { org, session } = await seedMember({ role: OrgRole.OWNER })

      const res = await PATCH(
        buildRequest({
          method: 'PATCH',
          path: `/api/organizations/${org.id}`,
          session,
          params: { id: org.id },
          body: {
            name: 'Renamed Org',
            costCentres: ['OPS', 'FIN'],
            settings: { defaultApprovalPolicy: null, notifications: { digests: true } },
          },
        }),
      )

      expect(res.status).toBe(200)
      const body = await expectMatchesContract(res, organizationContracts.update.output)
      expect(body.name).toBe('Renamed Org')
      expect(body.costCentres).toEqual(['OPS', 'FIN'])
      expect(body.settings.notifications).toEqual({ digests: true })

      const audits = await AuditLogModel.find({
        orgId: org.id,
        action: 'organization.updated',
      }).exec()
      expect(audits).toHaveLength(1)
      expect(audits[0]?.actorId).toBe(session.userId)
      expect(audits[0]?.subjectId).toBe(org.id)
    })

    // Matrix #8
    it('returns 404 for a missing organisation id matching the session', async () => {
      const { session } = await seedMember()
      const fakeId = '507f1f77bcf86cd799439011'

      const res = await PATCH(
        buildRequest({
          method: 'PATCH',
          path: `/api/organizations/${fakeId}`,
          session: { ...session, orgId: fakeId },
          params: { id: fakeId },
          body: { name: 'Ghost' },
        }),
      )
      expect(res.status).toBe(404)
    })
  })
})
