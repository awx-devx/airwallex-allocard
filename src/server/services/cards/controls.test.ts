import { describe, expect, it } from 'vitest'
import { ErrorCode } from '@/shared/enums/errors'
import { AllowedTransactionCount } from '@/shared/enums/allowedTransactionCount'
import { CardPurpose } from '@/shared/enums/cardPurpose'
import { TransactionLimitInterval } from '@/shared/enums/transactionLimitInterval'
import type { CardControls } from '@/shared/types/cardControls'
import {
  assertTransactionCountImmutable,
  clampLimits,
  fromAirwallexControls,
  majorToMinor,
  minorToMajor,
  purposeToTransactionCount,
  toAirwallexControls,
} from '@/server/services/cards/controls'

function baseControls(overrides: Partial<CardControls> = {}): CardControls {
  return {
    allowedTransactionCount: AllowedTransactionCount.MULTIPLE,
    transactionLimits: {
      currency: 'USD',
      limits: [
        { interval: TransactionLimitInterval.MONTHLY, amount: 400_000 },
        { interval: TransactionLimitInterval.PER_TRANSACTION, amount: 80_000 },
      ],
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

describe('cards/controls', () => {
  it('round-trips USD minor ↔ major', () => {
    expect(minorToMajor(400_000, 'USD')).toBe(4000)
    expect(majorToMinor(4000, 'USD')).toBe(400_000)

    const domain = baseControls({
      allowedCurrencies: ['USD', 'SGD'],
      blockedTransactionUsages: [{ transactionScope: 'CASH_WITHDRAWAL', usageScope: 'ALL' }],
    })
    const aw = toAirwallexControls(domain)
    expect(aw.transaction_limits.limits[0]?.amount).toBe(4000)
    expect(aw.allowed_currencies).toEqual(['USD', 'SGD'])
    expect(aw).not.toHaveProperty('allowed_merchant_categories')

    const back = fromAirwallexControls(aw)
    expect(back.transactionLimits.limits[0]?.amount).toBe(400_000)
    expect(back.allowedCurrencies).toEqual(['USD', 'SGD'])
    expect(back.allowedMerchantCategories).toBeNull()
  })

  it('throws CONFLICT on empty allowlist [] and never builds a pushable payload', () => {
    for (const field of [
      'allowedCurrencies',
      'allowedMerchantCategories',
      'allowedMerchantCountries',
      'allowedMerchantBrands',
    ] as const) {
      try {
        toAirwallexControls(baseControls({ [field]: [] }))
        expect.unreachable(`expected conflict for ${field}`)
      } catch (error) {
        expect(error).toMatchObject({
          code: ErrorCode.CONFLICT,
          details: { field },
        })
      }
    }
  })

  it('clamps amounts above config maximum and flags clamped', () => {
    const domain = baseControls({
      transactionLimits: {
        currency: 'USD',
        limits: [{ interval: TransactionLimitInterval.PER_TRANSACTION, amount: 10_000_000 }],
      },
    })
    // Airwallex max 50000 major = 5_000_000 minor
    const { controls, clamped } = clampLimits(domain, { USD: 50_000 })
    expect(clamped).toBe(true)
    expect(controls.transactionLimits.limits[0]?.amount).toBe(5_000_000)

    const noClamp = clampLimits(baseControls(), { USD: 50_000 })
    expect(noClamp.clamped).toBe(false)
  })

  it('maps purpose → SINGLE/MULTIPLE and rejects count mutation', () => {
    expect(purposeToTransactionCount(CardPurpose.VENDOR)).toBe(AllowedTransactionCount.SINGLE)
    expect(purposeToTransactionCount(CardPurpose.ONE_TIME)).toBe(AllowedTransactionCount.SINGLE)
    expect(purposeToTransactionCount(CardPurpose.SHARED)).toBe(AllowedTransactionCount.MULTIPLE)
    expect(purposeToTransactionCount(CardPurpose.MEMBER)).toBe(AllowedTransactionCount.MULTIPLE)

    expect(() =>
      assertTransactionCountImmutable(
        AllowedTransactionCount.SINGLE,
        AllowedTransactionCount.MULTIPLE,
      ),
    ).toThrow(/immutable/)

    expect(() =>
      assertTransactionCountImmutable(
        AllowedTransactionCount.SINGLE,
        AllowedTransactionCount.SINGLE,
      ),
    ).not.toThrow()
  })

  it('omits null allowlists (unconstrained) from Airwallex payload', () => {
    const aw = toAirwallexControls(baseControls())
    expect(aw).not.toHaveProperty('allowed_currencies')
    expect(aw).not.toHaveProperty('allowed_merchant_categories')
    expect(aw).not.toHaveProperty('allowed_merchant_countries')
    expect(aw).not.toHaveProperty('allowed_merchant_brands')
  })
})
