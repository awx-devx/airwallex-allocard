import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { DELETE, PATCH } from '@/app/api/organizations/[id]/members/[userId]/route'
import { GET } from '@/app/api/organizations/[id]/members/route'
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

describe('/api/organizations/:id/members', () => {
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

  async function seedUser(name = 'Member') {
    return users.createUser({
      email: `user-${Date.now()}-${Math.random().toString(16).slice(2)}@example.com`,
      name,
    })
  }

  async function seedOrgWithOwner() {
    const owner = await seedUser('Owner')
    const org = await organizations.createOrganization({
      name: 'Members Org',
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
      ownerSession: {
        userId: owner.id,
        orgId: org.id,
        orgRole: OrgRole.OWNER,
        onboarded: true as const,
      },
    }
  }

  async function addMember(
    orgId: string,
    opts?: { role?: OrgRole; status?: MembershipStatus; name?: string },
  ) {
    const user = await seedUser(opts?.name ?? 'Teammate')
    const role = opts?.role ?? OrgRole.MEMBER
    await memberships.createMembership(
      { orgId, userId: user.id, orgRole: role },
      {
        userId: user.id,
        orgRole: role,
        ...(opts?.status !== undefined ? { status: opts.status } : {}),
      },
    )
    return user
  }

  describe('GET', () => {
    // Matrix #1
    it('returns 401 when unauthenticated', async () => {
      const res = await GET(
        buildRequest({
          method: 'GET',
          path: '/api/organizations/x/members',
          session: null,
          params: { id: 'x' },
        }),
      )
      expect(res.status).toBe(401)
    })

    // Matrix #2
    it('returns 403 when onboarding is incomplete', async () => {
      const user = await seedUser()
      const res = await GET(
        buildRequest({
          method: 'GET',
          path: '/api/organizations/x/members',
          session: { userId: user.id, orgId: null, orgRole: null, onboarded: false },
          params: { id: 'x' },
        }),
      )
      const body = await readBody<{ error: { code: string } }>(res)
      expect(res.status).toBe(403)
      expect(body.error.code).toBe(ErrorCode.ONBOARDING_INCOMPLETE)
    })

    // Matrix #3
    it('returns 404 for a different org', async () => {
      const a = await seedOrgWithOwner()
      const b = await seedOrgWithOwner()

      const res = await GET(
        buildRequest({
          method: 'GET',
          path: `/api/organizations/${b.org.id}/members`,
          session: a.ownerSession,
          params: { id: b.org.id },
        }),
      )
      expect(res.status).toBe(404)
    })

    // Matrix #4–6, #8–10 — N/A (any member; no body; list)

    // Matrix #7
    it('lists members with user summaries', async () => {
      const { org, owner, ownerSession } = await seedOrgWithOwner()
      const member = await addMember(org.id, { role: OrgRole.MEMBER, name: 'Spender' })

      const res = await GET(
        buildRequest({
          method: 'GET',
          path: `/api/organizations/${org.id}/members`,
          session: ownerSession,
          params: { id: org.id },
        }),
      )

      expect(res.status).toBe(200)
      const body = await expectMatchesContract(res, organizationContracts.listMembers.output)
      expect(body).toHaveLength(2)
      expect(body.map((m) => m.userId).sort()).toEqual([owner.id, member.id].sort())
      const row = body.find((m) => m.userId === member.id)
      expect(row?.user).toMatchObject({ id: member.id, name: 'Spender', email: member.email })
    })
  })

  describe('PATCH', () => {
    // Matrix #1
    it('returns 401 when unauthenticated', async () => {
      const res = await PATCH(
        buildRequest({
          method: 'PATCH',
          path: '/api/organizations/x/members/y',
          session: null,
          params: { id: 'x', userId: 'y' },
          body: { orgRole: OrgRole.ADMIN },
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
          path: '/api/organizations/x/members/y',
          session: { userId: user.id, orgId: null, orgRole: null, onboarded: false },
          params: { id: 'x', userId: 'y' },
          body: { orgRole: OrgRole.ADMIN },
        }),
      )
      expect(res.status).toBe(403)
    })

    // Matrix #3
    it('returns 404 when updating a member in a different org', async () => {
      const a = await seedOrgWithOwner()
      const b = await seedOrgWithOwner()
      const target = await addMember(b.org.id)

      const res = await PATCH(
        buildRequest({
          method: 'PATCH',
          path: `/api/organizations/${b.org.id}/members/${target.id}`,
          session: a.ownerSession,
          params: { id: b.org.id, userId: target.id },
          body: { orgRole: OrgRole.ADMIN },
        }),
      )
      expect(res.status).toBe(404)
    })

    // Matrix #4
    it('returns 403 when the caller lacks org.manage', async () => {
      const { org } = await seedOrgWithOwner()
      const member = await addMember(org.id)

      const res = await PATCH(
        buildRequest({
          method: 'PATCH',
          path: `/api/organizations/${org.id}/members/${member.id}`,
          session: {
            userId: member.id,
            orgId: org.id,
            orgRole: OrgRole.MEMBER,
            onboarded: true,
          },
          params: { id: org.id, userId: member.id },
          body: { orgRole: OrgRole.ADMIN },
        }),
      )
      const body = await readBody<{ error: { code: string; message: string } }>(res)
      expect(res.status).toBe(403)
      expect(body.error.code).toBe(ErrorCode.PERMISSION_DENIED)
      expect(body.error.message).toMatch(/org\.manage/)
    })

    // Matrix #5 — N/A
    // Matrix #9 — N/A

    // Matrix #6
    it('returns 422 for an empty patch', async () => {
      const { org, ownerSession } = await seedOrgWithOwner()
      const member = await addMember(org.id)

      const res = await PATCH(
        buildRequest({
          method: 'PATCH',
          path: `/api/organizations/${org.id}/members/${member.id}`,
          session: ownerSession,
          params: { id: org.id, userId: member.id },
          body: {},
        }),
      )
      expect(res.status).toBe(422)
    })

    // Matrix #7 + #10
    it('updates role and status and writes one audit entry', async () => {
      const { org, ownerSession } = await seedOrgWithOwner()
      const member = await addMember(org.id)

      const res = await PATCH(
        buildRequest({
          method: 'PATCH',
          path: `/api/organizations/${org.id}/members/${member.id}`,
          session: ownerSession,
          params: { id: org.id, userId: member.id },
          body: { orgRole: OrgRole.ADMIN, status: MembershipStatus.SUSPENDED },
        }),
      )

      expect(res.status).toBe(200)
      const body = await expectMatchesContract(res, organizationContracts.updateMember.output)
      expect(body.orgRole).toBe(OrgRole.ADMIN)
      expect(body.status).toBe(MembershipStatus.SUSPENDED)
      expect(body.user.id).toBe(member.id)

      const audits = await AuditLogModel.find({
        orgId: org.id,
        action: 'member.updated',
      }).exec()
      expect(audits).toHaveLength(1)
      expect(audits[0]?.actorId).toBe(ownerSession.userId)
    })

    // Matrix #8
    it('returns 404 when the member does not exist', async () => {
      const { org, ownerSession } = await seedOrgWithOwner()
      const missing = '507f1f77bcf86cd799439011'

      const res = await PATCH(
        buildRequest({
          method: 'PATCH',
          path: `/api/organizations/${org.id}/members/${missing}`,
          session: ownerSession,
          params: { id: org.id, userId: missing },
          body: { orgRole: OrgRole.ADMIN },
        }),
      )
      expect(res.status).toBe(404)
    })

    it('rejects demoting the last OWNER with CONFLICT', async () => {
      const { org, owner, ownerSession } = await seedOrgWithOwner()
      await addMember(org.id)

      const res = await PATCH(
        buildRequest({
          method: 'PATCH',
          path: `/api/organizations/${org.id}/members/${owner.id}`,
          session: ownerSession,
          params: { id: org.id, userId: owner.id },
          body: { orgRole: OrgRole.ADMIN },
        }),
      )
      const body = await readBody<{ error: { code: string } }>(res)
      expect(res.status).toBe(409)
      expect(body.error.code).toBe(ErrorCode.CONFLICT)
    })

    it('rejects suspending the last OWNER with CONFLICT', async () => {
      const { org, owner, ownerSession } = await seedOrgWithOwner()

      const res = await PATCH(
        buildRequest({
          method: 'PATCH',
          path: `/api/organizations/${org.id}/members/${owner.id}`,
          session: ownerSession,
          params: { id: org.id, userId: owner.id },
          body: { status: MembershipStatus.SUSPENDED },
        }),
      )
      expect(res.status).toBe(409)
    })

    it('allows demoting an OWNER when another OWNER remains', async () => {
      const { org, owner, ownerSession } = await seedOrgWithOwner()
      await addMember(org.id, { role: OrgRole.OWNER, name: 'Co-Owner' })

      const res = await PATCH(
        buildRequest({
          method: 'PATCH',
          path: `/api/organizations/${org.id}/members/${owner.id}`,
          session: ownerSession,
          params: { id: org.id, userId: owner.id },
          body: { orgRole: OrgRole.ADMIN },
        }),
      )
      expect(res.status).toBe(200)
      const body = await expectMatchesContract(res, organizationContracts.updateMember.output)
      expect(body.orgRole).toBe(OrgRole.ADMIN)
    })
  })

  describe('DELETE', () => {
    // Matrix #1
    it('returns 401 when unauthenticated', async () => {
      const res = await DELETE(
        buildRequest({
          method: 'DELETE',
          path: '/api/organizations/x/members/y',
          session: null,
          params: { id: 'x', userId: 'y' },
        }),
      )
      expect(res.status).toBe(401)
    })

    // Matrix #2
    it('returns 403 when onboarding is incomplete', async () => {
      const user = await seedUser()
      const res = await DELETE(
        buildRequest({
          method: 'DELETE',
          path: '/api/organizations/x/members/y',
          session: { userId: user.id, orgId: null, orgRole: null, onboarded: false },
          params: { id: 'x', userId: 'y' },
        }),
      )
      expect(res.status).toBe(403)
    })

    // Matrix #3
    it('returns 404 when removing from a different org', async () => {
      const a = await seedOrgWithOwner()
      const b = await seedOrgWithOwner()
      const target = await addMember(b.org.id)

      const res = await DELETE(
        buildRequest({
          method: 'DELETE',
          path: `/api/organizations/${b.org.id}/members/${target.id}`,
          session: a.ownerSession,
          params: { id: b.org.id, userId: target.id },
        }),
      )
      expect(res.status).toBe(404)
    })

    // Matrix #4
    it('returns 403 when the caller lacks org.manage', async () => {
      const { org } = await seedOrgWithOwner()
      const member = await addMember(org.id)
      const other = await addMember(org.id, { name: 'Other' })

      const res = await DELETE(
        buildRequest({
          method: 'DELETE',
          path: `/api/organizations/${org.id}/members/${other.id}`,
          session: {
            userId: member.id,
            orgId: org.id,
            orgRole: OrgRole.MEMBER,
            onboarded: true,
          },
          params: { id: org.id, userId: other.id },
        }),
      )
      expect(res.status).toBe(403)
    })

    // Matrix #5–6, #9 — N/A

    // Matrix #7 + #10
    it('removes a member and writes one audit entry', async () => {
      const { org, ownerSession } = await seedOrgWithOwner()
      const member = await addMember(org.id)

      const res = await DELETE(
        buildRequest({
          method: 'DELETE',
          path: `/api/organizations/${org.id}/members/${member.id}`,
          session: ownerSession,
          params: { id: org.id, userId: member.id },
        }),
      )
      expect(res.status).toBe(204)

      expect(await memberships.findMembershipInOrg(org.id, member.id)).toBeNull()

      const audits = await AuditLogModel.find({
        orgId: org.id,
        action: 'member.removed',
      }).exec()
      expect(audits).toHaveLength(1)
      expect(audits[0]?.actorId).toBe(ownerSession.userId)
    })

    // Matrix #8
    it('returns 404 when the member does not exist', async () => {
      const { org, ownerSession } = await seedOrgWithOwner()
      const missing = '507f1f77bcf86cd799439011'

      const res = await DELETE(
        buildRequest({
          method: 'DELETE',
          path: `/api/organizations/${org.id}/members/${missing}`,
          session: ownerSession,
          params: { id: org.id, userId: missing },
        }),
      )
      expect(res.status).toBe(404)
    })

    it('rejects removing the last OWNER with CONFLICT', async () => {
      const { org, owner, ownerSession } = await seedOrgWithOwner()
      await addMember(org.id)

      const res = await DELETE(
        buildRequest({
          method: 'DELETE',
          path: `/api/organizations/${org.id}/members/${owner.id}`,
          session: ownerSession,
          params: { id: org.id, userId: owner.id },
        }),
      )
      const body = await readBody<{ error: { code: string } }>(res)
      expect(res.status).toBe(409)
      expect(body.error.code).toBe(ErrorCode.CONFLICT)
      expect(await memberships.findMembershipInOrg(org.id, owner.id)).not.toBeNull()
    })
  })
})
