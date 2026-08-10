import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { useTestDb } from '../../../../test/helpers/db'
import { AllowedTransactionCount } from '@/shared/enums/allowedTransactionCount'
import { CardPurpose } from '@/shared/enums/cardPurpose'
import { CardStatus } from '@/shared/enums/cardStatus'
import { OrgRole } from '@/shared/enums/orgRole'
import { TransactionLimitInterval } from '@/shared/enums/transactionLimitInterval'
import { ErrorCode } from '@/shared/enums/errors'
import { CardModel } from '@/server/models/Card'
import { AirwallexError } from '@/server/airwallex/errors'
import type { AirwallexClient } from '@/server/airwallex/client'
import type { OrgContext } from '@/server/http/types'
import { resetRedis } from '@/server/redis'
import { createCard, findCardById, updateDesiredControls } from '@/server/repositories/cards'
import type { CardControls } from '@/shared/types/cardControls'
import { buildControlsPatch, reconcileCard } from '@/server/services/cards/reconciler'
import { getPublishedEvents, resetEventPublisher } from '@/server/events/bus'
import { DomainEventType } from '@/server/events/types'

function ctx(orgId = 'org_1'): OrgContext {
  return { orgId, userId: 'user_1', orgRole: OrgRole.OWNER }
}

function controls(overrides: Partial<CardControls> = {}): CardControls {
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
    ...overrides,
  }
}

function mockClient(updateImpl: AirwallexClient['cards']['update']): AirwallexClient {
  return {
    accountId: null,
    forAccount: () => mockClient(updateImpl),
    request: vi.fn(),
    cardholders: {} as AirwallexClient['cardholders'],
    cards: {
      create: vi.fn(),
      get: vi.fn(),
      list: vi.fn(),
      listAllTenantsUnsafe: vi.fn(),
      update: updateImpl,
      limits: vi.fn(),
      activate: vi.fn(),
    },
    transactions: {} as AirwallexClient['transactions'],
    config: {} as AirwallexClient['config'],
    panTokens: {} as AirwallexClient['panTokens'],
  }
}

describe('cards/reconciler', () => {
  useTestDb()

  beforeAll(async () => {
    await CardModel.syncIndexes()
  })

  beforeEach(() => {
    resetRedis()
    resetEventPublisher()
    vi.spyOn(console, 'info').mockImplementation(() => {})
  })

  it('buildControlsPatch is null when desired === applied (no-op)', () => {
    const c = controls()
    expect(buildControlsPatch(c, c)).toBeNull()
  })

  it('no-op reconcile makes no Airwallex call', async () => {
    const orgCtx = ctx()
    const c = controls()
    const card = await createCard(orgCtx, {
      projectId: 'proj_1',
      cardholderId: 'ch_1',
      airwallexCardId: 'aw_card_noop',
      maskedNumber: '************1234',
      nickName: 'Noop',
      purpose: CardPurpose.MEMBER,
      status: CardStatus.ACTIVE,
      desiredControls: c,
      appliedControls: c,
      lastReconciledAt: new Date().toISOString(),
    })

    const update = vi.fn()
    const result = await reconcileCard(orgCtx, card.id, {
      airwallex: mockClient(update),
    })

    expect(update).not.toHaveBeenCalled()
    expect(result.id).toBe(card.id)
    expect(result.appliedControls).toEqual(c)
  })

  it('pushes a minimal patch and updates appliedControls; emits limit_updated', async () => {
    const orgCtx = ctx()
    const applied = controls()
    const desired = controls({
      transactionLimits: {
        currency: 'USD',
        limits: [{ interval: TransactionLimitInterval.MONTHLY, amount: 200_000 }],
      },
    })
    const card = await createCard(orgCtx, {
      projectId: 'proj_1',
      cardholderId: 'ch_1',
      airwallexCardId: 'aw_card_patch',
      maskedNumber: '************1234',
      nickName: 'Patch',
      purpose: CardPurpose.MEMBER,
      status: CardStatus.ACTIVE,
      desiredControls: desired,
      appliedControls: applied,
    })

    const update = vi.fn(async (_id, body) => {
      expect(body.authorization_controls?.transaction_limits?.limits[0]?.amount).toBe(2000)
      return {
        card_id: 'aw_card_patch',
        cardholder_id: 'ch_1',
        card_status: 'ACTIVE' as const,
      }
    })

    const result = await reconcileCard(orgCtx, card.id, {
      airwallex: mockClient(update as AirwallexClient['cards']['update']),
    })

    expect(update).toHaveBeenCalledTimes(1)
    expect(update.mock.calls[0]?.[0]).toBe('aw_card_patch')
    expect(result.appliedControls.transactionLimits.limits[0]?.amount).toBe(200_000)
    expect(result.lastReconciledAt).toEqual(expect.any(String))
    expect(
      getPublishedEvents().filter((e) => e.type === DomainEventType.CARD_LIMIT_UPDATED),
    ).toHaveLength(1)
  })

  it('on Airwallex 5xx leaves desiredControls intact and surfaces retryable upstream error', async () => {
    const orgCtx = ctx()
    const applied = controls()
    const desired = controls({
      transactionLimits: {
        currency: 'USD',
        limits: [{ interval: TransactionLimitInterval.DAILY, amount: 10_000 }],
      },
    })
    const card = await createCard(orgCtx, {
      projectId: 'proj_1',
      cardholderId: 'ch_1',
      airwallexCardId: 'aw_card_5xx',
      maskedNumber: '************9999',
      nickName: 'Fail',
      purpose: CardPurpose.SHARED,
      status: CardStatus.ACTIVE,
      desiredControls: desired,
      appliedControls: applied,
    })

    const update = vi.fn(async () => {
      throw new AirwallexError({
        status: 503,
        code: 'service_unavailable',
        message: 'unavailable',
        retryable: true,
      })
    })

    await expect(
      reconcileCard(orgCtx, card.id, {
        airwallex: mockClient(update),
      }),
    ).rejects.toMatchObject({
      code: ErrorCode.UPSTREAM_ERROR,
      details: { retryable: true },
    })

    const after = await findCardById(orgCtx, card.id)
    expect(after?.desiredControls.transactionLimits.limits[0]?.amount).toBe(10_000)
    expect(after?.appliedControls.transactionLimits.limits[0]?.amount).toBe(400_000)
  })

  it('rejects CLOSED cards with 409', async () => {
    const orgCtx = ctx()
    const c = controls({
      allowedTransactionCount: AllowedTransactionCount.SINGLE,
      transactionLimits: {
        currency: 'USD',
        limits: [{ interval: TransactionLimitInterval.PER_TRANSACTION, amount: 100 }],
      },
    })
    const card = await createCard(orgCtx, {
      projectId: 'proj_1',
      cardholderId: 'ch_1',
      airwallexCardId: 'aw_closed',
      maskedNumber: '************0000',
      nickName: 'Closed',
      purpose: CardPurpose.VENDOR,
      status: CardStatus.CLOSED,
      desiredControls: c,
      appliedControls: c,
    })

    await expect(
      reconcileCard(orgCtx, card.id, { airwallex: mockClient(vi.fn()) }),
    ).rejects.toMatchObject({ code: ErrorCode.CONFLICT })

    await updateDesiredControls(
      orgCtx,
      card.id,
      controls({
        allowedTransactionCount: AllowedTransactionCount.SINGLE,
        transactionLimits: {
          currency: 'USD',
          limits: [{ interval: TransactionLimitInterval.PER_TRANSACTION, amount: 200 }],
        },
      }),
    )
    await expect(
      reconcileCard(orgCtx, card.id, { airwallex: mockClient(vi.fn()) }),
    ).rejects.toMatchObject({ code: ErrorCode.CONFLICT })
  })
})
