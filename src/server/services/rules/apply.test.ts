import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { useTestDb } from '../../../../test/helpers/db'
import { AirwallexError } from '@/server/airwallex/errors'
import type { AirwallexClient } from '@/server/airwallex/client'
import { CardModel } from '@/server/models/Card'
import type { OrgContext } from '@/server/http/types'
import { getRedis, redisKeys, resetRedis } from '@/server/redis'
import { createCard, findCardById } from '@/server/repositories/cards'
import { resetEventPublisher } from '@/server/events/bus'
import { applyCard, mergeIntoControls, writePolicySnapshot } from '@/server/services/rules/apply'
import type { CardPolicySnapshot } from '@/server/services/rules/apply'
import { ActionResultStatus } from '@/shared/enums/actionResultStatus'
import { AllowedTransactionCount } from '@/shared/enums/allowedTransactionCount'
import { CardPurpose } from '@/shared/enums/cardPurpose'
import { CardStatus } from '@/shared/enums/cardStatus'
import { DesiredCardStatus } from '@/shared/enums/desiredCardStatus'
import { OrgRole } from '@/shared/enums/orgRole'
import { TransactionLimitInterval } from '@/shared/enums/transactionLimitInterval'
import type { AttributeLiteral } from '@/shared/types/attribute'
import type { CardControls } from '@/shared/types/cardControls'

const NOW = new Date('2026-08-11T00:00:00.000Z')

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
      details: vi.fn(),
    },
    transactions: {} as AirwallexClient['transactions'],
    config: {} as AirwallexClient['config'],
    panTokens: {} as AirwallexClient['panTokens'],
  }
}

async function seedCard(orgCtx: OrgContext, overrides: Record<string, unknown> = {}) {
  const applied = controls()
  return createCard(orgCtx, {
    projectId: 'proj_1',
    cardholderId: 'ch_1',
    airwallexCardId: `aw_${Math.random().toString(36).slice(2)}`,
    maskedNumber: '************1234',
    nickName: 'APAC Launch',
    purpose: CardPurpose.MEMBER,
    status: CardStatus.ACTIVE,
    desiredControls: applied,
    appliedControls: applied,
    ...overrides,
  })
}

const attributeValues = new Map<string, AttributeLiteral>([['project.budget.remaining', 600_000]])

async function readSnapshot(cardId: string): Promise<CardPolicySnapshot> {
  const raw = await getRedis().get(redisKeys.policyCard(cardId))
  return JSON.parse(raw!) as CardPolicySnapshot
}

describe('rules/apply', () => {
  useTestDb()

  beforeAll(async () => {
    await CardModel.syncIndexes()
  })

  beforeEach(() => {
    resetRedis()
    resetEventPublisher()
    vi.spyOn(console, 'info').mockImplementation(() => {})
  })

  describe('mergeIntoControls', () => {
    it('keeps fields no rule contributed rather than clearing them', () => {
      const applied = controls({ allowedMerchantCategories: ['5734'] })
      const merged = mergeIntoControls(applied, {
        transactionLimits: {
          currency: 'USD',
          limits: [{ interval: TransactionLimitInterval.MONTHLY, amount: 250_000 }],
        },
      })

      expect(merged.transactionLimits.limits[0]?.amount).toBe(250_000)
      expect(merged.allowedMerchantCategories).toEqual(['5734'])
      expect(merged.allowedTransactionCount).toBe(AllowedTransactionCount.MULTIPLE)
    })
  })

  describe('policy snapshot', () => {
    it('writes the flattened hard stops in minor units and bumps version', async () => {
      const orgCtx = ctx()
      const first = await writePolicySnapshot(orgCtx, {
        cardId: 'card_1',
        projectId: 'proj_1',
        controls: controls({ allowedMerchantCategories: ['5734', '7372'] }),
        attributeValues,
        now: NOW,
      })

      expect(first.version).toBe(1)
      expect(first.orgId).toBe('org_1')
      expect(first.hardStops.projectRemaining).toBe(600_000)
      expect(first.hardStops.allowedMcc).toEqual(['5734', '7372'])
      expect(first.refreshedAt).toBe(NOW.toISOString())
      expect(await readSnapshot('card_1')).toEqual(first)

      const second = await writePolicySnapshot(orgCtx, {
        cardId: 'card_1',
        projectId: 'proj_1',
        controls: controls(),
        attributeValues,
        now: NOW,
      })
      expect(second.version).toBe(2)
    })
  })

  describe('applyCard', () => {
    it('writes the snapshot before returning and pushes the patch to Airwallex', async () => {
      const orgCtx = ctx()
      const card = await seedCard(orgCtx)
      const update = vi.fn().mockResolvedValue({})

      const outcome = await applyCard(
        orgCtx,
        {
          cardId: card.id,
          controls: {
            transactionLimits: {
              currency: 'USD',
              limits: [{ interval: TransactionLimitInterval.MONTHLY, amount: 250_000 }],
            },
          },
        },
        { attributeValues, now: NOW },
        { airwallex: mockClient(update) },
      )

      expect(outcome.status).toBe(ActionResultStatus.APPLIED)
      expect(outcome.snapshotWritten).toBe(true)
      expect(update).toHaveBeenCalledTimes(1)

      const snapshot = await readSnapshot(card.id)
      expect(snapshot.cardId).toBe(card.id)

      const stored = await findCardById(orgCtx, card.id)
      expect(stored?.desiredControls.transactionLimits.limits[0]?.amount).toBe(250_000)
      expect(stored?.appliedControls.transactionLimits.limits[0]?.amount).toBe(250_000)
    })

    it('keeps desired state and the snapshot on an Airwallex 5xx, and marks it retryable', async () => {
      const orgCtx = ctx()
      const card = await seedCard(orgCtx)
      const update = vi.fn().mockRejectedValue(
        new AirwallexError({
          status: 503,
          code: 'service_unavailable',
          message: 'upstream down',
          retryable: true,
        }),
      )

      const outcome = await applyCard(
        orgCtx,
        {
          cardId: card.id,
          controls: {
            transactionLimits: {
              currency: 'USD',
              limits: [{ interval: TransactionLimitInterval.MONTHLY, amount: 250_000 }],
            },
          },
        },
        { attributeValues, now: NOW },
        { airwallex: mockClient(update) },
      )

      expect(outcome.status).toBe(ActionResultStatus.FAILED)
      expect(outcome.retryable).toBe(true)
      expect(outcome.snapshotWritten).toBe(true)

      const stored = await findCardById(orgCtx, card.id)
      expect(stored?.desiredControls.transactionLimits.limits[0]?.amount).toBe(250_000)
      expect(stored?.appliedControls.transactionLimits.limits[0]?.amount).toBe(400_000)
      expect(await readSnapshot(card.id)).toMatchObject({ cardId: card.id })
    })

    it('freezes a card when the desired status is INACTIVE', async () => {
      const orgCtx = ctx()
      const card = await seedCard(orgCtx)
      const update = vi.fn().mockResolvedValue({})

      const outcome = await applyCard(
        orgCtx,
        { cardId: card.id, cardStatus: DesiredCardStatus.INACTIVE },
        { attributeValues, now: NOW },
        { airwallex: mockClient(update) },
      )

      expect(outcome.status).toBe(ActionResultStatus.APPLIED)
      expect((await findCardById(orgCtx, card.id))?.status).toBe(CardStatus.INACTIVE)
    })

    it('refuses CLOSED without allowDestructiveClose (B9 / Airwallex lock)', async () => {
      const orgCtx = ctx()
      const card = await seedCard(orgCtx)
      const update = vi.fn().mockResolvedValue({})

      const outcome = await applyCard(
        orgCtx,
        { cardId: card.id, cardStatus: DesiredCardStatus.CLOSED },
        { attributeValues, now: NOW },
        { airwallex: mockClient(update) },
      )

      expect(outcome.status).toBe(ActionResultStatus.FAILED)
      expect(outcome.message).toMatch(/allowDestructive/)
      expect((await findCardById(orgCtx, card.id))?.status).toBe(CardStatus.ACTIVE)
      expect(update).not.toHaveBeenCalled()
    })

    it('closes a card when allowDestructiveClose is true', async () => {
      const orgCtx = ctx()
      const card = await seedCard(orgCtx)
      const update = vi.fn().mockResolvedValue({})

      const outcome = await applyCard(
        orgCtx,
        {
          cardId: card.id,
          cardStatus: DesiredCardStatus.CLOSED,
          allowDestructiveClose: true,
        },
        { attributeValues, now: NOW },
        { airwallex: mockClient(update) },
      )

      expect(outcome.status).toBe(ActionResultStatus.APPLIED)
      expect((await findCardById(orgCtx, card.id))?.status).toBe(CardStatus.CLOSED)
      expect(update).toHaveBeenCalled()
    })

    it('returns a failure instead of throwing for a card in another org', async () => {
      const orgCtx = ctx()
      const card = await seedCard(orgCtx)

      const outcome = await applyCard(
        ctx('org_other'),
        { cardId: card.id, cardStatus: DesiredCardStatus.INACTIVE },
        { attributeValues, now: NOW },
        { airwallex: mockClient(vi.fn()) },
      )

      expect(outcome.status).toBe(ActionResultStatus.FAILED)
      expect(outcome.message).toContain('not found')
    })

    it('skips a CLOSED card — the terminal state is never reopened', async () => {
      const orgCtx = ctx()
      const card = await seedCard(orgCtx, { status: CardStatus.CLOSED })

      const outcome = await applyCard(
        orgCtx,
        { cardId: card.id, cardStatus: DesiredCardStatus.ACTIVE },
        { attributeValues, now: NOW },
        { airwallex: mockClient(vi.fn()) },
      )

      expect(outcome.status).toBe(ActionResultStatus.SKIPPED)
      expect(outcome.message).toBe('Card is CLOSED')
    })

    it('isolates failure — one bad card does not stop the next', async () => {
      const orgCtx = ctx()
      const good = await seedCard(orgCtx)
      const update = vi.fn().mockResolvedValue({})

      const first = await applyCard(
        orgCtx,
        { cardId: '000000000000000000000123', cardStatus: DesiredCardStatus.INACTIVE },
        { attributeValues, now: NOW },
        { airwallex: mockClient(update) },
      )
      const second = await applyCard(
        orgCtx,
        { cardId: good.id, cardStatus: DesiredCardStatus.INACTIVE },
        { attributeValues, now: NOW },
        { airwallex: mockClient(update) },
      )

      expect(first.status).toBe(ActionResultStatus.FAILED)
      expect(second.status).toBe(ActionResultStatus.APPLIED)
    })
  })
})
