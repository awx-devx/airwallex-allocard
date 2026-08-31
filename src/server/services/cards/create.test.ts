import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { useTestDb } from '../../../../test/helpers/db'
import type { AirwallexClient } from '@/server/airwallex/client'
import { cardRequestId } from '@/server/airwallex/types'
import { AuditLogModel } from '@/server/models/AuditLog'
import { CardModel } from '@/server/models/Card'
import { CardholderModel } from '@/server/models/Cardholder'
import { OrganizationModel } from '@/server/models/Organization'
import { ProjectModel } from '@/server/models/Project'
import { UserModel } from '@/server/models/User'
import type { OrgContext } from '@/server/http/types'
import { resetEventPublisher } from '@/server/events/bus'
import { resetRedis } from '@/server/redis'
import { createCard, listCards } from '@/server/repositories/cards'
import {
  createCardholder,
  updateCardholderAirwallexId,
  updateCardholderStatus,
} from '@/server/repositories/cardholders'
import { createOrganization } from '@/server/repositories/organizations'
import { createProject } from '@/server/repositories/projects'
import * as users from '@/server/repositories/users'
import { applyCardCreate } from '@/server/services/rules/apply'
import {
  AIRWALLEX_CREATED_BY_FALLBACK,
  completePendingCard,
  createCardForProject,
  isProvisionalAirwallexId,
} from '@/server/services/cards/create'
import { ActionResultStatus } from '@/shared/enums/actionResultStatus'
import { AllowedTransactionCount } from '@/shared/enums/allowedTransactionCount'
import { CardPurpose } from '@/shared/enums/cardPurpose'
import { CardStatus } from '@/shared/enums/cardStatus'
import { CardholderStatus } from '@/shared/enums/cardholderStatus'
import { CardholderType } from '@/shared/enums/cardholderType'
import { ErrorCode } from '@/shared/enums/errors'
import { OrgRole } from '@/shared/enums/orgRole'
import { TransactionLimitInterval } from '@/shared/enums/transactionLimitInterval'
import type { CardControls } from '@/shared/types/cardControls'

function controls(): CardControls {
  return {
    allowedTransactionCount: AllowedTransactionCount.MULTIPLE,
    transactionLimits: {
      currency: 'USD',
      limits: [{ interval: TransactionLimitInterval.MONTHLY, amount: 400_000 }],
    },
    activeFrom: null,
    activeTo: null,
    allowedCurrencies: null,
    allowedMerchantCategories: null,
    allowedMerchantCountries: null,
    allowedMerchantBrands: null,
    blockedTransactionUsages: [],
  }
}

function mockClient(opts: {
  listItems?: Array<{
    card_id: string
    card_status: string
    card_number?: string
    metadata?: { orgId?: string; projectId?: string; cardDocId?: string }
  }>
  createImpl?: AirwallexClient['cards']['create']
}): AirwallexClient {
  const create =
    opts.createImpl ??
    vi.fn().mockResolvedValue({
      card_id: 'aw_created_001',
      card_status: 'ACTIVE',
      card_number: '************4242',
    })
  const list = vi.fn().mockResolvedValue({
    has_more: false,
    items: opts.listItems ?? [],
  })
  return {
    accountId: null,
    forAccount: () => mockClient(opts),
    request: vi.fn(),
    cardholders: {
      create: vi.fn().mockResolvedValue({
        cardholder_id: 'bbbbbbbb-bbbb-4ccc-8ddd-eeeeeeeeeeee',
        type: 'DELEGATE',
        status: 'READY',
      }),
      get: vi.fn(),
      update: vi.fn(),
    },
    cards: {
      create,
      get: vi.fn(),
      list,
      listAllTenantsUnsafe: vi.fn(),
      update: vi.fn(),
      limits: vi.fn(),
      activate: vi.fn(),
      details: vi.fn(),
    },
    transactions: {} as AirwallexClient['transactions'],
    config: {} as AirwallexClient['config'],
    panTokens: {} as AirwallexClient['panTokens'],
  }
}

describe('services/cards/create', () => {
  useTestDb()

  beforeAll(async () => {
    await Promise.all([
      UserModel.syncIndexes(),
      OrganizationModel.syncIndexes(),
      ProjectModel.syncIndexes(),
      CardholderModel.syncIndexes(),
      CardModel.syncIndexes(),
      AuditLogModel.syncIndexes(),
    ])
  })

  beforeEach(() => {
    resetRedis()
    resetEventPublisher()
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  async function seed(name = 'Jane Doe') {
    const user = await users.createUser({
      email: `card-create-${Date.now()}-${Math.random().toString(16).slice(2)}@example.com`,
      name,
    })
    const org = await createOrganization({
      name: 'Issue Org',
      slug: `issue-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      country: 'US',
      baseCurrency: 'USD',
      createdBy: user.id,
    })
    const ctx: OrgContext = { orgId: org.id, userId: user.id, orgRole: OrgRole.OWNER }
    const project = await createProject(ctx, {
      name: 'APAC',
      code: `I-${Date.now().toString(16).slice(-6)}`,
    })
    const cardholder = await createCardholder(ctx, {
      userId: null,
      airwallexCardholderId: '555b9d6b-0966-4190-9864-fc75ff4e0eb6',
      type: CardholderType.DELEGATE,
      status: CardholderStatus.READY,
    })
    return { ctx, user, project, cardholder }
  }

  it('sends a legal display name as created_by, never the user id', async () => {
    const { ctx, user, project, cardholder } = await seed('Priya Sharma')
    const aw = mockClient({})

    await createCardForProject(
      ctx,
      project.id,
      {
        purpose: CardPurpose.MEMBER,
        cardholderId: cardholder.id,
        desiredControls: controls(),
      },
      { airwallex: aw },
    )

    expect(aw.cards.create).toHaveBeenCalledTimes(1)
    const body = vi.mocked(aw.cards.create).mock.calls[0]?.[0]
    expect(body?.created_by).toBe('Priya Sharma')
    expect(body?.created_by).not.toBe(user.id)
    expect(body?.issue_to).toBe('ORGANISATION')
    expect(body?.purpose).toBe('TEAM_EXPENSES')
    expect(body).not.toHaveProperty('cardholder_id')
    expect(body).not.toHaveProperty('is_personalized')
    expect(body).not.toHaveProperty('program')
  })

  it('sends issue_to ORGANISATION and purpose for shared cards too', async () => {
    const { ctx, project, cardholder } = await seed()
    const aw = mockClient({})

    await createCardForProject(
      ctx,
      project.id,
      {
        purpose: CardPurpose.SHARED,
        cardholderId: cardholder.id,
        desiredControls: controls(),
      },
      { airwallex: aw },
    )

    const body = vi.mocked(aw.cards.create).mock.calls[0]?.[0]
    expect(body?.issue_to).toBe('ORGANISATION')
    expect(body?.purpose).toBe('TEAM_EXPENSES')
    expect(body).not.toHaveProperty('cardholder_id')
    expect(body).not.toHaveProperty('is_personalized')
    expect(body).not.toHaveProperty('program')
  })

  it('does not send a fixture cardholder id; re-provisions to a UUID first', async () => {
    const { ctx, project, cardholder } = await seed()
    await updateCardholderAirwallexId(ctx, cardholder.id, 'ch_fixture_ready_001')
    const stub = await createCard(ctx, {
      projectId: project.id,
      cardholderId: cardholder.id,
      airwallexCardId: 'pending:fixture-ch',
      maskedNumber: '************0000',
      nickName: 'volt — member',
      purpose: CardPurpose.MEMBER,
      status: CardStatus.PENDING,
      desiredControls: controls(),
      appliedControls: controls(),
    })
    const createHolder = vi.fn().mockResolvedValue({
      cardholder_id: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
      type: 'DELEGATE',
      status: 'READY',
    })
    const aw = mockClient({})
    aw.cardholders.create = createHolder

    const hooked = await completePendingCard(ctx, stub, { airwallex: aw, useFixtures: false })

    expect(createHolder).toHaveBeenCalled()
    const body = vi.mocked(aw.cards.create).mock.calls[0]?.[0]
    expect(body).not.toHaveProperty('cardholder_id')
    expect(body?.nick_name).toBe('volt - member')
    expect(hooked.airwallexCardId).toBe('aw_created_001')
  })

  it('falls back to Allocard Operator when the actor has no name', async () => {
    const { ctx, project, cardholder } = await seed()
    const systemCtx: OrgContext = {
      orgId: ctx.orgId,
      userId: 'system',
      orgRole: OrgRole.OWNER,
    }
    const aw = mockClient({})

    await createCardForProject(
      systemCtx,
      project.id,
      {
        purpose: CardPurpose.MEMBER,
        cardholderId: cardholder.id,
        desiredControls: controls(),
      },
      { airwallex: aw },
    )

    const body = vi.mocked(aw.cards.create).mock.calls[0]?.[0]
    expect(body?.created_by).toBe(AIRWALLEX_CREATED_BY_FALLBACK)
  })

  it('attaches an existing Airwallex card by metadata.cardDocId without creating another', async () => {
    const { ctx, project, cardholder } = await seed()
    const stub = await createCard(ctx, {
      projectId: project.id,
      cardholderId: cardholder.id,
      airwallexCardId: 'pending:local-uuid',
      maskedNumber: '************0000',
      nickName: 'APAC — member',
      purpose: CardPurpose.MEMBER,
      status: CardStatus.PENDING,
      desiredControls: controls(),
      appliedControls: controls(),
    })
    const aw = mockClient({
      listItems: [
        {
          card_id: 'aw_already_issued',
          card_status: 'ACTIVE',
          card_number: '************9999',
          metadata: { orgId: ctx.orgId, projectId: project.id, cardDocId: stub.id },
        },
      ],
    })

    const hooked = await completePendingCard(ctx, stub, { airwallex: aw })

    expect(aw.cards.create).not.toHaveBeenCalled()
    expect(hooked.airwallexCardId).toBe('aw_already_issued')
    expect(hooked.maskedNumber).toBe('************9999')
    expect(hooked.status).toBe(CardStatus.ACTIVE)
    expect(isProvisionalAirwallexId(hooked.airwallexCardId)).toBe(false)
  })

  it('retries create on a provisional stub with a stable request_id', async () => {
    const { ctx, project, cardholder } = await seed()
    const stub = await createCard(ctx, {
      projectId: project.id,
      cardholderId: cardholder.id,
      airwallexCardId: 'pending:retry-me',
      maskedNumber: '************0000',
      nickName: 'APAC — member',
      purpose: CardPurpose.MEMBER,
      status: CardStatus.PENDING,
      desiredControls: controls(),
      appliedControls: controls(),
    })
    const aw = mockClient({})

    const hooked = await completePendingCard(ctx, stub, { airwallex: aw })

    expect(aw.cards.create).toHaveBeenCalledTimes(1)
    const body = vi.mocked(aw.cards.create).mock.calls[0]?.[0]
    expect(body?.request_id).toBe(cardRequestId(stub.id))
    expect(hooked.airwallexCardId).toBe('aw_created_001')
    expect(hooked.status).toBe(CardStatus.ACTIVE)
  })

  it('applyCardCreate completes a pending stub instead of skipping as already issued', async () => {
    const { ctx, user, project, cardholder } = await seed()
    await createCard(ctx, {
      projectId: project.id,
      cardholderId: cardholder.id,
      airwallexCardId: 'pending:apply-stub',
      maskedNumber: '************0000',
      nickName: 'APAC — member',
      purpose: CardPurpose.MEMBER,
      status: CardStatus.PENDING,
      desiredControls: controls(),
      appliedControls: controls(),
      accessList: [user.id],
    })
    const aw = mockClient({})

    const outcome = await applyCardCreate(
      ctx,
      {
        projectId: project.id,
        memberId: user.id,
        details: {
          purpose: CardPurpose.MEMBER,
          controls: {
            transactionLimits: controls().transactionLimits,
          },
        },
      },
      { airwallex: aw },
    )

    expect(outcome.status).toBe(ActionResultStatus.APPLIED)
    expect(outcome.message).not.toBe('already issued')
    const listed = await listCards(ctx, { projectId: project.id, purpose: CardPurpose.MEMBER })
    expect(listed.total).toBe(1)
    expect(listed.items[0]?.airwallexCardId.startsWith('pending:')).toBe(false)
    expect(listed.items[0]?.status).toBe(CardStatus.ACTIVE)
  })

  it('applyCardCreate skips a card that already has a real Airwallex id', async () => {
    const { ctx, user, project, cardholder } = await seed()
    await createCard(ctx, {
      projectId: project.id,
      cardholderId: cardholder.id,
      airwallexCardId: 'aw_real_already',
      maskedNumber: '************1234',
      nickName: 'APAC — member',
      purpose: CardPurpose.MEMBER,
      status: CardStatus.ACTIVE,
      desiredControls: controls(),
      appliedControls: controls(),
      accessList: [user.id],
    })
    const aw = mockClient({})

    const outcome = await applyCardCreate(
      ctx,
      {
        projectId: project.id,
        memberId: user.id,
        details: {
          purpose: CardPurpose.MEMBER,
          controls: { transactionLimits: controls().transactionLimits },
        },
      },
      { airwallex: aw },
    )

    expect(outcome.status).toBe(ActionResultStatus.SKIPPED)
    expect(outcome.message).toBe('already issued')
    expect(aw.cards.create).not.toHaveBeenCalled()
  })

  it('throws CONFLICT when the org DELEGATE stays PENDING', async () => {
    const { ctx, project, cardholder } = await seed()
    await updateCardholderStatus(ctx, cardholder.id, CardholderStatus.PENDING)
    const aw = mockClient({})
    aw.cardholders.get = vi.fn().mockResolvedValue({
      cardholder_id: cardholder.airwallexCardholderId,
      type: 'DELEGATE',
      status: 'PENDING',
    })

    await expect(
      createCardForProject(
        ctx,
        project.id,
        {
          purpose: CardPurpose.MEMBER,
          cardholderId: cardholder.id,
          desiredControls: controls(),
        },
        { airwallex: aw, useFixtures: false },
      ),
    ).rejects.toMatchObject({ code: ErrorCode.CONFLICT })
    expect(aw.cards.create).not.toHaveBeenCalled()
  })
})
