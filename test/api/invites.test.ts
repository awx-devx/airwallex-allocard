import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { DELETE } from '@/app/api/invites/[id]/route'
import { GET as GET_PREVIEW } from '@/app/api/invites/preview/[token]/route'
import { GET, POST } from '@/app/api/invites/route'
import { AuditLogModel } from '@/server/models/AuditLog'
import { InviteModel } from '@/server/models/Invite'
import { MembershipModel } from '@/server/models/Membership'
import { OrganizationModel } from '@/server/models/Organization'
import { UserModel } from '@/server/models/User'
import * as memberships from '@/server/repositories/memberships'
import * as organizations from '@/server/repositories/organizations'
import * as users from '@/server/repositories/users'
import { hashInviteToken } from '@/server/services/invites/token'
import { inviteContracts } from '@/shared/contracts/invite'
import { InviteStatus } from '@/shared/enums/inviteStatus'
import { OrgRole } from '@/shared/enums/orgRole'
import { expectMatchesContract } from '../helpers/contract'
import { useTestDb } from '../helpers/db'
import { buildRequest, installTestSessionResolver, readBody } from '../helpers/request'

describe('/api/invites', () => {
  useTestDb()

  beforeAll(async () => {
    await Promise.all([
      UserModel.syncIndexes(),
      OrganizationModel.syncIndexes(),
      MembershipModel.syncIndexes(),
      InviteModel.syncIndexes(),
      AuditLogModel.syncIndexes(),
    ])
  })

  afterEach(() => {
    installTestSessionResolver()
    vi.restoreAllMocks()
  })

  async function seedOwner() {
    const owner = await users.createUser({
      email: `owner-${Date.now()}-${Math.random().toString(16).slice(2)}@example.com`,
      name: 'Owner',
    })
    const org = await organizations.createOrganization({
      name: 'Invite Org',
      slug: `org-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      country: 'US',
      baseCurrency: 'USD',
      createdBy: owner.id,
    })
    await memberships.createMembership(
      { orgId: org.id, userId: owner.id, orgRole: OrgRole.OWNER },
      { userId: owner.id, orgRole: OrgRole.OWNER },
    )
    return {
      owner,
      org,
      session: {
        userId: owner.id,
        orgId: org.id,
        orgRole: OrgRole.OWNER,
        onboarded: true as const,
      },
    }
  }

  describe('POST /api/invites', () => {
    // Matrix #1
    it('returns 401 when unauthenticated', async () => {
      const res = await POST(
        buildRequest({
          method: 'POST',
          path: '/api/invites',
          session: null,
          body: { email: 'a@example.com', orgRole: OrgRole.MEMBER },
        }),
      )
      expect(res.status).toBe(401)
    })

    // Matrix #2
    it('returns 403 when onboarding is incomplete', async () => {
      const user = await users.createUser({ email: 'solo@example.com', name: 'Solo' })
      const res = await POST(
        buildRequest({
          method: 'POST',
          path: '/api/invites',
          session: { userId: user.id, orgId: null, orgRole: null, onboarded: false },
          body: { email: 'a@example.com', orgRole: OrgRole.MEMBER },
        }),
      )
      expect(res.status).toBe(403)
    })

    // Matrix #4
    it('returns 403 when the caller lacks org.manage', async () => {
      const { org } = await seedOwner()
      const member = await users.createUser({ email: 'mem@example.com', name: 'Mem' })
      await memberships.createMembership(
        { orgId: org.id, userId: member.id, orgRole: OrgRole.MEMBER },
        { userId: member.id, orgRole: OrgRole.MEMBER },
      )

      const res = await POST(
        buildRequest({
          method: 'POST',
          path: '/api/invites',
          session: {
            userId: member.id,
            orgId: org.id,
            orgRole: OrgRole.MEMBER,
            onboarded: true,
          },
          body: { email: 'new@example.com', orgRole: OrgRole.MEMBER },
        }),
      )
      const body = await readBody<{ error: { message: string } }>(res)
      expect(res.status).toBe(403)
      expect(body.error.message).toMatch(/org\.manage/)
    })

    // Matrix #6
    it('returns 422 for an invalid payload', async () => {
      const { session } = await seedOwner()
      const res = await POST(
        buildRequest({
          method: 'POST',
          path: '/api/invites',
          session,
          body: { email: 'not-an-email', orgRole: 'NOPE' },
        }),
      )
      expect(res.status).toBe(422)
    })

    // Matrix #7 + #10
    it('creates an invite, returns token once, stores only the hash, and audits', async () => {
      const log = vi.spyOn(console, 'info').mockImplementation(() => {})
      const { session, org, owner } = await seedOwner()

      const res = await POST(
        buildRequest({
          method: 'POST',
          path: '/api/invites',
          session,
          body: { email: 'New.Person@Example.com', orgRole: OrgRole.ADMIN },
        }),
      )

      expect(res.status).toBe(201)
      const body = await expectMatchesContract(res, inviteContracts.create.output)
      expect(body.email).toBe('new.person@example.com')
      expect(body.orgRole).toBe(OrgRole.ADMIN)
      expect(body.status).toBe(InviteStatus.PENDING)
      expect(body.token).toBeTruthy()
      expect(body).not.toHaveProperty('tokenHash')
      expect(JSON.stringify(body)).not.toContain(hashInviteToken(body.token))

      const stored = await InviteModel.findOne({ _id: body.id, orgId: org.id })
        .select('+tokenHash')
        .lean()
        .exec()
      expect(stored?.tokenHash).toBe(hashInviteToken(body.token))
      expect(stored?.tokenHash).not.toBe(body.token)

      expect(log).toHaveBeenCalledWith(
        '[invite] accept link',
        expect.objectContaining({
          orgId: org.id,
          email: 'new.person@example.com',
          path: `/invite/${body.token}`,
        }),
      )

      const audits = await AuditLogModel.find({
        orgId: org.id,
        action: 'invite.created',
      }).exec()
      expect(audits).toHaveLength(1)
      expect(audits[0]?.actorId).toBe(owner.id)
      expect(JSON.stringify(audits[0]?.after ?? {})).not.toContain(body.token)
    })

    it('rejects a duplicate pending invite for the same email', async () => {
      const { session } = await seedOwner()
      const payload = { email: 'dup@example.com', orgRole: OrgRole.MEMBER }
      expect(
        (await POST(buildRequest({ method: 'POST', path: '/api/invites', session, body: payload })))
          .status,
      ).toBe(201)

      const res = await POST(
        buildRequest({ method: 'POST', path: '/api/invites', session, body: payload }),
      )
      expect(res.status).toBe(409)
    })
  })

  describe('GET /api/invites', () => {
    it('lists pending invites without raw tokens', async () => {
      const { session } = await seedOwner()
      const created = await POST(
        buildRequest({
          method: 'POST',
          path: '/api/invites',
          session,
          body: { email: 'list@example.com', orgRole: OrgRole.MEMBER },
        }),
      )
      const createdBody = await expectMatchesContract(created, inviteContracts.create.output)

      const res = await GET(buildRequest({ method: 'GET', path: '/api/invites', session }))
      expect(res.status).toBe(200)
      const body = await expectMatchesContract(res, inviteContracts.list.output)
      expect(body).toHaveLength(1)
      expect(body[0]?.id).toBe(createdBody.id)
      expect(body[0]).not.toHaveProperty('token')
      expect(JSON.stringify(body)).not.toContain(createdBody.token)
    })

    it('returns 403 for members without org.manage', async () => {
      const { org } = await seedOwner()
      const member = await users.createUser({ email: 'm2@example.com', name: 'M2' })
      await memberships.createMembership(
        { orgId: org.id, userId: member.id, orgRole: OrgRole.MEMBER },
        { userId: member.id, orgRole: OrgRole.MEMBER },
      )

      const res = await GET(
        buildRequest({
          method: 'GET',
          path: '/api/invites',
          session: {
            userId: member.id,
            orgId: org.id,
            orgRole: OrgRole.MEMBER,
            onboarded: true,
          },
        }),
      )
      expect(res.status).toBe(403)
    })
  })

  describe('DELETE /api/invites/:id', () => {
    it('revokes a pending invite and audits', async () => {
      const { session, org } = await seedOwner()
      const created = await POST(
        buildRequest({
          method: 'POST',
          path: '/api/invites',
          session,
          body: { email: 'rev@example.com', orgRole: OrgRole.MEMBER },
        }),
      )
      const invite = await expectMatchesContract(created, inviteContracts.create.output)

      const res = await DELETE(
        buildRequest({
          method: 'DELETE',
          path: `/api/invites/${invite.id}`,
          session,
          params: { id: invite.id },
        }),
      )
      expect(res.status).toBe(204)

      const stored = await InviteModel.findOne({ _id: invite.id, orgId: org.id }).lean().exec()
      expect(stored?.status).toBe(InviteStatus.REVOKED)

      const audits = await AuditLogModel.find({
        orgId: org.id,
        action: 'invite.revoked',
      }).exec()
      expect(audits).toHaveLength(1)
    })

    it('returns 404 for an unknown invite', async () => {
      const { session } = await seedOwner()
      const res = await DELETE(
        buildRequest({
          method: 'DELETE',
          path: '/api/invites/507f1f77bcf86cd799439011',
          session,
          params: { id: '507f1f77bcf86cd799439011' },
        }),
      )
      expect(res.status).toBe(404)
    })

    it('returns 404 when revoking across orgs', async () => {
      const a = await seedOwner()
      const b = await seedOwner()
      const created = await POST(
        buildRequest({
          method: 'POST',
          path: '/api/invites',
          session: b.session,
          body: { email: 'cross@example.com', orgRole: OrgRole.MEMBER },
        }),
      )
      const invite = await expectMatchesContract(created, inviteContracts.create.output)

      const res = await DELETE(
        buildRequest({
          method: 'DELETE',
          path: `/api/invites/${invite.id}`,
          session: a.session,
          params: { id: invite.id },
        }),
      )
      expect(res.status).toBe(404)
    })
  })

  describe('GET /api/invites/preview/:token', () => {
    it('returns the public preview without the token or hash', async () => {
      const { session, org, owner } = await seedOwner()
      const created = await POST(
        buildRequest({
          method: 'POST',
          path: '/api/invites',
          session,
          body: { email: 'preview@example.com', orgRole: OrgRole.MEMBER },
        }),
      )
      const invite = await expectMatchesContract(created, inviteContracts.create.output)

      const res = await GET_PREVIEW(
        buildRequest({
          method: 'GET',
          path: `/api/invites/preview/${invite.token}`,
          params: { token: invite.token },
        }),
      )

      expect(res.status).toBe(200)
      const body = await expectMatchesContract(res, inviteContracts.preview.output)
      expect(body).toEqual({
        orgName: org.name,
        invitedByName: owner.name,
        orgRole: OrgRole.MEMBER,
        expiresAt: invite.expiresAt,
      })
      expect(JSON.stringify(body)).not.toContain(invite.token)
    })

    it('is reachable without a session', async () => {
      const { session } = await seedOwner()
      const created = await POST(
        buildRequest({
          method: 'POST',
          path: '/api/invites',
          session,
          body: { email: 'pub@example.com', orgRole: OrgRole.MEMBER },
        }),
      )
      const invite = await expectMatchesContract(created, inviteContracts.create.output)

      const res = await GET_PREVIEW(
        buildRequest({
          method: 'GET',
          path: `/api/invites/preview/${invite.token}`,
          session: null,
          params: { token: invite.token },
        }),
      )
      expect(res.status).toBe(200)
    })

    it('returns 404 for an unknown token', async () => {
      const res = await GET_PREVIEW(
        buildRequest({
          method: 'GET',
          path: '/api/invites/preview/not-a-real-token',
          params: { token: 'not-a-real-token' },
        }),
      )
      expect(res.status).toBe(404)
    })

    it('returns 404 for a revoked invite', async () => {
      const { session } = await seedOwner()
      const created = await POST(
        buildRequest({
          method: 'POST',
          path: '/api/invites',
          session,
          body: { email: 'gone@example.com', orgRole: OrgRole.MEMBER },
        }),
      )
      const invite = await expectMatchesContract(created, inviteContracts.create.output)
      await DELETE(
        buildRequest({
          method: 'DELETE',
          path: `/api/invites/${invite.id}`,
          session,
          params: { id: invite.id },
        }),
      )

      const res = await GET_PREVIEW(
        buildRequest({
          method: 'GET',
          path: `/api/invites/preview/${invite.token}`,
          params: { token: invite.token },
        }),
      )
      expect(res.status).toBe(404)
    })
  })
})
