import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { GET as GET_CARD, PATCH } from '@/app/api/cards/[id]/route'
import { GET as GET_ORG_CARDS } from '@/app/api/cards/route'
import { GET as GET_PROJECT_CARDS, POST } from '@/app/api/projects/[id]/cards/route'
import { AuditLogModel } from '@/server/models/AuditLog'
import { CardModel } from '@/server/models/Card'
import { CardholderModel } from '@/server/models/Cardholder'
import { MembershipModel } from '@/server/models/Membership'
import { OrganizationModel } from '@/server/models/Organization'
import { ProjectModel } from '@/server/models/Project'
import { UserModel } from '@/server/models/User'
import * as memberships from '@/server/repositories/memberships'
import * as organizations from '@/server/repositories/organizations'
import * as projectsRepo from '@/server/repositories/projects'
import * as users from '@/server/repositories/users'
import { createCardholderForOrg } from '@/server/services/cardholders/create'
import { createCardForProject } from '@/server/services/cards/create'
import { cardContracts } from '@/shared/contracts/card'
import { CardPurpose } from '@/shared/enums/cardPurpose'
import { CardholderStatus } from '@/shared/enums/cardholderStatus'
import { CardholderType } from '@/shared/enums/cardholderType'
import { ErrorCode } from '@/shared/enums/errors'
import { OrgRole } from '@/shared/enums/orgRole'
import { TransactionLimitInterval } from '@/shared/enums/transactionLimitInterval'
import { makeCardControls } from '../helpers/factories'
import { expectMatchesContract } from '../helpers/contract'
import { useTestDb } from '../helpers/db'
import { buildRequest, installTestSessionResolver, readBody } from '../helpers/request'
import * as cardholdersRepo from '@/server/repositories/cardholders'

describe('/api/cards', () => {
  useTestDb()

  beforeAll(async () => {
    await Promise.all([
      UserModel.syncIndexes(),
      OrganizationModel.syncIndexes(),
      MembershipModel.syncIndexes(),
      ProjectModel.syncIndexes(),
      CardholderModel.syncIndexes(),
      CardModel.syncIndexes(),
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

  async function seedOwnerWithProject() {
    const user = await users.createUser({
      email: `cards-${Date.now()}-${Math.random().toString(16).slice(2)}@example.com`,
      name: 'Owner',
    })
    const org = await organizations.createOrganization({
      name: 'Cards Org',
      slug: `org-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      country: 'US',
      baseCurrency: 'USD',
      createdBy: user.id,
    })
    const ctx = { orgId: org.id, userId: user.id, orgRole: OrgRole.OWNER }
    await memberships.createMembership(ctx, { userId: user.id, orgRole: OrgRole.OWNER })
    const project = await projectsRepo.createProject(ctx, {
      name: 'APAC',
      code: `C-${Date.now().toString(16)}`,
    })
    const cardholder = await createCardholderForOrg(ctx, {
      type: CardholderType.DELEGATE,
    })
    // Ensure READY for issue tests (fixture returns READY).
    if (cardholder.status !== CardholderStatus.READY) {
      await cardholdersRepo.updateCardholderStatus(ctx, cardholder.id, CardholderStatus.READY)
    }
    const ready = (await cardholdersRepo.findCardholderById(ctx, cardholder.id))!
    return {
      user,
      org,
      project,
      cardholder: ready,
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
    const res = await GET_ORG_CARDS(
      buildRequest({ method: 'GET', path: '/api/cards', session: null }),
    )
    expect(res.status).toBe(401)
  })

  it('creates a card with metadata.orgId/projectId/cardDocId via Airwallex fixtures', async () => {
    const setup = await seedOwnerWithProject()
    const res = await POST(
      buildRequest({
        method: 'POST',
        path: `/api/projects/${setup.project.id}/cards`,
        session: setup.session,
        params: { id: setup.project.id },
        body: {
          purpose: CardPurpose.SHARED,
          cardholderId: setup.cardholder.id,
          nickName: 'Shared APAC',
          desiredControls: makeCardControls(),
        },
      }),
    )
    expect(res.status).toBe(201)
    const body = await expectMatchesContract(res, cardContracts.create.output)
    expect(body.projectId).toBe(setup.project.id)
    expect(body.maskedNumber).toMatch(/^\*+\d{4}$/)
    expect(body).not.toHaveProperty('pan')

    const audits = await AuditLogModel.find({
      orgId: setup.org.id,
      action: 'card.created',
      subjectId: body.id,
    }).exec()
    expect(audits).toHaveLength(1)
  })

  it('returns 409 CONFLICT when cardholder is not READY', async () => {
    const setup = await seedOwnerWithProject()
    await cardholdersRepo.updateCardholderStatus(
      setup.ctx,
      setup.cardholder.id,
      CardholderStatus.PENDING,
    )

    const res = await POST(
      buildRequest({
        method: 'POST',
        path: `/api/projects/${setup.project.id}/cards`,
        session: setup.session,
        params: { id: setup.project.id },
        body: {
          purpose: CardPurpose.SHARED,
          cardholderId: setup.cardholder.id,
          desiredControls: makeCardControls(),
        },
      }),
    )
    expect(res.status).toBe(409)
    const body = await readBody<{ error: { code: string; details?: { retryable?: boolean } } }>(res)
    expect(body.error.code).toBe(ErrorCode.CONFLICT)
    expect(body.error.details?.retryable).toBe(true)

    const cards = await CardModel.find({ orgId: setup.org.id }).exec()
    expect(cards).toHaveLength(0)
  })

  it('returns 422 for empty allowlist and never creates a card', async () => {
    const setup = await seedOwnerWithProject()
    const res = await POST(
      buildRequest({
        method: 'POST',
        path: `/api/projects/${setup.project.id}/cards`,
        session: setup.session,
        params: { id: setup.project.id },
        body: {
          purpose: CardPurpose.SHARED,
          cardholderId: setup.cardholder.id,
          desiredControls: {
            ...makeCardControls(),
            allowedCurrencies: [],
          },
        },
      }),
    )
    expect(res.status).toBe(422)
    expect(await CardModel.countDocuments({ orgId: setup.org.id })).toBe(0)
  })

  it('GET :id returns 404 cross-org', async () => {
    const a = await seedOwnerWithProject()
    const b = await seedOwnerWithProject()
    const card = await createCardForProject(a.ctx, a.project.id, {
      purpose: CardPurpose.SHARED,
      cardholderId: a.cardholder.id,
      desiredControls: makeCardControls(),
    })

    const res = await GET_CARD(
      buildRequest({
        method: 'GET',
        path: `/api/cards/${card.id}`,
        session: b.session,
        params: { id: card.id },
      }),
    )
    expect(res.status).toBe(404)
  })

  it('lists project cards and patches nickname', async () => {
    const setup = await seedOwnerWithProject()
    const card = await createCardForProject(setup.ctx, setup.project.id, {
      purpose: CardPurpose.SHARED,
      cardholderId: setup.cardholder.id,
      nickName: 'Before',
      desiredControls: makeCardControls(),
    })

    const listed = await GET_PROJECT_CARDS(
      buildRequest({
        method: 'GET',
        path: `/api/projects/${setup.project.id}/cards`,
        session: setup.session,
        params: { id: setup.project.id },
      }),
    )
    expect(listed.status).toBe(200)
    const listBody = await expectMatchesContract(listed, cardContracts.listForProject.output)
    expect(listBody.items.some((c) => c.id === card.id)).toBe(true)

    const patched = await PATCH(
      buildRequest({
        method: 'PATCH',
        path: `/api/cards/${card.id}`,
        session: setup.session,
        params: { id: card.id },
        body: { nickName: 'After' },
      }),
    )
    expect(patched.status).toBe(200)
    const body = await expectMatchesContract(patched, cardContracts.update.output)
    expect(body.nickName).toBe('After')
  })

  it('PATCH desiredControls reconciles limits', async () => {
    const setup = await seedOwnerWithProject()
    const card = await createCardForProject(setup.ctx, setup.project.id, {
      purpose: CardPurpose.SHARED,
      cardholderId: setup.cardholder.id,
      desiredControls: makeCardControls({ monthlyAmount: 400_000 }),
    })

    const res = await PATCH(
      buildRequest({
        method: 'PATCH',
        path: `/api/cards/${card.id}`,
        session: setup.session,
        params: { id: card.id },
        body: {
          desiredControls: {
            transactionLimits: {
              currency: 'USD',
              limits: [{ interval: TransactionLimitInterval.MONTHLY, amount: 100_000 }],
            },
          },
        },
      }),
    )
    expect(res.status).toBe(200)
    const body = await expectMatchesContract(res, cardContracts.update.output)
    expect(body.desiredControls.transactionLimits.limits[0]?.amount).toBe(100_000)
    expect(body.appliedControls.transactionLimits.limits[0]?.amount).toBe(100_000)
  })
})
