import { describe, expect, it, beforeAll } from 'vitest'
import { useTestDb } from '../../../test/helpers/db'
import { InviteStatus } from '@/shared/enums/inviteStatus'
import { MembershipStatus } from '@/shared/enums/membershipStatus'
import { OrgRole } from '@/shared/enums/orgRole'
import { InviteModel } from '@/server/models/Invite'
import { MembershipModel } from '@/server/models/Membership'
import { OrganizationModel } from '@/server/models/Organization'
import { UserModel } from '@/server/models/User'
import { toDomain } from '@/server/models/base'

async function syncAllIndexes(): Promise<void> {
  await Promise.all([
    UserModel.syncIndexes(),
    OrganizationModel.syncIndexes(),
    MembershipModel.syncIndexes(),
    InviteModel.syncIndexes(),
  ])
}

describe('models/identity', () => {
  useTestDb()

  beforeAll(async () => {
    await syncAllIndexes()
  })

  describe('User', () => {
    it('enforces unique lowercased email', async () => {
      await UserModel.create({
        email: 'Owner@Example.com',
        name: 'Owner',
        passwordHash: 'hash-1',
      })

      await expect(
        UserModel.create({
          email: 'owner@example.com',
          name: 'Other',
          passwordHash: 'hash-2',
        }),
      ).rejects.toMatchObject({ code: 11000 })

      const stored = await UserModel.findOne({ email: 'owner@example.com' }).exec()
      expect(stored?.email).toBe('owner@example.com')
    })

    it('omits passwordHash from toJSON even when selected', async () => {
      const created = await UserModel.create({
        email: 'secret@example.com',
        name: 'Secret',
        passwordHash: 'super-secret-hash',
      })

      expect(created.toJSON()).not.toHaveProperty('passwordHash')

      const withHash = await UserModel.findById(created.id).select('+passwordHash').exec()
      expect(withHash).not.toBeNull()
      expect(withHash!.passwordHash).toBe('super-secret-hash')
      expect(withHash!.toJSON()).not.toHaveProperty('passwordHash')

      const domain = toDomain<Record<string, unknown>>(withHash!)
      expect(domain).not.toHaveProperty('passwordHash')
      expect(domain.id).toEqual(expect.any(String))
      expect(typeof domain.createdAt).toBe('string')
    })

    it('does not return passwordHash on default find', async () => {
      const created = await UserModel.create({
        email: 'plain@example.com',
        name: 'Plain',
        passwordHash: 'hidden',
      })

      const found = await UserModel.findById(created.id).exec()
      expect(found).not.toBeNull()
      expect(found!.passwordHash).toBeUndefined()
      expect(found!.toJSON()).not.toHaveProperty('passwordHash')
    })
  })

  describe('Organization', () => {
    it('enforces unique slug', async () => {
      await OrganizationModel.create({
        name: 'Acme',
        slug: 'acme',
        country: 'US',
        baseCurrency: 'USD',
        costCentres: [],
        settings: { defaultApprovalPolicy: null, notifications: {} },
        airwallexAccountId: null,
        createdBy: 'user_1',
      })

      await expect(
        OrganizationModel.create({
          name: 'Acme 2',
          slug: 'acme',
          country: 'US',
          baseCurrency: 'USD',
          costCentres: [],
          settings: { defaultApprovalPolicy: null, notifications: {} },
          airwallexAccountId: null,
          createdBy: 'user_2',
        }),
      ).rejects.toMatchObject({ code: 11000 })
    })

    it('emits id and ISO createdAt via toJSON', async () => {
      const org = await OrganizationModel.create({
        name: 'Beta',
        slug: 'beta',
        country: 'GB',
        baseCurrency: 'GBP',
        costCentres: ['ENG'],
        settings: { defaultApprovalPolicy: null, notifications: { digest: true } },
        airwallexAccountId: null,
        createdBy: 'user_1',
      })

      const json = org.toJSON() as Record<string, unknown>
      expect(json.id).toEqual(expect.any(String))
      expect(json).not.toHaveProperty('_id')
      expect(typeof json.createdAt).toBe('string')
      expect(json.airwallexAccountId).toBeNull()
      expect(json.settings).toEqual({
        defaultApprovalPolicy: null,
        notifications: { digest: true },
      })
    })
  })

  describe('Membership', () => {
    it('enforces unique (orgId, userId)', async () => {
      await MembershipModel.create({
        orgId: 'org_1',
        userId: 'user_1',
        orgRole: OrgRole.OWNER,
        status: MembershipStatus.ACTIVE,
        joinedAt: new Date(),
      })

      await expect(
        MembershipModel.create({
          orgId: 'org_1',
          userId: 'user_1',
          orgRole: OrgRole.MEMBER,
          status: MembershipStatus.ACTIVE,
          joinedAt: new Date(),
        }),
      ).rejects.toMatchObject({ code: 11000 })
    })

    it('requires orgId on queries (tenantScoped)', async () => {
      await expect(MembershipModel.find({}).exec()).rejects.toThrow(
        /Tenant scope missing on Membership\.find/,
      )

      await MembershipModel.create({
        orgId: 'org_1',
        userId: 'user_2',
        orgRole: OrgRole.MEMBER,
        status: MembershipStatus.ACTIVE,
        joinedAt: new Date(),
      })

      const docs = await MembershipModel.find({ orgId: 'org_1' }).exec()
      expect(docs).toHaveLength(1)
    })

    it('emits ISO joinedAt via toJSON', async () => {
      const joinedAt = new Date('2026-01-15T12:00:00.000Z')
      const doc = await MembershipModel.create({
        orgId: 'org_1',
        userId: 'user_3',
        orgRole: OrgRole.ADMIN,
        status: MembershipStatus.ACTIVE,
        joinedAt,
      })

      const json = doc.toJSON() as Record<string, unknown>
      expect(json.joinedAt).toBe('2026-01-15T12:00:00.000Z')
      expect(json.id).toEqual(expect.any(String))
    })
  })

  describe('Invite', () => {
    it('enforces unique tokenHash', async () => {
      await InviteModel.create({
        orgId: 'org_1',
        email: 'invitee@example.com',
        orgRole: OrgRole.MEMBER,
        tokenHash: 'token-hash-1',
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        status: InviteStatus.PENDING,
        invitedBy: 'user_1',
      })

      await expect(
        InviteModel.create({
          orgId: 'org_1',
          email: 'other@example.com',
          orgRole: OrgRole.MEMBER,
          tokenHash: 'token-hash-1',
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          status: InviteStatus.PENDING,
          invitedBy: 'user_1',
        }),
      ).rejects.toMatchObject({ code: 11000 })
    })

    it('omits tokenHash from toJSON even when selected', async () => {
      const created = await InviteModel.create({
        orgId: 'org_1',
        email: 'preview@example.com',
        orgRole: OrgRole.ADMIN,
        tokenHash: 'raw-token-hash',
        expiresAt: new Date('2026-08-15T00:00:00.000Z'),
        status: InviteStatus.PENDING,
        invitedBy: 'user_1',
      })

      expect(created.toJSON()).not.toHaveProperty('tokenHash')

      const withHash = await InviteModel.findOne({ orgId: 'org_1', email: 'preview@example.com' })
        .select('+tokenHash')
        .exec()
      expect(withHash).not.toBeNull()
      expect(withHash!.tokenHash).toBe('raw-token-hash')
      expect(withHash!.toJSON()).not.toHaveProperty('tokenHash')
    })

    it('requires orgId on queries (tenantScoped)', async () => {
      await expect(InviteModel.findOne({ email: 'x@y.com' }).exec()).rejects.toThrow(
        /Tenant scope missing on Invite\.findOne/,
      )
    })
  })
})
