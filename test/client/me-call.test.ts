import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { GET } from '@/app/api/me/route'
import { call } from '@/client/api/client'
import { AuditLogModel } from '@/server/models/AuditLog'
import { MembershipModel } from '@/server/models/Membership'
import { OrganizationModel } from '@/server/models/Organization'
import { UserModel } from '@/server/models/User'
import * as memberships from '@/server/repositories/memberships'
import * as organizations from '@/server/repositories/organizations'
import * as users from '@/server/repositories/users'
import { authContracts } from '@/shared/contracts/auth'
import { OrgRole } from '@/shared/enums/orgRole'
import { meResponseSchema } from '@/shared/schemas/auth'
import { expectMatchesContract } from '../helpers/contract'
import { useTestDb } from '../helpers/db'
import { buildRequest, installTestSessionResolver } from '../helpers/request'

describe('meResponse contract smoke', () => {
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

  it('GET /api/me matches meResponseSchema', async () => {
    const user = await users.createUser({
      email: `f0-me-${Date.now()}@example.com`,
      name: 'F0 Me',
    })
    const org = await organizations.createOrganization({
      name: 'F0 Org',
      slug: `f0-org-${Date.now()}`,
      country: 'US',
      baseCurrency: 'USD',
      createdBy: user.id,
    })
    await memberships.createMembership(
      { orgId: org.id, userId: user.id, orgRole: OrgRole.OWNER },
      { userId: user.id, orgRole: OrgRole.OWNER },
    )

    const res = await GET(
      buildRequest({
        method: 'GET',
        path: '/api/me',
        session: {
          userId: user.id,
          orgId: org.id,
          orgRole: OrgRole.OWNER,
          onboarded: true,
        },
      }),
    )

    expect(res.status).toBe(200)
    const body = await expectMatchesContract(res, authContracts.me.output)
    const parsed = meResponseSchema.parse(body)
    expect(parsed.onboarded).toBe(true)
    expect(parsed.user).toMatchObject({
      id: user.id,
      email: expect.any(String),
      name: expect.any(String),
      createdAt: expect.any(String),
    })
    expect(parsed.memberships[0]?.org).toMatchObject({
      id: org.id,
      name: expect.any(String),
      slug: expect.any(String),
    })
  })
})

describe('call(authContracts.me)', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('builds request with orgId and parses me shape', async () => {
    const payload = {
      user: {
        id: 'u1',
        email: 'a@b.com',
        name: 'A',
        createdAt: '2020-01-01T00:00:00.000Z',
      },
      memberships: [
        {
          id: 'm1',
          orgId: 'o1',
          userId: 'u1',
          orgRole: 'OWNER' as const,
          status: 'ACTIVE' as const,
          joinedAt: '2020-01-01T00:00:00.000Z',
          org: { id: 'o1', name: 'Org', slug: 'org' },
        },
      ],
      activeOrg: {
        id: 'o1',
        name: 'Org',
        slug: 'org',
        country: 'US',
        baseCurrency: 'USD',
        costCentres: [] as string[],
        settings: { defaultApprovalPolicy: null, notifications: {} as Record<string, boolean> },
        airwallexAccountId: null,
        createdAt: '2020-01-01T00:00:00.000Z',
      },
      onboarded: true,
    }

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => payload,
    })
    vi.stubGlobal('fetch', fetchMock)

    const result = await call(authContracts.me, { orgId: 'o1' })
    expect(fetchMock.mock.calls[0]![0]).toBe('/api/me')
    expect(fetchMock.mock.calls[0]![1].headers['x-org-id']).toBe('o1')
    expect(meResponseSchema.parse(result).onboarded).toBe(true)
  })
})
