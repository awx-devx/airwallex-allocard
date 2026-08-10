import { beforeAll, describe, expect, it } from 'vitest'
import { useTestDb } from '../../../test/helpers/db'
import { AllowedTransactionCount } from '@/shared/enums/allowedTransactionCount'
import { CardPurpose } from '@/shared/enums/cardPurpose'
import { CardStatus } from '@/shared/enums/cardStatus'
import { CardholderStatus } from '@/shared/enums/cardholderStatus'
import { CardholderType } from '@/shared/enums/cardholderType'
import { TransactionLimitInterval } from '@/shared/enums/transactionLimitInterval'
import { toDomain } from '@/server/models/base'
import { CardModel } from '@/server/models/Card'
import { CardholderModel } from '@/server/models/Cardholder'
import type { Card } from '@/shared/types/card'
import type { Cardholder } from '@/shared/types/cardholder'

async function syncIndexes(): Promise<void> {
  await Promise.all([CardholderModel.syncIndexes(), CardModel.syncIndexes()])
}

function minimalControls(overrides: Record<string, unknown> = {}) {
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

function minimalCardholder(overrides: Record<string, unknown> = {}) {
  return {
    orgId: 'org_1',
    userId: 'user_1',
    airwallexCardholderId: 'aw_ch_1',
    type: CardholderType.INDIVIDUAL,
    status: CardholderStatus.READY,
    ...overrides,
  }
}

function minimalCard(overrides: Record<string, unknown> = {}) {
  const controls = minimalControls()
  return {
    orgId: 'org_1',
    projectId: 'proj_1',
    cardholderId: 'ch_1',
    airwallexCardId: 'aw_card_1',
    maskedNumber: '************1234',
    nickName: 'APAC Launch',
    purpose: CardPurpose.MEMBER,
    status: CardStatus.ACTIVE,
    desiredControls: controls,
    appliedControls: controls,
    ...overrides,
  }
}

describe('models/card', () => {
  useTestDb()

  beforeAll(async () => {
    await syncIndexes()
  })

  describe('Cardholder', () => {
    it('defaults status to PENDING and allows null userId for DELEGATE', async () => {
      const doc = await CardholderModel.create(
        minimalCardholder({
          userId: null,
          type: CardholderType.DELEGATE,
          airwallexCardholderId: 'aw_ch_delegate',
          status: undefined,
        }),
      )

      expect(doc.userId).toBeNull()
      expect(doc.type).toBe(CardholderType.DELEGATE)
      expect(doc.status).toBe(CardholderStatus.PENDING)
    })

    it('enforces unique (orgId, userId) when userId is set', async () => {
      await CardholderModel.create(minimalCardholder())

      await expect(
        CardholderModel.create(minimalCardholder({ airwallexCardholderId: 'aw_ch_2' })),
      ).rejects.toMatchObject({ code: 11000 })
    })

    it('allows multiple DELEGATE cardholders with null userId in the same org', async () => {
      await CardholderModel.create(
        minimalCardholder({
          userId: null,
          type: CardholderType.DELEGATE,
          airwallexCardholderId: 'aw_ch_d1',
        }),
      )
      const second = await CardholderModel.create(
        minimalCardholder({
          userId: null,
          type: CardholderType.DELEGATE,
          airwallexCardholderId: 'aw_ch_d2',
        }),
      )

      expect(second.airwallexCardholderId).toBe('aw_ch_d2')
    })

    it('allows the same userId in a different org', async () => {
      await CardholderModel.create(minimalCardholder({ orgId: 'org_1' }))
      const other = await CardholderModel.create(
        minimalCardholder({ orgId: 'org_2', airwallexCardholderId: 'aw_ch_other' }),
      )

      expect(other.orgId).toBe('org_2')
      expect(other.userId).toBe('user_1')
    })

    it('requires orgId on queries (tenantScoped)', async () => {
      await expect(CardholderModel.find({}).exec()).rejects.toThrow(
        /Tenant scope missing on Cardholder\.find/,
      )

      await CardholderModel.create(minimalCardholder())
      const docs = await CardholderModel.find({ orgId: 'org_1' }).exec()
      expect(docs).toHaveLength(1)
    })

    it('emits id and ISO dates via toJSON / toDomain', async () => {
      const doc = await CardholderModel.create(minimalCardholder())
      const domain = toDomain<Cardholder>(doc)

      expect(domain.id).toEqual(expect.any(String))
      expect(typeof domain.createdAt).toBe('string')
      expect(typeof domain.updatedAt).toBe('string')
      expect(domain.status).toBe(CardholderStatus.READY)
    })
  })

  describe('Card', () => {
    it('persists desiredControls and appliedControls; defaults arrays and nulls', async () => {
      const doc = await CardModel.create(minimalCard())

      expect(doc.categoryId).toBeNull()
      expect(doc.lastReconciledAt).toBeNull()
      expect(doc.managedByRuleIds).toEqual([])
      expect(doc.accessList).toEqual([])
      expect(doc.desiredControls.allowedTransactionCount).toBe(AllowedTransactionCount.MULTIPLE)
      expect(doc.desiredControls.transactionLimits.limits[0]?.amount).toBe(400_000)
      expect(doc.appliedControls.allowedCurrencies).toBeNull()
    })

    it('never requires PAN/CVV/expiry fields — only maskedNumber', async () => {
      const doc = await CardModel.create(minimalCard())
      const json = doc.toJSON() as Record<string, unknown>

      expect(json.maskedNumber).toBe('************1234')
      expect(json).not.toHaveProperty('pan')
      expect(json).not.toHaveProperty('cvv')
      expect(json).not.toHaveProperty('expiry')
      expect(json).not.toHaveProperty('cardNumber')
    })

    it('enforces unique (orgId, airwallexCardId)', async () => {
      await CardModel.create(minimalCard())

      await expect(CardModel.create(minimalCard({ nickName: 'Other' }))).rejects.toMatchObject({
        code: 11000,
      })
    })

    it('allows the same airwallexCardId in a different org', async () => {
      await CardModel.create(minimalCard({ orgId: 'org_1' }))
      const other = await CardModel.create(minimalCard({ orgId: 'org_2' }))

      expect(other.orgId).toBe('org_2')
      expect(other.airwallexCardId).toBe('aw_card_1')
    })

    it('requires orgId on queries (tenantScoped)', async () => {
      await expect(CardModel.find({}).exec()).rejects.toThrow(/Tenant scope missing on Card\.find/)

      await CardModel.create(minimalCard())
      const docs = await CardModel.find({ orgId: 'org_1' }).exec()
      expect(docs).toHaveLength(1)
    })

    it('emits id, ISO dates, and ISO control window via toDomain', async () => {
      const from = new Date('2026-08-01T00:00:00.000Z')
      const to = new Date('2026-12-31T23:59:59.000Z')
      const controls = minimalControls({ activeFrom: from, activeTo: to })
      const doc = await CardModel.create(
        minimalCard({ desiredControls: controls, appliedControls: controls }),
      )

      const domain = toDomain<Card>(doc)
      expect(domain.id).toEqual(expect.any(String))
      expect(typeof domain.createdAt).toBe('string')
      expect(domain.desiredControls.activeFrom).toBe(from.toISOString())
      expect(domain.desiredControls.activeTo).toBe(to.toISOString())
      expect(domain.purpose).toBe(CardPurpose.MEMBER)
      expect(domain.status).toBe(CardStatus.ACTIVE)
    })

    it('stores limit amounts as Number integers (not Decimal128)', async () => {
      const doc = await CardModel.create(minimalCard())
      const amount = doc.desiredControls.transactionLimits.limits[0]?.amount
      expect(typeof amount).toBe('number')
      expect(Number.isInteger(amount)).toBe(true)
      expect(amount).toBe(400_000)
    })
  })
})
