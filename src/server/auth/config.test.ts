import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { useTestDb } from '../../../test/helpers/db'
import { createMongooseAdapter } from '@/server/auth/adapter'
import {
  authorizeCredentials,
  createAuthConfig,
  isGoogleAuthEnabled,
  shouldRefreshOrgClaims,
  type AuthEnv,
} from '@/server/auth/config'
import { resolveOrgContextForUser } from '@/server/auth/session'
import { hashPassword } from '@/server/auth/password'
import { AccountModel } from '@/server/models/Account'
import { MembershipModel } from '@/server/models/Membership'
import { OrganizationModel } from '@/server/models/Organization'
import { UserModel } from '@/server/models/User'
import { MembershipStatus } from '@/shared/enums/membershipStatus'
import { OrgRole } from '@/shared/enums/orgRole'
import * as memberships from '@/server/repositories/memberships'
import * as organizations from '@/server/repositories/organizations'
import * as users from '@/server/repositories/users'

const baseEnv: AuthEnv = {
  AUTH_SECRET: 'test-secret-at-least-32-chars-long!!',
  AUTH_URL: 'http://localhost:3000',
  AUTH_GOOGLE_ID: undefined,
  AUTH_GOOGLE_SECRET: undefined,
}

describe('auth/config', () => {
  useTestDb()

  afterEach(() => {
    vi.restoreAllMocks()
  })

  beforeAll(async () => {
    await Promise.all([
      UserModel.syncIndexes(),
      AccountModel.syncIndexes(),
      OrganizationModel.syncIndexes(),
      MembershipModel.syncIndexes(),
    ])
  })

  describe('providers', () => {
    it('registers only Credentials when Google env is unset', () => {
      const config = createAuthConfig(baseEnv)
      expect(config.providers).toHaveLength(1)
      expect(isGoogleAuthEnabled(baseEnv)).toBe(false)
    })

    it('registers Google when AUTH_GOOGLE_ID and SECRET are set', () => {
      const withGoogle: AuthEnv = {
        ...baseEnv,
        AUTH_GOOGLE_ID: 'google-client-id',
        AUTH_GOOGLE_SECRET: 'google-client-secret',
      }
      const config = createAuthConfig(withGoogle)
      expect(config.providers).toHaveLength(2)
      expect(isGoogleAuthEnabled(withGoogle)).toBe(true)
    })

    it('uses jwt session strategy and a mongoose adapter', () => {
      const config = createAuthConfig(baseEnv)
      expect(config.session).toEqual({ strategy: 'jwt' })
      expect(config.adapter).toBeDefined()
      expect(config.secret).toBe(baseEnv.AUTH_SECRET)
    })
  })

  describe('credentials authorize', () => {
    it('returns the user for a valid email/password', async () => {
      const passwordHash = await hashPassword('password123')
      const user = await users.createUser({
        email: 'sign-in@example.com',
        name: 'Signer',
        passwordHash,
      })

      const result = await authorizeCredentials({
        email: 'sign-in@example.com',
        password: 'password123',
      })
      expect(result).toMatchObject({
        id: user.id,
        email: 'sign-in@example.com',
        name: 'Signer',
      })
    })

    it('returns null for a bad password or unknown email', async () => {
      const passwordHash = await hashPassword('password123')
      await users.createUser({
        email: 'locked@example.com',
        name: 'Locked',
        passwordHash,
      })

      expect(
        await authorizeCredentials({ email: 'locked@example.com', password: 'wrong' }),
      ).toBeNull()
      expect(
        await authorizeCredentials({ email: 'missing@example.com', password: 'password123' }),
      ).toBeNull()
    })
  })

  describe('mongoose adapter', () => {
    it('creates users and links OAuth accounts', async () => {
      const adapter = createMongooseAdapter()
      const created = await adapter.createUser!({
        id: 'ignored',
        email: 'oauth@example.com',
        emailVerified: null,
        name: 'OAuth User',
        image: null,
      })

      expect(created.id).toEqual(expect.any(String))
      expect(created.email).toBe('oauth@example.com')
      expect(created.emailVerified).toBeNull()

      const byEmail = await adapter.getUserByEmail!('oauth@example.com')
      expect(byEmail?.id).toBe(created.id)

      await adapter.linkAccount!({
        userId: created.id,
        type: 'oidc',
        provider: 'google',
        providerAccountId: 'google-sub-1',
        access_token: 'token',
        token_type: 'bearer',
      })

      const byAccount = await adapter.getUserByAccount!({
        provider: 'google',
        providerAccountId: 'google-sub-1',
      })
      expect(byAccount?.id).toBe(created.id)

      const account = await adapter.getAccount!('google-sub-1', 'google')
      expect(account?.userId).toBe(created.id)
    })
  })

  describe('resolveOrgContextForUser (via JWT path)', () => {
    it('sets onboarded false with null org when there is no membership', async () => {
      const user = await users.createUser({ email: 'solo@example.com', name: 'Solo' })
      await expect(resolveOrgContextForUser(user.id)).resolves.toEqual({
        orgId: null,
        orgRole: null,
        onboarded: false,
      })
    })

    it('uses defaultOrgId membership when present', async () => {
      const user = await users.createUser({ email: 'owner@example.com', name: 'Owner' })
      const org = await organizations.createOrganization({
        name: 'Acme',
        slug: `acme-${Date.now()}`,
        country: 'US',
        baseCurrency: 'USD',
        createdBy: user.id,
      })
      await memberships.createMembership(
        { orgId: org.id, userId: user.id, orgRole: OrgRole.OWNER },
        { userId: user.id, orgRole: OrgRole.OWNER },
      )
      await users.updateUser(user.id, { defaultOrgId: org.id })

      await expect(resolveOrgContextForUser(user.id)).resolves.toEqual({
        orgId: org.id,
        orgRole: OrgRole.OWNER,
        onboarded: true,
      })
    })

    it('falls back to the sole active membership', async () => {
      const user = await users.createUser({ email: 'member@example.com', name: 'Member' })
      const org = await organizations.createOrganization({
        name: 'Beta',
        slug: `beta-${Date.now()}`,
        country: 'US',
        baseCurrency: 'USD',
        createdBy: user.id,
      })
      await memberships.createMembership(
        { orgId: org.id, userId: user.id, orgRole: OrgRole.MEMBER },
        { userId: user.id, orgRole: OrgRole.MEMBER, status: MembershipStatus.ACTIVE },
      )

      await expect(resolveOrgContextForUser(user.id)).resolves.toEqual({
        orgId: org.id,
        orgRole: OrgRole.MEMBER,
        onboarded: true,
      })
    })
  })

  describe('jwt and session callbacks', () => {
    it('writes userId, orgId, orgRole, onboarded onto the token and session', async () => {
      const passwordHash = await hashPassword('password123')
      const user = await users.createUser({
        email: 'jwt@example.com',
        name: 'Jwt',
        passwordHash,
      })
      const org = await organizations.createOrganization({
        name: 'Jwt Org',
        slug: `jwt-org-${Date.now()}`,
        country: 'US',
        baseCurrency: 'USD',
        createdBy: user.id,
      })
      await memberships.createMembership(
        { orgId: org.id, userId: user.id, orgRole: OrgRole.ADMIN },
        { userId: user.id, orgRole: OrgRole.ADMIN },
      )
      await users.updateUser(user.id, { defaultOrgId: org.id })

      const config = createAuthConfig(baseEnv)
      const token = await config.callbacks!.jwt!({
        token: {},
        user: { id: user.id, email: user.email, name: user.name },
        account: null,
        trigger: 'signIn',
      } as never)

      expect(token).toMatchObject({
        userId: user.id,
        orgId: org.id,
        orgRole: OrgRole.ADMIN,
        onboarded: true,
      })

      const session = await config.callbacks!.session!({
        session: {
          user: { name: user.name, email: user.email, image: null },
          expires: new Date(Date.now() + 60_000).toISOString(),
        },
        token,
      } as never)

      expect(session).toMatchObject({
        userId: user.id,
        orgId: org.id,
        orgRole: OrgRole.ADMIN,
        onboarded: true,
        user: { id: user.id },
      })
    })

    it('shouldRefreshOrgClaims is true on sign-in, update, or a token missing onboarded', () => {
      expect(shouldRefreshOrgClaims({ onboarded: true }, 'signIn', true)).toBe(true)
      expect(shouldRefreshOrgClaims({ onboarded: true }, 'update', false)).toBe(true)
      expect(shouldRefreshOrgClaims({}, undefined, false)).toBe(true)
      expect(shouldRefreshOrgClaims({ onboarded: true }, undefined, false)).toBe(false)
      expect(shouldRefreshOrgClaims({ onboarded: false }, undefined, false)).toBe(false)
    })

    it('keeps cached org claims on a session poll and does not hit memberships', async () => {
      const spy = vi.spyOn(memberships, 'hasActiveMembership')
      const config = createAuthConfig(baseEnv)
      const token = await config.callbacks!.jwt!({
        token: {
          userId: 'cached-user',
          orgId: 'cached-org',
          orgRole: OrgRole.OWNER,
          onboarded: true,
        },
      } as never)

      expect(token).toMatchObject({
        userId: 'cached-user',
        orgId: 'cached-org',
        orgRole: OrgRole.OWNER,
        onboarded: true,
      })
      expect(spy).not.toHaveBeenCalled()
    })

    it('recomputes org claims on session update after membership change', async () => {
      const passwordHash = await hashPassword('password123')
      const user = await users.createUser({
        email: `jwt-update-${Date.now()}@example.com`,
        name: 'Jwt Update',
        passwordHash,
      })
      const org = await organizations.createOrganization({
        name: 'Jwt Update Org',
        slug: `jwt-update-${Date.now()}`,
        country: 'US',
        baseCurrency: 'USD',
        createdBy: user.id,
      })
      await memberships.createMembership(
        { orgId: org.id, userId: user.id, orgRole: OrgRole.OWNER },
        { userId: user.id, orgRole: OrgRole.OWNER },
      )

      const config = createAuthConfig(baseEnv)
      await memberships.updateMembership(
        { orgId: org.id, userId: user.id, orgRole: OrgRole.OWNER },
        user.id,
        { status: MembershipStatus.SUSPENDED },
      )

      const token = await config.callbacks!.jwt!({
        token: {
          userId: user.id,
          orgId: org.id,
          orgRole: OrgRole.OWNER,
          onboarded: true,
        },
        trigger: 'update',
      } as never)

      expect(token).toMatchObject({
        userId: user.id,
        orgId: null,
        orgRole: null,
        onboarded: false,
      })
    })

    it('keeps cached claims when org refresh throws instead of wiping the session', async () => {
      vi.spyOn(memberships, 'hasActiveMembership').mockRejectedValueOnce(
        new Error('getaddrinfo ENOTFOUND'),
      )
      const config = createAuthConfig(baseEnv)
      const token = await config.callbacks!.jwt!({
        token: {
          userId: 'still-here',
          orgId: 'still-org',
          orgRole: OrgRole.ADMIN,
          onboarded: true,
        },
        trigger: 'update',
      } as never)

      expect(token).toMatchObject({
        userId: 'still-here',
        orgId: 'still-org',
        orgRole: OrgRole.ADMIN,
        onboarded: true,
      })
    })
  })
})
