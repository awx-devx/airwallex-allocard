import { beforeAll, describe, expect, it } from 'vitest'
import { useTestDb } from '../../../test/helpers/db'
import { InviteStatus } from '@/shared/enums/inviteStatus'
import { OrgRole } from '@/shared/enums/orgRole'
import { InviteModel } from '@/server/models/Invite'
import { MembershipModel } from '@/server/models/Membership'
import { OrganizationModel } from '@/server/models/Organization'
import { UserModel } from '@/server/models/User'
import type { OrgContext } from '@/server/http/types'
import * as invites from '@/server/repositories/invites'
import * as memberships from '@/server/repositories/memberships'
import * as organizations from '@/server/repositories/organizations'
import * as users from '@/server/repositories/users'

describe('repositories', () => {
  useTestDb()

  beforeAll(async () => {
    await Promise.all([
      UserModel.syncIndexes(),
      OrganizationModel.syncIndexes(),
      MembershipModel.syncIndexes(),
      InviteModel.syncIndexes(),
    ])
  })

  describe('users', () => {
    it('creates and finds by id/email without passwordHash', async () => {
      const created = await users.createUser({
        email: 'Ada@Example.com',
        name: 'Ada',
        passwordHash: 'secret-hash',
      })

      expect(created.email).toBe('ada@example.com')
      expect(created).not.toHaveProperty('passwordHash')

      const byId = await users.findUserById(created.id)
      expect(byId).toEqual(created)

      const byEmail = await users.findUserByEmail('ADA@example.com')
      expect(byEmail?.id).toBe(created.id)
      expect(byEmail).not.toHaveProperty('passwordHash')
    })

    it('returns credentials with passwordHash for sign-in', async () => {
      const created = await users.createUser({
        email: 'creds@example.com',
        name: 'Creds',
        passwordHash: 'argon-hash',
      })

      const creds = await users.findUserCredentialsByEmail('creds@example.com')
      expect(creds).toMatchObject({
        id: created.id,
        email: 'creds@example.com',
        passwordHash: 'argon-hash',
      })
    })

    it('updates and clears optional fields', async () => {
      const created = await users.createUser({
        email: 'patch@example.com',
        name: 'Before',
        image: 'https://example.com/a.png',
        defaultOrgId: '507f1f77bcf86cd799439011',
      })

      const updated = await users.updateUser(created.id, {
        name: 'After',
        image: null,
        defaultOrgId: null,
      })

      expect(updated?.name).toBe('After')
      expect(updated?.image).toBeUndefined()
      expect(updated?.defaultOrgId).toBeUndefined()
    })

    it('returns null for invalid ids', async () => {
      expect(await users.findUserById('not-an-id')).toBeNull()
    })
  })

  describe('organizations', () => {
    it('creates, finds, and updates', async () => {
      const owner = await users.createUser({ email: 'owner@example.com', name: 'Owner' })

      const org = await organizations.createOrganization({
        name: 'Acme',
        slug: 'Acme',
        country: 'us',
        baseCurrency: 'usd',
        createdBy: owner.id,
        costCentres: ['ENG'],
      })

      expect(org.slug).toBe('acme')
      expect(org.country).toBe('US')
      expect(org.baseCurrency).toBe('USD')
      expect(org.airwallexAccountId).toBeNull()
      expect(org).not.toHaveProperty('createdBy')

      expect(await organizations.findOrganizationBySlug('acme')).toMatchObject({ id: org.id })
      expect(await organizations.findOrganizationById(org.id)).toMatchObject({ name: 'Acme' })

      const patched = await organizations.updateOrganization(org.id, {
        name: 'Acme Corp',
        settings: { defaultApprovalPolicy: null, notifications: { weekly: true } },
      })
      expect(patched?.name).toBe('Acme Corp')
      expect(patched?.settings.notifications).toEqual({ weekly: true })
    })
  })

  describe('memberships', () => {
    async function seedOrgMember() {
      const user = await users.createUser({ email: `u-${Date.now()}@example.com`, name: 'Member' })
      const org = await organizations.createOrganization({
        name: 'Org',
        slug: `org-${Date.now()}`,
        country: 'US',
        baseCurrency: 'USD',
        createdBy: user.id,
      })
      const ctx: OrgContext = { orgId: org.id, userId: user.id, orgRole: OrgRole.OWNER }
      const membership = await memberships.createMembership(ctx, {
        userId: user.id,
        orgRole: OrgRole.OWNER,
      })
      return { user, org, ctx, membership }
    }

    it('scopes list/find/update/remove by org', async () => {
      const { user, org, ctx, membership } = await seedOrgMember()

      const listed = await memberships.listMemberships(ctx)
      expect(listed).toHaveLength(1)
      expect(listed[0]?.id).toBe(membership.id)

      const found = await memberships.findMembership(ctx, user.id)
      expect(found?.orgRole).toBe(OrgRole.OWNER)

      const updated = await memberships.updateMembership(ctx, user.id, {
        orgRole: OrgRole.ADMIN,
      })
      expect(updated?.orgRole).toBe(OrgRole.ADMIN)

      const withUsers = await memberships.listMembershipsWithUsers(ctx)
      expect(withUsers[0]?.user.email).toBe(user.email)

      const withOrgs = await memberships.listMembershipsWithOrgsForUser(user.id)
      expect(withOrgs[0]?.org).toEqual({ id: org.id, name: org.name, slug: org.slug })

      expect(await memberships.hasActiveMembership(user.id)).toBe(true)
      expect(await memberships.countOwners(ctx)).toBe(0) // demoted from OWNER

      await memberships.updateMembership(ctx, user.id, { orgRole: OrgRole.OWNER })
      expect(await memberships.countOwners(ctx)).toBe(1)

      expect(await memberships.removeMembership(ctx, user.id)).toBe(true)
      expect(await memberships.findMembership(ctx, user.id)).toBeNull()
      expect(await memberships.hasActiveMembership(user.id)).toBe(false)
    })

    it('does not leak another org membership via ctx', async () => {
      const a = await seedOrgMember()
      const b = await seedOrgMember()

      expect(await memberships.findMembership(a.ctx, b.user.id)).toBeNull()
      expect(await memberships.listMemberships(a.ctx).then((m) => m.map((x) => x.userId))).toEqual([
        a.user.id,
      ])
    })
  })

  describe('invites', () => {
    async function seedOrg() {
      const user = await users.createUser({
        email: `inviter-${Date.now()}@example.com`,
        name: 'Inviter',
      })
      const org = await organizations.createOrganization({
        name: 'Invite Org',
        slug: `invite-org-${Date.now()}`,
        country: 'US',
        baseCurrency: 'USD',
        createdBy: user.id,
      })
      const ctx: OrgContext = { orgId: org.id, userId: user.id, orgRole: OrgRole.OWNER }
      return { user, org, ctx }
    }

    it('creates, lists, revokes without exposing tokenHash', async () => {
      const { ctx, user } = await seedOrg()
      const invite = await invites.createInvite(ctx, {
        email: 'New@Example.com',
        orgRole: OrgRole.MEMBER,
        tokenHash: 'hash-abc',
        expiresAt: new Date(Date.now() + 86_400_000),
        invitedBy: user.id,
      })

      expect(invite.email).toBe('new@example.com')
      expect(invite).not.toHaveProperty('tokenHash')
      expect(invite.status).toBe(InviteStatus.PENDING)

      const listed = await invites.listPendingInvites(ctx)
      expect(listed).toHaveLength(1)

      const byToken = await invites.findInviteByTokenHash('hash-abc')
      expect(byToken?.id).toBe(invite.id)

      const byEmail = await invites.listPendingInvitesByEmail('new@example.com')
      expect(byEmail[0]?.id).toBe(invite.id)

      const revoked = await invites.revokeInvite(ctx, invite.id)
      expect(revoked?.status).toBe(InviteStatus.REVOKED)
      expect(await invites.listPendingInvites(ctx)).toHaveLength(0)
    })

    it('acceptInviteByTokenHash is single-use and rejects expired', async () => {
      const { ctx, user } = await seedOrg()
      const pending = await invites.createInvite(ctx, {
        email: 'accept@example.com',
        orgRole: OrgRole.MEMBER,
        tokenHash: 'hash-accept',
        expiresAt: new Date(Date.now() + 86_400_000),
        invitedBy: user.id,
      })

      const accepted = await invites.acceptInviteByTokenHash('hash-accept')
      expect(accepted?.status).toBe(InviteStatus.ACCEPTED)
      expect(accepted?.id).toBe(pending.id)
      expect(await invites.acceptInviteByTokenHash('hash-accept')).toBeNull()

      await invites.createInvite(ctx, {
        email: 'expired@example.com',
        orgRole: OrgRole.MEMBER,
        tokenHash: 'hash-expired',
        expiresAt: new Date(Date.now() - 1000),
        invitedBy: user.id,
      })
      expect(await invites.acceptInviteByTokenHash('hash-expired')).toBeNull()
    })
  })
})
