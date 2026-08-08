import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { POST as CREATE_INVITE } from '@/app/api/invites/route'
import { POST } from '@/app/api/invites/accept/route'
import { DELETE as REVOKE } from '@/app/api/invites/[id]/route'
import { AuditLogModel } from '@/server/models/AuditLog'
import { InviteModel } from '@/server/models/Invite'
import { MembershipModel } from '@/server/models/Membership'
import { OrganizationModel } from '@/server/models/Organization'
import { UserModel } from '@/server/models/User'
import * as memberships from '@/server/repositories/memberships'
import * as organizations from '@/server/repositories/organizations'
import * as users from '@/server/repositories/users'
import { inviteContracts } from '@/shared/contracts/invite'
import { ErrorCode } from '@/shared/enums/errors'
import { InviteStatus } from '@/shared/enums/inviteStatus'
import { MembershipStatus } from '@/shared/enums/membershipStatus'
import { OrgRole } from '@/shared/enums/orgRole'
import { expectMatchesContract } from '../helpers/contract'
import { useTestDb } from '../helpers/db'
import { buildRequest, installTestSessionResolver, readBody } from '../helpers/request'

describe('POST /api/invites/accept', () => {
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
  })

  async function seedOwner() {
    const owner = await users.createUser({
      email: `owner-${Date.now()}-${Math.random().toString(16).slice(2)}@example.com`,
      name: 'Owner',
    })
    const org = await organizations.createOrganization({
      name: 'Accept Org',
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

  async function issueInvite(
    session: {
      userId: string
      orgId: string
      orgRole: OrgRole
      onboarded: boolean
    },
    email: string,
    orgRole: OrgRole = OrgRole.MEMBER,
  ) {
    const res = await CREATE_INVITE(
      buildRequest({
        method: 'POST',
        path: '/api/invites',
        session,
        body: { email, orgRole },
      }),
    )
    expect(res.status).toBe(201)
    return expectMatchesContract(res, inviteContracts.create.output)
  }

  // Matrix #1
  it('returns 401 when unauthenticated', async () => {
    const res = await POST(
      buildRequest({
        method: 'POST',
        path: '/api/invites/accept',
        session: null,
        body: { token: 'x' },
      }),
    )
    expect(res.status).toBe(401)
  })

  // Matrix #2 — N/A as failure: accept is an onboarding path.
  // Matrix #3–5, #8–9 — see specific cases below.

  // Matrix #6
  it('returns 422 for an invalid payload', async () => {
    const invitee = await users.createUser({ email: 'inv@example.com', name: 'Inv' })
    const res = await POST(
      buildRequest({
        method: 'POST',
        path: '/api/invites/accept',
        session: { userId: invitee.id, orgId: null, orgRole: null, onboarded: false },
        body: {},
      }),
    )
    expect(res.status).toBe(422)
  })

  // Matrix #7 + #10
  it('accepts a pending invite, creates membership, sets defaultOrgId, and audits', async () => {
    const { session, org } = await seedOwner()
    const invitee = await users.createUser({
      email: 'invitee@example.com',
      name: 'Invitee',
    })
    const invite = await issueInvite(session, invitee.email, OrgRole.ADMIN)

    const res = await POST(
      buildRequest({
        method: 'POST',
        path: '/api/invites/accept',
        session: { userId: invitee.id, orgId: null, orgRole: null, onboarded: false },
        body: { token: invite.token },
      }),
    )

    expect(res.status).toBe(201)
    const body = await expectMatchesContract(res, inviteContracts.accept.output)
    expect(body).toMatchObject({
      orgId: org.id,
      userId: invitee.id,
      orgRole: OrgRole.ADMIN,
      status: MembershipStatus.ACTIVE,
    })

    const updated = await users.findUserById(invitee.id)
    expect(updated?.defaultOrgId).toBe(org.id)

    const stored = await InviteModel.findOne({ _id: invite.id, orgId: org.id }).lean().exec()
    expect(stored?.status).toBe(InviteStatus.ACCEPTED)

    const audits = await AuditLogModel.find({
      orgId: org.id,
      action: 'invite.accepted',
    }).exec()
    expect(audits).toHaveLength(1)
    expect(audits[0]?.actorId).toBe(invitee.id)
  })

  it('returns 403 when the signed-in email does not match the invite', async () => {
    const { session } = await seedOwner()
    const invite = await issueInvite(session, 'intended@example.com')
    const other = await users.createUser({ email: 'other@example.com', name: 'Other' })

    const res = await POST(
      buildRequest({
        method: 'POST',
        path: '/api/invites/accept',
        session: { userId: other.id, orgId: null, orgRole: null, onboarded: false },
        body: { token: invite.token },
      }),
    )
    const body = await readBody<{ error: { code: string } }>(res)

    expect(res.status).toBe(403)
    expect(body.error.code).toBe(ErrorCode.PERMISSION_DENIED)

    // Invite must remain pending (mismatch must not burn the token).
    const stored = await InviteModel.findOne({
      _id: invite.id,
      orgId: session.orgId,
    })
      .lean()
      .exec()
    expect(stored?.status).toBe(InviteStatus.PENDING)
  })

  it('returns INVITE_REVOKED for a revoked invite', async () => {
    const { session } = await seedOwner()
    const invitee = await users.createUser({ email: 'rev@example.com', name: 'Rev' })
    const invite = await issueInvite(session, invitee.email)
    await REVOKE(
      buildRequest({
        method: 'DELETE',
        path: `/api/invites/${invite.id}`,
        session,
        params: { id: invite.id },
      }),
    )

    const res = await POST(
      buildRequest({
        method: 'POST',
        path: '/api/invites/accept',
        session: { userId: invitee.id, orgId: null, orgRole: null, onboarded: false },
        body: { token: invite.token },
      }),
    )
    const body = await readBody<{ error: { code: string } }>(res)
    expect(res.status).toBe(409)
    expect(body.error.code).toBe(ErrorCode.INVITE_REVOKED)
  })

  it('returns INVITE_EXPIRED for an expired invite', async () => {
    const { session, org } = await seedOwner()
    const invitee = await users.createUser({ email: 'exp@example.com', name: 'Exp' })
    const invite = await issueInvite(session, invitee.email)

    await InviteModel.updateOne(
      { _id: invite.id, orgId: org.id },
      { $set: { expiresAt: new Date(Date.now() - 60_000) } },
    ).exec()

    const res = await POST(
      buildRequest({
        method: 'POST',
        path: '/api/invites/accept',
        session: { userId: invitee.id, orgId: null, orgRole: null, onboarded: false },
        body: { token: invite.token },
      }),
    )
    const body = await readBody<{ error: { code: string } }>(res)
    expect(res.status).toBe(409)
    expect(body.error.code).toBe(ErrorCode.INVITE_EXPIRED)
  })

  it('returns INVITE_ALREADY_ACCEPTED on a second accept', async () => {
    const { session } = await seedOwner()
    const invitee = await users.createUser({ email: 'twice@example.com', name: 'Twice' })
    const invite = await issueInvite(session, invitee.email)
    const inviteeSession = {
      userId: invitee.id,
      orgId: null,
      orgRole: null,
      onboarded: false as const,
    }

    expect(
      (
        await POST(
          buildRequest({
            method: 'POST',
            path: '/api/invites/accept',
            session: inviteeSession,
            body: { token: invite.token },
          }),
        )
      ).status,
    ).toBe(201)

    const res = await POST(
      buildRequest({
        method: 'POST',
        path: '/api/invites/accept',
        session: inviteeSession,
        body: { token: invite.token },
      }),
    )
    const body = await readBody<{ error: { code: string } }>(res)
    expect(res.status).toBe(409)
    expect(body.error.code).toBe(ErrorCode.INVITE_ALREADY_ACCEPTED)
  })

  it('returns 404 for an unknown token', async () => {
    const invitee = await users.createUser({ email: 'ghost@example.com', name: 'Ghost' })
    const res = await POST(
      buildRequest({
        method: 'POST',
        path: '/api/invites/accept',
        session: { userId: invitee.id, orgId: null, orgRole: null, onboarded: false },
        body: { token: 'not-a-real-token' },
      }),
    )
    expect(res.status).toBe(404)
  })

  it('concurrent accepts create exactly one membership', async () => {
    const { session, org } = await seedOwner()
    const invitee = await users.createUser({ email: 'race@example.com', name: 'Race' })
    const invite = await issueInvite(session, invitee.email)
    const inviteeSession = {
      userId: invitee.id,
      orgId: null,
      orgRole: null,
      onboarded: false as const,
    }

    const [a, b] = await Promise.all([
      POST(
        buildRequest({
          method: 'POST',
          path: '/api/invites/accept',
          session: inviteeSession,
          body: { token: invite.token },
        }),
      ),
      POST(
        buildRequest({
          method: 'POST',
          path: '/api/invites/accept',
          session: inviteeSession,
          body: { token: invite.token },
        }),
      ),
    ])

    const statuses = [a.status, b.status].sort()
    expect(statuses).toEqual([201, 409])

    const winner = a.status === 201 ? a : b
    const loser = a.status === 409 ? a : b
    await expectMatchesContract(winner, inviteContracts.accept.output)
    const loserBody = await readBody<{ error: { code: string } }>(loser)
    expect(loserBody.error.code).toBe(ErrorCode.INVITE_ALREADY_ACCEPTED)

    const rows = await MembershipModel.find({ orgId: org.id, userId: invitee.id }).exec()
    expect(rows).toHaveLength(1)
  })
})
