import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { GET, PATCH } from '@/app/api/me/route'
import { AuditLogModel } from '@/server/models/AuditLog'
import { MembershipModel } from '@/server/models/Membership'
import { OrganizationModel } from '@/server/models/Organization'
import { UserModel } from '@/server/models/User'
import * as memberships from '@/server/repositories/memberships'
import * as organizations from '@/server/repositories/organizations'
import * as users from '@/server/repositories/users'
import { PLATFORM_ORG_ID } from '@/server/services/auth/signUp'
import { authContracts } from '@/shared/contracts/auth'
import { ErrorCode } from '@/shared/enums/errors'
import { MembershipStatus } from '@/shared/enums/membershipStatus'
import { OrgRole } from '@/shared/enums/orgRole'
import { expectMatchesContract } from '../helpers/contract'
import { useTestDb } from '../helpers/db'
import { buildRequest, installTestSessionResolver, readBody } from '../helpers/request'

describe('/api/me', () => {
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

  async function seedUser(opts?: { name?: string }) {
    return users.createUser({
      email: `user-${Date.now()}-${Math.random().toString(16).slice(2)}@example.com`,
      name: opts?.name ?? 'Me User',
    })
  }

  async function seedUserWithOrg(opts?: { role?: OrgRole; slug?: string }) {
    const user = await seedUser()
    const org = await organizations.createOrganization({
      name: 'My Org',
      slug: opts?.slug ?? `org-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      country: 'US',
      baseCurrency: 'USD',
      createdBy: user.id,
    })
    const role = opts?.role ?? OrgRole.OWNER
    await memberships.createMembership(
      { orgId: org.id, userId: user.id, orgRole: role },
      { userId: user.id, orgRole: role },
    )
    return { user, org, role }
  }

  describe('GET', () => {
    // Matrix #1
    it('returns 401 when unauthenticated', async () => {
      const res = await GET(buildRequest({ method: 'GET', path: '/api/me', session: null }))
      const body = await readBody<{ error: { code: string } }>(res)

      expect(res.status).toBe(401)
      expect(body.error.code).toBe(ErrorCode.UNAUTHENTICATED)
    })

    // Matrix #2 — N/A as failure: this endpoint serves the not-yet-onboarded shell.
    it('returns me for an authenticated user with no organisation', async () => {
      const user = await seedUser({ name: 'Solo' })

      const res = await GET(
        buildRequest({
          method: 'GET',
          path: '/api/me',
          session: { userId: user.id, orgId: null, orgRole: null, onboarded: false },
        }),
      )

      expect(res.status).toBe(200)
      const body = await expectMatchesContract(res, authContracts.me.output)
      expect(body.user.id).toBe(user.id)
      expect(body.user.name).toBe('Solo')
      expect(body.memberships).toEqual([])
      expect(body.onboarded).toBe(false)
      expect(body.activeOrg).toBeUndefined()
      expect(body.user).not.toHaveProperty('passwordHash')
    })

    // Matrix #3
    it('returns 404 when requesting an org the user is not a member of', async () => {
      const { user } = await seedUserWithOrg()
      const other = await organizations.createOrganization({
        name: 'Other',
        slug: `other-${Date.now()}`,
        country: 'US',
        baseCurrency: 'USD',
        createdBy: user.id,
      })

      const res = await GET(
        buildRequest({
          method: 'GET',
          path: '/api/me',
          session: {
            userId: user.id,
            orgId: null,
            orgRole: null,
            onboarded: true,
          },
          headers: { 'x-org-id': other.id },
        }),
      )
      const body = await readBody<{ error: { code: string } }>(res)

      expect(res.status).toBe(404)
      expect(body.error.code).toBe(ErrorCode.NOT_FOUND)
    })

    // Matrix #4 — N/A (any authenticated user may call GET /api/me)
    // Matrix #5 — N/A (no project access scope)
    // Matrix #6 — N/A (no input body)
    // Matrix #8 — N/A for GET without a resource id (missing user → 404 covered via deleted edge)
    // Matrix #9 — N/A (read)
    // Matrix #10 — N/A (read)

    // Matrix #7
    it('returns user, memberships with org summary, activeOrg, and onboarded', async () => {
      const { user, org, role } = await seedUserWithOrg({ role: OrgRole.ADMIN })

      const res = await GET(
        buildRequest({
          method: 'GET',
          path: '/api/me',
          session: {
            userId: user.id,
            orgId: org.id,
            orgRole: role,
            onboarded: true,
          },
        }),
      )

      expect(res.status).toBe(200)
      const body = await expectMatchesContract(res, authContracts.me.output)
      expect(body.onboarded).toBe(true)
      expect(body.activeOrg?.id).toBe(org.id)
      expect(body.memberships).toHaveLength(1)
      expect(body.memberships[0]).toMatchObject({
        orgId: org.id,
        userId: user.id,
        orgRole: OrgRole.ADMIN,
        status: MembershipStatus.ACTIVE,
        org: { id: org.id, name: org.name, slug: org.slug },
      })
    })
  })

  describe('PATCH', () => {
    // Matrix #1
    it('returns 401 when unauthenticated', async () => {
      const res = await PATCH(
        buildRequest({
          method: 'PATCH',
          path: '/api/me',
          session: null,
          body: { name: 'Nope' },
        }),
      )
      const body = await readBody<{ error: { code: string } }>(res)

      expect(res.status).toBe(401)
      expect(body.error.code).toBe(ErrorCode.UNAUTHENTICATED)
    })

    // Matrix #2 — N/A as failure: profile updates are allowed before onboarding.
    it('updates name for a user with no organisation', async () => {
      const user = await seedUser({ name: 'Before' })

      const res = await PATCH(
        buildRequest({
          method: 'PATCH',
          path: '/api/me',
          session: { userId: user.id, orgId: null, orgRole: null, onboarded: false },
          body: { name: 'After' },
        }),
      )

      expect(res.status).toBe(200)
      const body = await expectMatchesContract(res, authContracts.updateMe.output)
      expect(body.user.name).toBe('After')
      expect(body.onboarded).toBe(false)

      const audits = await AuditLogModel.find({
        orgId: PLATFORM_ORG_ID,
        action: 'user.updated',
      }).exec()
      expect(audits).toHaveLength(1)
      expect(audits[0]?.subjectId).toBe(user.id)
      expect(audits[0]?.actorId).toBe(user.id)
    })

    // Matrix #3 — setting defaultOrgId to a non-member org → 404
    it('returns 404 when defaultOrgId is an org the user is not a member of', async () => {
      const { user } = await seedUserWithOrg()
      const other = await organizations.createOrganization({
        name: 'Other',
        slug: `other-patch-${Date.now()}`,
        country: 'US',
        baseCurrency: 'USD',
        createdBy: user.id,
      })

      const res = await PATCH(
        buildRequest({
          method: 'PATCH',
          path: '/api/me',
          session: {
            userId: user.id,
            orgId: null,
            orgRole: null,
            onboarded: true,
          },
          body: { defaultOrgId: other.id },
        }),
      )
      const body = await readBody<{ error: { code: string } }>(res)

      expect(res.status).toBe(404)
      expect(body.error.code).toBe(ErrorCode.NOT_FOUND)
    })

    // Matrix #4 — N/A (self-service; no permission gate)
    // Matrix #5 — N/A (no project access scope)
    // Matrix #9 — N/A (no idempotency key on this endpoint)

    // Matrix #6
    it('returns 422 for an invalid payload', async () => {
      const user = await seedUser()

      const res = await PATCH(
        buildRequest({
          method: 'PATCH',
          path: '/api/me',
          session: { userId: user.id, orgId: null, orgRole: null, onboarded: false },
          body: {},
        }),
      )
      const body = await readBody<{ error: { code: string } }>(res)

      expect(res.status).toBe(422)
      expect(body.error.code).toBe(ErrorCode.VALIDATION_FAILED)
    })

    // Matrix #7 + #10
    it('updates name, image, and defaultOrgId and writes one audit entry', async () => {
      const { user, org, role } = await seedUserWithOrg()
      const second = await organizations.createOrganization({
        name: 'Second',
        slug: `second-${Date.now()}`,
        country: 'US',
        baseCurrency: 'USD',
        createdBy: user.id,
      })
      await memberships.createMembership(
        { orgId: second.id, userId: user.id, orgRole: OrgRole.MEMBER },
        { userId: user.id, orgRole: OrgRole.MEMBER },
      )

      const res = await PATCH(
        buildRequest({
          method: 'PATCH',
          path: '/api/me',
          session: {
            userId: user.id,
            orgId: org.id,
            orgRole: role,
            onboarded: true,
          },
          body: {
            name: 'Renamed',
            image: 'https://example.com/a.png',
            defaultOrgId: second.id,
          },
        }),
      )

      expect(res.status).toBe(200)
      const body = await expectMatchesContract(res, authContracts.updateMe.output)
      expect(body.user.name).toBe('Renamed')
      expect(body.user.image).toBe('https://example.com/a.png')
      expect(body.user.defaultOrgId).toBe(second.id)
      expect(body.activeOrg?.id).toBe(second.id)
      expect(body.memberships).toHaveLength(2)

      const audits = await AuditLogModel.find({
        orgId: org.id,
        action: 'user.updated',
        subjectId: user.id,
      }).exec()
      expect(audits).toHaveLength(1)
      expect(audits[0]?.actorId).toBe(user.id)
    })

    it('clears image and defaultOrgId when set to null', async () => {
      const { user, org, role } = await seedUserWithOrg()
      await users.updateUser(user.id, {
        image: 'https://example.com/old.png',
        defaultOrgId: org.id,
      })

      const res = await PATCH(
        buildRequest({
          method: 'PATCH',
          path: '/api/me',
          session: {
            userId: user.id,
            orgId: org.id,
            orgRole: role,
            onboarded: true,
          },
          body: { image: null, defaultOrgId: null },
        }),
      )

      expect(res.status).toBe(200)
      const body = await expectMatchesContract(res, authContracts.updateMe.output)
      expect(body.user.image).toBeUndefined()
      expect(body.user.defaultOrgId).toBeUndefined()
    })

    // Matrix #8
    it('returns 404 when defaultOrgId points at a suspended membership', async () => {
      const { user, org, role } = await seedUserWithOrg()
      await memberships.updateMembership(
        { orgId: org.id, userId: user.id, orgRole: role },
        user.id,
        { status: MembershipStatus.SUSPENDED },
      )

      const res = await PATCH(
        buildRequest({
          method: 'PATCH',
          path: '/api/me',
          session: {
            userId: user.id,
            orgId: null,
            orgRole: null,
            onboarded: false,
          },
          body: { defaultOrgId: org.id },
        }),
      )
      const body = await readBody<{ error: { code: string } }>(res)

      expect(res.status).toBe(404)
      expect(body.error.code).toBe(ErrorCode.NOT_FOUND)
    })
  })
})
