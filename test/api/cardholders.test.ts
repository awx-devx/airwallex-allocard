import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { GET as GET_ONE } from '@/app/api/cardholders/[id]/route'
import { GET, POST } from '@/app/api/cardholders/route'
import { AuditLogModel } from '@/server/models/AuditLog'
import { CardholderModel } from '@/server/models/Cardholder'
import { MembershipModel } from '@/server/models/Membership'
import { OrganizationModel } from '@/server/models/Organization'
import { UserModel } from '@/server/models/User'
import * as memberships from '@/server/repositories/memberships'
import * as organizations from '@/server/repositories/organizations'
import * as users from '@/server/repositories/users'
import { createCardholderForOrg } from '@/server/services/cardholders/create'
import { cardholderContracts } from '@/shared/contracts/cardholder'
import { CardholderType } from '@/shared/enums/cardholderType'
import { ErrorCode } from '@/shared/enums/errors'
import { OrgRole } from '@/shared/enums/orgRole'
import { Permission } from '@/shared/enums/permissions'
import { expectMatchesContract } from '../helpers/contract'
import { useTestDb } from '../helpers/db'
import { buildRequest, installTestSessionResolver, readBody } from '../helpers/request'

describe('/api/cardholders', () => {
  useTestDb()

  beforeAll(async () => {
    await Promise.all([
      UserModel.syncIndexes(),
      OrganizationModel.syncIndexes(),
      MembershipModel.syncIndexes(),
      CardholderModel.syncIndexes(),
      AuditLogModel.syncIndexes(),
    ])
  })

  beforeEach(() => {
    vi.spyOn(console, 'info').mockImplementation(() => {})
  })

  afterEach(() => {
    installTestSessionResolver()
    vi.restoreAllMocks()
  })

  async function seedOwner() {
    const user = await users.createUser({
      email: `ch-api-${Date.now()}-${Math.random().toString(16).slice(2)}@example.com`,
      name: 'Owner',
    })
    const org = await organizations.createOrganization({
      name: 'Cardholders Org',
      slug: `org-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      country: 'US',
      baseCurrency: 'USD',
      createdBy: user.id,
    })
    const ctx = { orgId: org.id, userId: user.id, orgRole: OrgRole.OWNER }
    await memberships.createMembership(ctx, { userId: user.id, orgRole: OrgRole.OWNER })
    return {
      user,
      org,
      ctx,
      session: {
        userId: user.id,
        orgId: org.id,
        orgRole: OrgRole.OWNER,
        onboarded: true as const,
      },
    }
  }

  // Matrix #1
  it('returns 401 when unauthenticated', async () => {
    const res = await GET(buildRequest({ method: 'GET', path: '/api/cardholders', session: null }))
    expect(res.status).toBe(401)
  })

  // Matrix #2
  it('returns 403 ONBOARDING_INCOMPLETE when no org', async () => {
    const user = await users.createUser({
      email: `noorg-${Date.now()}@example.com`,
      name: 'No Org',
    })
    const res = await GET(
      buildRequest({
        method: 'GET',
        path: '/api/cardholders',
        session: { userId: user.id, orgId: null, orgRole: null, onboarded: false },
      }),
    )
    expect(res.status).toBe(403)
    const body = await readBody<{ error: { code: string } }>(res)
    expect(body.error.code).toBe(ErrorCode.ONBOARDING_INCOMPLETE)
  })

  // Matrix #7
  it('lists cardholders for the org', async () => {
    const setup = await seedOwner()
    await createCardholderForOrg(setup.ctx, { type: CardholderType.DELEGATE })

    const res = await GET(
      buildRequest({
        method: 'GET',
        path: '/api/cardholders',
        session: setup.session,
      }),
    )
    expect(res.status).toBe(200)
    const body = await expectMatchesContract(res, cardholderContracts.list.output)
    expect(body.total).toBeGreaterThanOrEqual(1)
    expect(body.items[0]?.status).toEqual(expect.any(String))
  })

  // Matrix #3 + #8
  it('GET :id returns 404 for cross-org and missing', async () => {
    const a = await seedOwner()
    const b = await seedOwner()
    const created = await createCardholderForOrg(a.ctx, { type: CardholderType.DELEGATE })

    const cross = await GET_ONE(
      buildRequest({
        method: 'GET',
        path: `/api/cardholders/${created.id}`,
        session: b.session,
        params: { id: created.id },
      }),
    )
    expect(cross.status).toBe(404)

    const missing = await GET_ONE(
      buildRequest({
        method: 'GET',
        path: '/api/cardholders/000000000000000000000000',
        session: a.session,
        params: { id: '000000000000000000000000' },
      }),
    )
    expect(missing.status).toBe(404)
  })

  // Matrix #7 get
  it('GET :id returns cardholder including screening status', async () => {
    const setup = await seedOwner()
    const created = await createCardholderForOrg(setup.ctx, { type: CardholderType.DELEGATE })

    const res = await GET_ONE(
      buildRequest({
        method: 'GET',
        path: `/api/cardholders/${created.id}`,
        session: setup.session,
        params: { id: created.id },
      }),
    )
    expect(res.status).toBe(200)
    const body = await expectMatchesContract(res, cardholderContracts.get.output)
    expect(body.id).toBe(created.id)
    expect(body.status).toEqual(expect.any(String))
  })

  // Matrix #4 — MEMBER lacks member.manage (and typically card.view via org role short-circuit for OWNER only)
  it('POST returns 403 when MEMBER lacks member.manage', async () => {
    const setup = await seedOwner()
    const member = await users.createUser({
      email: `mem-${Date.now()}@example.com`,
      name: 'Member',
    })
    await memberships.createMembership(
      { orgId: setup.org.id, userId: member.id, orgRole: OrgRole.MEMBER },
      { userId: member.id, orgRole: OrgRole.MEMBER },
    )

    const res = await POST(
      buildRequest({
        method: 'POST',
        path: '/api/cardholders',
        session: {
          userId: member.id,
          orgId: setup.org.id,
          orgRole: OrgRole.MEMBER,
          onboarded: true,
        },
        body: { type: CardholderType.DELEGATE },
      }),
    )
    expect(res.status).toBe(403)
    const body = await readBody<{ error: { code: string } }>(res)
    expect(body.error.code).toBe(ErrorCode.PERMISSION_DENIED)
    void Permission.MEMBER_MANAGE
  })

  // Matrix #7 + #10
  it('POST creates DELEGATE and writes exactly one audit', async () => {
    const setup = await seedOwner()
    const res = await POST(
      buildRequest({
        method: 'POST',
        path: '/api/cardholders',
        session: setup.session,
        body: { type: CardholderType.DELEGATE },
      }),
    )
    expect(res.status).toBe(201)
    const body = await expectMatchesContract(res, cardholderContracts.create.output)
    expect(body.type).toBe(CardholderType.DELEGATE)

    const audits = await AuditLogModel.find({
      orgId: setup.org.id,
      action: 'cardholder.created',
      subjectId: body.id,
    }).exec()
    expect(audits).toHaveLength(1)
  })
})
