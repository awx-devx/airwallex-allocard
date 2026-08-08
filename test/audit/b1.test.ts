/**
 * B1.13 — one audit assertion per mutating endpoint from B1.5–B1.10.
 * Confirms exactly one entry with the correct actor and subject.
 */
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { POST as SIGN_UP } from '@/app/api/auth/sign-up/route'
import { POST as ACCEPT_INVITE } from '@/app/api/invites/accept/route'
import { DELETE as REVOKE_INVITE } from '@/app/api/invites/[id]/route'
import { POST as CREATE_INVITE } from '@/app/api/invites/route'
import { PATCH as UPDATE_ME } from '@/app/api/me/route'
import { DELETE as REMOVE_MEMBER } from '@/app/api/organizations/[id]/members/[userId]/route'
import { PATCH as UPDATE_MEMBER } from '@/app/api/organizations/[id]/members/[userId]/route'
import { GET as LIST_MEMBERS } from '@/app/api/organizations/[id]/members/route'
import { PATCH as UPDATE_ORG } from '@/app/api/organizations/[id]/route'
import { POST as CREATE_ORG } from '@/app/api/organizations/route'
import { AuditLogModel } from '@/server/models/AuditLog'
import { InviteModel } from '@/server/models/Invite'
import { MembershipModel } from '@/server/models/Membership'
import { OrganizationModel } from '@/server/models/Organization'
import { UserModel } from '@/server/models/User'
import { getRedis, resetRedis } from '@/server/redis'
import { PLATFORM_ORG_ID } from '@/server/services/auth/signUp'
import { inviteContracts } from '@/shared/contracts/invite'
import { MembershipStatus } from '@/shared/enums/membershipStatus'
import { OrgRole } from '@/shared/enums/orgRole'
import { expectMatchesContract } from '../helpers/contract'
import { useTestDb } from '../helpers/db'
import { buildRequest, installTestSessionResolver, readBody } from '../helpers/request'

async function findAudits(filter: { orgId: string; action: string; subjectId?: string }) {
  return AuditLogModel.find(filter).exec()
}

describe('audit/b1', () => {
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
    resetRedis()
    vi.restoreAllMocks()
  })

  it('POST /api/auth/sign-up writes user.signed_up', async () => {
    getRedis({ url: null })
    const res = await SIGN_UP(
      buildRequest({
        method: 'POST',
        path: '/api/auth/sign-up',
        body: { email: 'signup@example.com', password: 'password123', name: 'Signup' },
      }),
    )
    expect(res.status).toBe(201)
    const user = await readBody<{ id: string }>(res)

    const audits = await findAudits({
      orgId: PLATFORM_ORG_ID,
      action: 'user.signed_up',
      subjectId: user.id,
    })
    expect(audits).toHaveLength(1)
    expect(audits[0]?.actorId).toBe(user.id)
    expect(audits[0]?.subjectType).toBe('user')
  })

  it('PATCH /api/me writes user.updated', async () => {
    getRedis({ url: null })
    const created = await SIGN_UP(
      buildRequest({
        method: 'POST',
        path: '/api/auth/sign-up',
        body: { email: 'me@example.com', password: 'password123', name: 'Before' },
      }),
    )
    const user = await readBody<{ id: string }>(created)

    const res = await UPDATE_ME(
      buildRequest({
        method: 'PATCH',
        path: '/api/me',
        session: { userId: user.id, orgId: null, orgRole: null, onboarded: false },
        body: { name: 'After' },
      }),
    )
    expect(res.status).toBe(200)

    const audits = await findAudits({
      orgId: PLATFORM_ORG_ID,
      action: 'user.updated',
      subjectId: user.id,
    })
    expect(audits).toHaveLength(1)
    expect(audits[0]?.actorId).toBe(user.id)
    expect(audits[0]?.subjectType).toBe('user')
  })

  it('POST /api/organizations writes organization.created', async () => {
    getRedis({ url: null })
    const created = await SIGN_UP(
      buildRequest({
        method: 'POST',
        path: '/api/auth/sign-up',
        body: { email: 'owner@example.com', password: 'password123', name: 'Owner' },
      }),
    )
    const user = await readBody<{ id: string }>(created)

    const res = await CREATE_ORG(
      buildRequest({
        method: 'POST',
        path: '/api/organizations',
        session: { userId: user.id, orgId: null, orgRole: null, onboarded: false },
        body: { name: 'Audit Org', country: 'US', baseCurrency: 'USD' },
      }),
    )
    expect(res.status).toBe(201)
    const org = await readBody<{ id: string }>(res)

    const audits = await findAudits({
      orgId: org.id,
      action: 'organization.created',
      subjectId: org.id,
    })
    expect(audits).toHaveLength(1)
    expect(audits[0]?.actorId).toBe(user.id)
    expect(audits[0]?.subjectType).toBe('organization')
  })

  it('PATCH /api/organizations/:id writes organization.updated', async () => {
    getRedis({ url: null })
    const created = await SIGN_UP(
      buildRequest({
        method: 'POST',
        path: '/api/auth/sign-up',
        body: { email: 'owner2@example.com', password: 'password123', name: 'Owner' },
      }),
    )
    const user = await readBody<{ id: string }>(created)
    const orgRes = await CREATE_ORG(
      buildRequest({
        method: 'POST',
        path: '/api/organizations',
        session: { userId: user.id, orgId: null, orgRole: null, onboarded: false },
        body: { name: 'Patch Org', country: 'US', baseCurrency: 'USD' },
      }),
    )
    const org = await readBody<{ id: string }>(orgRes)
    const session = {
      userId: user.id,
      orgId: org.id,
      orgRole: OrgRole.OWNER,
      onboarded: true as const,
    }

    const res = await UPDATE_ORG(
      buildRequest({
        method: 'PATCH',
        path: `/api/organizations/${org.id}`,
        session,
        params: { id: org.id },
        body: { name: 'Renamed' },
      }),
    )
    expect(res.status).toBe(200)

    const audits = await findAudits({
      orgId: org.id,
      action: 'organization.updated',
      subjectId: org.id,
    })
    expect(audits).toHaveLength(1)
    expect(audits[0]?.actorId).toBe(user.id)
    expect(audits[0]?.subjectType).toBe('organization')
  })

  async function seedOwnerOrg() {
    getRedis({ url: null })
    vi.spyOn(console, 'info').mockImplementation(() => {})
    const created = await SIGN_UP(
      buildRequest({
        method: 'POST',
        path: '/api/auth/sign-up',
        body: {
          email: `owner-${Date.now()}-${Math.random().toString(16).slice(2)}@example.com`,
          password: 'password123',
          name: 'Owner',
        },
      }),
    )
    const user = await readBody<{ id: string }>(created)
    const orgRes = await CREATE_ORG(
      buildRequest({
        method: 'POST',
        path: '/api/organizations',
        session: { userId: user.id, orgId: null, orgRole: null, onboarded: false },
        body: {
          name: 'Members Org',
          slug: `morg-${Date.now()}-${Math.random().toString(16).slice(2)}`,
          country: 'US',
          baseCurrency: 'USD',
        },
      }),
    )
    const org = await readBody<{ id: string }>(orgRes)
    return {
      user,
      org,
      session: {
        userId: user.id,
        orgId: org.id,
        orgRole: OrgRole.OWNER,
        onboarded: true as const,
      },
    }
  }

  it('PATCH .../members/:userId writes member.updated', async () => {
    const { org, session } = await seedOwnerOrg()
    const memberSignUp = await SIGN_UP(
      buildRequest({
        method: 'POST',
        path: '/api/auth/sign-up',
        body: { email: 'member@example.com', password: 'password123', name: 'Member' },
      }),
    )
    const member = await readBody<{ id: string }>(memberSignUp)

    // Add via invite accept to get a real membership.
    const inviteRes = await CREATE_INVITE(
      buildRequest({
        method: 'POST',
        path: '/api/invites',
        session,
        body: { email: 'member@example.com', orgRole: OrgRole.MEMBER },
      }),
    )
    const invite = await expectMatchesContract(inviteRes, inviteContracts.create.output)
    await ACCEPT_INVITE(
      buildRequest({
        method: 'POST',
        path: '/api/invites/accept',
        session: { userId: member.id, orgId: null, orgRole: null, onboarded: false },
        body: { token: invite.token },
      }),
    )

    const list = await LIST_MEMBERS(
      buildRequest({
        method: 'GET',
        path: `/api/organizations/${org.id}/members`,
        session,
        params: { id: org.id },
      }),
    )
    const members = await readBody<Array<{ id: string; userId: string }>>(list)
    const row = members.find((m) => m.userId === member.id)
    expect(row).toBeTruthy()

    const res = await UPDATE_MEMBER(
      buildRequest({
        method: 'PATCH',
        path: `/api/organizations/${org.id}/members/${member.id}`,
        session,
        params: { id: org.id, userId: member.id },
        body: { status: MembershipStatus.SUSPENDED },
      }),
    )
    expect(res.status).toBe(200)

    const audits = await findAudits({
      orgId: org.id,
      action: 'member.updated',
      subjectId: row!.id,
    })
    expect(audits).toHaveLength(1)
    expect(audits[0]?.actorId).toBe(session.userId)
    expect(audits[0]?.subjectType).toBe('membership')
  })

  it('DELETE .../members/:userId writes member.removed', async () => {
    const { org, session } = await seedOwnerOrg()
    const memberSignUp = await SIGN_UP(
      buildRequest({
        method: 'POST',
        path: '/api/auth/sign-up',
        body: { email: 'gone@example.com', password: 'password123', name: 'Gone' },
      }),
    )
    const member = await readBody<{ id: string }>(memberSignUp)
    const inviteRes = await CREATE_INVITE(
      buildRequest({
        method: 'POST',
        path: '/api/invites',
        session,
        body: { email: 'gone@example.com', orgRole: OrgRole.MEMBER },
      }),
    )
    const invite = await expectMatchesContract(inviteRes, inviteContracts.create.output)
    await ACCEPT_INVITE(
      buildRequest({
        method: 'POST',
        path: '/api/invites/accept',
        session: { userId: member.id, orgId: null, orgRole: null, onboarded: false },
        body: { token: invite.token },
      }),
    )

    const list = await LIST_MEMBERS(
      buildRequest({
        method: 'GET',
        path: `/api/organizations/${org.id}/members`,
        session,
        params: { id: org.id },
      }),
    )
    const members = await readBody<Array<{ id: string; userId: string }>>(list)
    const row = members.find((m) => m.userId === member.id)!

    const res = await REMOVE_MEMBER(
      buildRequest({
        method: 'DELETE',
        path: `/api/organizations/${org.id}/members/${member.id}`,
        session,
        params: { id: org.id, userId: member.id },
      }),
    )
    expect(res.status).toBe(204)

    const audits = await findAudits({
      orgId: org.id,
      action: 'member.removed',
      subjectId: row.id,
    })
    expect(audits).toHaveLength(1)
    expect(audits[0]?.actorId).toBe(session.userId)
    expect(audits[0]?.subjectType).toBe('membership')
  })

  it('POST /api/invites writes invite.created', async () => {
    const { org, session } = await seedOwnerOrg()
    const res = await CREATE_INVITE(
      buildRequest({
        method: 'POST',
        path: '/api/invites',
        session,
        body: { email: 'invited@example.com', orgRole: OrgRole.MEMBER },
      }),
    )
    expect(res.status).toBe(201)
    const invite = await expectMatchesContract(res, inviteContracts.create.output)

    const audits = await findAudits({
      orgId: org.id,
      action: 'invite.created',
      subjectId: invite.id,
    })
    expect(audits).toHaveLength(1)
    expect(audits[0]?.actorId).toBe(session.userId)
    expect(audits[0]?.subjectType).toBe('invite')
  })

  it('DELETE /api/invites/:id writes invite.revoked', async () => {
    const { org, session } = await seedOwnerOrg()
    const created = await CREATE_INVITE(
      buildRequest({
        method: 'POST',
        path: '/api/invites',
        session,
        body: { email: 'revoke@example.com', orgRole: OrgRole.MEMBER },
      }),
    )
    const invite = await expectMatchesContract(created, inviteContracts.create.output)

    const res = await REVOKE_INVITE(
      buildRequest({
        method: 'DELETE',
        path: `/api/invites/${invite.id}`,
        session,
        params: { id: invite.id },
      }),
    )
    expect(res.status).toBe(204)

    const audits = await findAudits({
      orgId: org.id,
      action: 'invite.revoked',
      subjectId: invite.id,
    })
    expect(audits).toHaveLength(1)
    expect(audits[0]?.actorId).toBe(session.userId)
    expect(audits[0]?.subjectType).toBe('invite')
  })

  it('POST /api/invites/accept writes invite.accepted', async () => {
    const { org, session } = await seedOwnerOrg()
    const inviteeSignUp = await SIGN_UP(
      buildRequest({
        method: 'POST',
        path: '/api/auth/sign-up',
        body: { email: 'accept@example.com', password: 'password123', name: 'Accept' },
      }),
    )
    const invitee = await readBody<{ id: string }>(inviteeSignUp)
    const created = await CREATE_INVITE(
      buildRequest({
        method: 'POST',
        path: '/api/invites',
        session,
        body: { email: 'accept@example.com', orgRole: OrgRole.MEMBER },
      }),
    )
    const invite = await expectMatchesContract(created, inviteContracts.create.output)

    const res = await ACCEPT_INVITE(
      buildRequest({
        method: 'POST',
        path: '/api/invites/accept',
        session: { userId: invitee.id, orgId: null, orgRole: null, onboarded: false },
        body: { token: invite.token },
      }),
    )
    expect(res.status).toBe(201)

    const audits = await findAudits({
      orgId: org.id,
      action: 'invite.accepted',
      subjectId: invite.id,
    })
    expect(audits).toHaveLength(1)
    expect(audits[0]?.actorId).toBe(invitee.id)
    expect(audits[0]?.subjectType).toBe('invite')
  })
})
