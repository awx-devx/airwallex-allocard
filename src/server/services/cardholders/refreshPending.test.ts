import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { useTestDb } from '../../../../test/helpers/db'
import type { AirwallexClient } from '@/server/airwallex/client'
import { AuditLogModel } from '@/server/models/AuditLog'
import { CardModel } from '@/server/models/Card'
import { CardholderModel } from '@/server/models/Cardholder'
import { OrganizationModel } from '@/server/models/Organization'
import { ProjectModel } from '@/server/models/Project'
import { UserModel } from '@/server/models/User'
import type { OrgContext } from '@/server/http/types'
import { resetEventPublisher } from '@/server/events/bus'
import { resetRedis } from '@/server/redis'
import { createCard, findCardById } from '@/server/repositories/cards'
import { createCardholder } from '@/server/repositories/cardholders'
import { createOrganization } from '@/server/repositories/organizations'
import { createProject } from '@/server/repositories/projects'
import * as users from '@/server/repositories/users'
import { refreshPendingCardholders } from '@/server/services/cardholders/refreshPending'
import { AllowedTransactionCount } from '@/shared/enums/allowedTransactionCount'
import { CardPurpose } from '@/shared/enums/cardPurpose'
import { CardStatus } from '@/shared/enums/cardStatus'
import { CardholderStatus } from '@/shared/enums/cardholderStatus'
import { CardholderType } from '@/shared/enums/cardholderType'
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

function mockClient(): AirwallexClient {
  return {
    accountId: null,
    forAccount: () => mockClient(),
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
      create: vi.fn().mockResolvedValue({
        card_id: 'aw_refresh_001',
        card_status: 'ACTIVE',
        card_number: '************5555',
      }),
      get: vi.fn(),
      list: vi.fn().mockResolvedValue({ has_more: false, items: [] }),
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

describe('cardholders/refreshPending', () => {
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
    vi.spyOn(console, 'info').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  it('completes PENDING card stubs even when no cardholder became READY that tick', async () => {
    const user = await users.createUser({
      email: `refresh-${Date.now()}@example.com`,
      name: 'Refresh User',
    })
    const org = await createOrganization({
      name: 'Refresh Org',
      slug: `refresh-${Date.now()}`,
      country: 'US',
      baseCurrency: 'USD',
      createdBy: user.id,
    })
    const ctx: OrgContext = { orgId: org.id, userId: user.id, orgRole: OrgRole.OWNER }
    const project = await createProject(ctx, { name: 'APAC', code: 'RFSH' })
    const cardholder = await createCardholder(ctx, {
      userId: user.id,
      airwallexCardholderId: '555b9d6b-0966-4190-9864-fc75ff4e0eb6',
      type: CardholderType.INDIVIDUAL,
      status: CardholderStatus.READY,
    })
    const stub = await createCard(ctx, {
      projectId: project.id,
      cardholderId: cardholder.id,
      airwallexCardId: 'pending:worker-stub',
      maskedNumber: '************0000',
      nickName: 'APAC — member',
      purpose: CardPurpose.MEMBER,
      status: CardStatus.PENDING,
      desiredControls: controls(),
      appliedControls: controls(),
    })

    const aw = mockClient()
    const result = await refreshPendingCardholders({ airwallex: aw })

    expect(result.becameReady).toBe(0)
    expect(result.pendingCards).toBeGreaterThanOrEqual(1)
    expect(result.cardsCompleted).toBeGreaterThanOrEqual(1)
    const hooked = await findCardById(ctx, stub.id)
    expect(hooked?.airwallexCardId).toBe('aw_refresh_001')
    expect(hooked?.status).toBe(CardStatus.ACTIVE)
    expect(aw.cards.create).toHaveBeenCalledTimes(1)
  })
})
