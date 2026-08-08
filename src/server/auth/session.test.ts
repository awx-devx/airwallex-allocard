import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { useTestDb } from '../../../test/helpers/db'
import { installTestSessionResolver } from '../../../test/helpers/request'
import {
  getExplicitOrgId,
  resolveAuthSession,
  resolveOrgContextForUser,
  resetAuthUserIdReader,
  setAuthUserIdReader,
} from '@/server/auth/session'
import { AppError } from '@/server/http/errors'
import { withAuth } from '@/server/http/withAuth'
import { ok } from '@/server/http/respond'
import { ErrorCode } from '@/shared/enums/errors'
import { MembershipStatus } from '@/shared/enums/membershipStatus'
import { OrgRole } from '@/shared/enums/orgRole'
import { MembershipModel } from '@/server/models/Membership'
import { OrganizationModel } from '@/server/models/Organization'
import { UserModel } from '@/server/models/User'
import * as memberships from '@/server/repositories/memberships'
import * as organizations from '@/server/repositories/organizations'
import * as users from '@/server/repositories/users'

describe('auth/session', () => {
  useTestDb()

  beforeAll(async () => {
    await Promise.all([
      UserModel.syncIndexes(),
      OrganizationModel.syncIndexes(),
      MembershipModel.syncIndexes(),
    ])
  })

  afterEach(() => {
    resetAuthUserIdReader()
    installTestSessionResolver()
  })

  async function seedUserWithOrg(opts?: { role?: OrgRole; slug?: string }) {
    const user = await users.createUser({
      email: `user-${Date.now()}-${Math.random().toString(16).slice(2)}@example.com`,
      name: 'User',
    })
    const org = await organizations.createOrganization({
      name: 'Org',
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
    return { user, org }
  }

  describe('getExplicitOrgId', () => {
    it('reads x-org-id header, then orgId query', () => {
      expect(
        getExplicitOrgId(
          new Request('http://localhost/api/x', { headers: { 'x-org-id': ' org_header ' } }),
        ),
      ).toBe('org_header')

      expect(getExplicitOrgId(new Request('http://localhost/api/x?orgId=org_query'))).toBe(
        'org_query',
      )

      expect(getExplicitOrgId(new Request('http://localhost/api/x'))).toBeUndefined()
    })
  })

  describe('resolveOrgContextForUser', () => {
    it('returns onboarded false with null org when there is no membership', async () => {
      const user = await users.createUser({ email: 'none@example.com', name: 'None' })
      await expect(resolveOrgContextForUser(user.id)).resolves.toEqual({
        orgId: null,
        orgRole: null,
        onboarded: false,
      })
    })

    it('uses explicit orgId when the user is an ACTIVE member', async () => {
      const { user, org } = await seedUserWithOrg({ role: OrgRole.ADMIN })
      await expect(resolveOrgContextForUser(user.id, org.id)).resolves.toEqual({
        orgId: org.id,
        orgRole: OrgRole.ADMIN,
        onboarded: true,
      })
    })

    it('throws NOT_FOUND when explicit orgId is not a membership', async () => {
      const { user } = await seedUserWithOrg()
      const other = await organizations.createOrganization({
        name: 'Other',
        slug: `other-${Date.now()}`,
        country: 'US',
        baseCurrency: 'USD',
        createdBy: user.id,
      })

      await expect(resolveOrgContextForUser(user.id, other.id)).rejects.toMatchObject({
        code: ErrorCode.NOT_FOUND,
      })
    })

    it('throws NOT_FOUND when membership exists but is SUSPENDED', async () => {
      const { user, org } = await seedUserWithOrg({ role: OrgRole.MEMBER })
      await memberships.updateMembership(
        { orgId: org.id, userId: user.id, orgRole: OrgRole.MEMBER },
        user.id,
        { status: MembershipStatus.SUSPENDED },
      )

      await expect(resolveOrgContextForUser(user.id, org.id)).rejects.toBeInstanceOf(AppError)
      await expect(resolveOrgContextForUser(user.id, org.id)).rejects.toMatchObject({
        code: ErrorCode.NOT_FOUND,
      })
    })

    it('falls back to user.defaultOrgId', async () => {
      const { user, org } = await seedUserWithOrg()
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
      await users.updateUser(user.id, { defaultOrgId: second.id })

      await expect(resolveOrgContextForUser(user.id)).resolves.toEqual({
        orgId: second.id,
        orgRole: OrgRole.MEMBER,
        onboarded: true,
      })
      // explicit still wins over default
      await expect(resolveOrgContextForUser(user.id, org.id)).resolves.toEqual({
        orgId: org.id,
        orgRole: OrgRole.OWNER,
        onboarded: true,
      })
    })

    it('falls back to the sole active membership when no default', async () => {
      const { user, org } = await seedUserWithOrg({ role: OrgRole.MEMBER })
      await expect(resolveOrgContextForUser(user.id)).resolves.toEqual({
        orgId: org.id,
        orgRole: OrgRole.MEMBER,
        onboarded: true,
      })
    })

    it('leaves org unset when multiple memberships and no default/explicit', async () => {
      const { user } = await seedUserWithOrg()
      const second = await organizations.createOrganization({
        name: 'Second',
        slug: `multi-${Date.now()}`,
        country: 'US',
        baseCurrency: 'USD',
        createdBy: user.id,
      })
      await memberships.createMembership(
        { orgId: second.id, userId: user.id, orgRole: OrgRole.MEMBER },
        { userId: user.id, orgRole: OrgRole.MEMBER },
      )

      await expect(resolveOrgContextForUser(user.id)).resolves.toEqual({
        orgId: null,
        orgRole: null,
        onboarded: true,
      })
    })
  })

  describe('resolveAuthSession + withAuth', () => {
    it('resolves session from the user-id reader and explicit org header', async () => {
      const { user, org } = await seedUserWithOrg({ role: OrgRole.OWNER })
      setAuthUserIdReader(async () => user.id)

      const req = new Request('http://localhost/api/x', {
        headers: { 'x-org-id': org.id },
      })
      await expect(resolveAuthSession(req)).resolves.toEqual({
        userId: user.id,
        orgId: org.id,
        orgRole: OrgRole.OWNER,
        onboarded: true,
      })
    })

    it('returns null when unauthenticated', async () => {
      setAuthUserIdReader(async () => null)
      await expect(resolveAuthSession(new Request('http://localhost/api/x'))).resolves.toBeNull()
    })

    it('surfaces NOT_FOUND through withAuth for a non-member org', async () => {
      const { user } = await seedUserWithOrg()
      const other = await organizations.createOrganization({
        name: 'Foreign',
        slug: `foreign-${Date.now()}`,
        country: 'US',
        baseCurrency: 'USD',
        createdBy: user.id,
      })

      setAuthUserIdReader(async () => user.id)
      // Use the real resolver for this case
      const { installAuthSessionResolver } = await import('@/server/auth/session')
      installAuthSessionResolver()

      const handler = withAuth(async () => ok({ ok: true }))
      const res = await handler(
        new Request('http://localhost/api/x', {
          headers: { 'x-org-id': other.id },
        }),
      )
      const body = await res.json()

      expect(res.status).toBe(404)
      expect(body.error.code).toBe(ErrorCode.NOT_FOUND)
    })
  })
})
