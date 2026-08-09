import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { POST } from '@/app/api/budget/formula/validate/route'
import { MembershipModel } from '@/server/models/Membership'
import { OrganizationModel } from '@/server/models/Organization'
import { UserModel } from '@/server/models/User'
import * as memberships from '@/server/repositories/memberships'
import * as organizations from '@/server/repositories/organizations'
import * as users from '@/server/repositories/users'
import { budgetContracts } from '@/shared/contracts/budget'
import { ErrorCode } from '@/shared/enums/errors'
import { OrgRole } from '@/shared/enums/orgRole'
import { expectMatchesContract } from '../helpers/contract'
import { useTestDb } from '../helpers/db'
import { buildRequest, installTestSessionResolver, readBody } from '../helpers/request'

describe('/api/budget/formula/validate', () => {
  useTestDb()

  beforeAll(async () => {
    await Promise.all([
      UserModel.syncIndexes(),
      OrganizationModel.syncIndexes(),
      MembershipModel.syncIndexes(),
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
      email: `user-${Date.now()}-${Math.random().toString(16).slice(2)}@example.com`,
      name: 'Owner',
    })
    const org = await organizations.createOrganization({
      name: 'Formula Org',
      slug: `org-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      country: 'US',
      baseCurrency: 'USD',
      createdBy: user.id,
    })
    await memberships.createMembership(
      { orgId: org.id, userId: user.id, orgRole: OrgRole.OWNER },
      { userId: user.id, orgRole: OrgRole.OWNER },
    )
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

  it('returns 401 when unauthenticated', async () => {
    const res = await POST(
      buildRequest({
        method: 'POST',
        path: '/api/budget/formula/validate',
        session: null,
        body: { expression: '1+1' },
      }),
    )
    expect(res.status).toBe(401)
  })

  it('returns 403 when onboarding is incomplete', async () => {
    const user = await users.createUser({
      email: `u-${Date.now()}@example.com`,
      name: 'U',
    })
    const res = await POST(
      buildRequest({
        method: 'POST',
        path: '/api/budget/formula/validate',
        session: { userId: user.id, orgId: null, orgRole: null, onboarded: false },
        body: { expression: '1+1' },
      }),
    )
    expect(res.status).toBe(403)
    const body = await readBody<{ error: { code: string } }>(res)
    expect(body.error.code).toBe(ErrorCode.ONBOARDING_INCOMPLETE)
  })

  it('returns ok true with integer value', async () => {
    const owner = await seedOwner()
    const res = await POST(
      buildRequest({
        method: 'POST',
        path: '/api/budget/formula/validate',
        session: owner.session,
        body: {
          expression: 'pct(approvedAmount, 10)',
          context: { approvedAmount: 100_000 },
        },
      }),
    )
    expect(res.status).toBe(200)
    const body = await expectMatchesContract(res, budgetContracts.validateFormula.output)
    expect(body).toEqual({ ok: true, value: 10_000 })
  })

  it('returns ok false with error for invalid formula', async () => {
    const owner = await seedOwner()
    const res = await POST(
      buildRequest({
        method: 'POST',
        path: '/api/budget/formula/validate',
        session: owner.session,
        body: { expression: '1/0' },
      }),
    )
    expect(res.status).toBe(200)
    const body = await expectMatchesContract(res, budgetContracts.validateFormula.output)
    expect(body.ok).toBe(false)
    if (!body.ok) {
      expect(body.error.length).toBeGreaterThan(0)
    }
  })
})
