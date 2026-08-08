import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { POST as CREATE_INVITE } from '@/app/api/invites/route'
import { GET } from '@/app/api/onboarding/status/route'
import { InviteModel } from '@/server/models/Invite'
import { MembershipModel } from '@/server/models/Membership'
import { OrganizationModel } from '@/server/models/Organization'
import { UserModel } from '@/server/models/User'
import * as memberships from '@/server/repositories/memberships'
import * as organizations from '@/server/repositories/organizations'
import * as users from '@/server/repositories/users'
import { authContracts } from '@/shared/contracts/auth'
import { inviteContracts } from '@/shared/contracts/invite'
import { ErrorCode } from '@/shared/enums/errors'
import { OrgRole } from '@/shared/enums/orgRole'
import { expectMatchesContract } from '../helpers/contract'
import { useTestDb } from '../helpers/db'
import { buildRequest, installTestSessionResolver, readBody } from '../helpers/request'

describe('GET /api/onboarding/status', () => {
  useTestDb()

  beforeAll(async () => {
    await Promise.all([
      UserModel.syncIndexes(),
      OrganizationModel.syncIndexes(),
      MembershipModel.syncIndexes(),
      InviteModel.syncIndexes(),
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
      name: 'Onboard Org',
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

  // Matrix #1
  it('returns 401 when unauthenticated', async () => {
    const res = await GET(
      buildRequest({ method: 'GET', path: '/api/onboarding/status', session: null }),
    )
    const body = await readBody<{ error: { code: string } }>(res)
    expect(res.status).toBe(401)
    expect(body.error.code).toBe(ErrorCode.UNAUTHENTICATED)
  })

  // Matrix #2 — N/A as failure: this endpoint serves the fork screen.
  // Matrix #3–6, #8–10 — N/A (no org resource, no body, read-only)

  // Matrix #7
  it('returns onboarded false and empty invites for a new user', async () => {
    const user = await users.createUser({ email: 'new@example.com', name: 'New' })

    const res = await GET(
      buildRequest({
        method: 'GET',
        path: '/api/onboarding/status',
        session: { userId: user.id, orgId: null, orgRole: null, onboarded: false },
      }),
    )

    expect(res.status).toBe(200)
    const body = await expectMatchesContract(res, authContracts.onboardingStatus.output)
    expect(body).toEqual({ onboarded: false, pendingInvites: [] })
  })

  it('returns pending invite previews matching the user email', async () => {
    const { session, org, owner } = await seedOwner()
    const invitee = await users.createUser({
      email: 'invitee@example.com',
      name: 'Invitee',
    })

    const created = await CREATE_INVITE(
      buildRequest({
        method: 'POST',
        path: '/api/invites',
        session,
        body: { email: invitee.email, orgRole: OrgRole.MEMBER },
      }),
    )
    const invite = await expectMatchesContract(created, inviteContracts.create.output)

    const res = await GET(
      buildRequest({
        method: 'GET',
        path: '/api/onboarding/status',
        session: { userId: invitee.id, orgId: null, orgRole: null, onboarded: false },
      }),
    )

    expect(res.status).toBe(200)
    const body = await expectMatchesContract(res, authContracts.onboardingStatus.output)
    expect(body.onboarded).toBe(false)
    expect(body.pendingInvites).toEqual([
      {
        orgName: org.name,
        invitedByName: owner.name,
        orgRole: OrgRole.MEMBER,
        expiresAt: invite.expiresAt,
      },
    ])
    expect(JSON.stringify(body)).not.toContain(invite.token)
  })

  it('returns onboarded true for a user with an ACTIVE membership', async () => {
    const { session } = await seedOwner()

    const res = await GET(
      buildRequest({
        method: 'GET',
        path: '/api/onboarding/status',
        session,
      }),
    )

    expect(res.status).toBe(200)
    const body = await expectMatchesContract(res, authContracts.onboardingStatus.output)
    expect(body.onboarded).toBe(true)
    expect(body.pendingInvites).toEqual([])
  })

  it('does not include invites for a different email', async () => {
    const { session } = await seedOwner()
    await CREATE_INVITE(
      buildRequest({
        method: 'POST',
        path: '/api/invites',
        session,
        body: { email: 'someone-else@example.com', orgRole: OrgRole.MEMBER },
      }),
    )
    const user = await users.createUser({ email: 'me@example.com', name: 'Me' })

    const res = await GET(
      buildRequest({
        method: 'GET',
        path: '/api/onboarding/status',
        session: { userId: user.id, orgId: null, orgRole: null, onboarded: false },
      }),
    )

    const body = await expectMatchesContract(res, authContracts.onboardingStatus.output)
    expect(body.pendingInvites).toEqual([])
  })
})
