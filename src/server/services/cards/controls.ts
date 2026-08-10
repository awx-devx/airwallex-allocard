/**
 * Pure domain ↔ Airwallex authorization_controls mapping.
 * Domain amounts = integer minor units; Airwallex = major units.
 * Conversion happens only here.
 */
import { AppError } from '@/server/http/errors'
import { ErrorCode } from '@/shared/enums/errors'
import type { AirwallexAuthorizationControls } from '@/server/airwallex/types'
import { AllowedTransactionCount } from '@/shared/enums/allowedTransactionCount'
import { CardPurpose } from '@/shared/enums/cardPurpose'
import type { TransactionLimitInterval } from '@/shared/enums/transactionLimitInterval'
import type { CardControls } from '@/shared/types/cardControls'

/**
 * Currencies with 0 decimal places — minor units equal major units.
 * All other ISO-4217 codes use 2 decimal places (÷/× 100).
 * Extend if issuing config later lists additional zero-decimal currencies.
 */
export const ZERO_DECIMAL_CURRENCIES = new Set([
  'BIF',
  'CLP',
  'DJF',
  'GNF',
  'JPY',
  'KMF',
  'KRW',
  'MGA',
  'PYG',
  'RWF',
  'UGX',
  'VND',
  'VUV',
  'XAF',
  'XOF',
  'XPF',
])

export function currencyExponent(currency: string): 0 | 2 {
  return ZERO_DECIMAL_CURRENCIES.has(currency.toUpperCase()) ? 0 : 2
}

export function minorToMajor(amountMinor: number, currency: string): number {
  const exp = currencyExponent(currency)
  if (exp === 0) {
    return amountMinor
  }
  return amountMinor / 100
}

export function majorToMinor(amountMajor: number, currency: string): number {
  const exp = currencyExponent(currency)
  if (exp === 0) {
    return Math.round(amountMajor)
  }
  return Math.round(amountMajor * 100)
}

const ALLOWLIST_KEYS = [
  'allowedCurrencies',
  'allowedMerchantCategories',
  'allowedMerchantCountries',
  'allowedMerchantBrands',
] as const

type AllowlistKey = (typeof ALLOWLIST_KEYS)[number]

function assertAllowlistPushable(key: AllowlistKey, value: string[] | null): void {
  if (value !== null && value.length === 0) {
    throw new AppError(
      ErrorCode.CONFLICT,
      `Empty allowlist for ${key} is a conflict — never push [] to Airwallex (null/absent/[] all mean unconstrained)`,
      { field: key, retryable: false },
    )
  }
}

/** VENDOR / ONE_TIME → SINGLE; SHARED / MEMBER → MULTIPLE. */
export function purposeToTransactionCount(purpose: CardPurpose): AllowedTransactionCount {
  if (purpose === CardPurpose.VENDOR || purpose === CardPurpose.ONE_TIME) {
    return AllowedTransactionCount.SINGLE
  }
  return AllowedTransactionCount.MULTIPLE
}

/** Reject any attempt to change allowedTransactionCount after create. */
export function assertTransactionCountImmutable(
  existing: AllowedTransactionCount,
  next: AllowedTransactionCount | undefined,
): void {
  if (next !== undefined && next !== existing) {
    throw new AppError(
      ErrorCode.CONFLICT,
      'allowedTransactionCount is immutable after card create',
      {
        existing,
        next,
      },
    )
  }
}

/**
 * Map domain controls → Airwallex authorization_controls.
 * Omits allowlist fields when domain value is `null`.
 * Throws CONFLICT if any allowlist is `[]`.
 */
export function toAirwallexControls(domain: CardControls): AirwallexAuthorizationControls {
  for (const key of ALLOWLIST_KEYS) {
    assertAllowlistPushable(key, domain[key])
  }

  const currency = domain.transactionLimits.currency
  const controls: AirwallexAuthorizationControls = {
    allowed_transaction_count: domain.allowedTransactionCount,
    transaction_limits: {
      currency,
      limits: domain.transactionLimits.limits.map((limit) => ({
        interval: limit.interval,
        amount: minorToMajor(limit.amount, currency),
      })),
    },
  }

  if (domain.activeFrom !== null) {
    controls.active_from = domain.activeFrom
  }
  if (domain.activeTo !== null) {
    controls.active_to = domain.activeTo
  }

  if (domain.allowedCurrencies !== null) {
    controls.allowed_currencies = [...domain.allowedCurrencies]
  }
  if (domain.allowedMerchantCategories !== null) {
    controls.allowed_merchant_categories = [...domain.allowedMerchantCategories]
  }
  if (domain.allowedMerchantCountries !== null) {
    controls.allowed_merchant_countries = [...domain.allowedMerchantCountries]
  }
  if (domain.allowedMerchantBrands !== null) {
    controls.allowed_merchant_brands = [...domain.allowedMerchantBrands]
  }

  if (domain.blockedTransactionUsages.length > 0) {
    controls.blocked_transaction_usages = domain.blockedTransactionUsages.map((usage) => ({
      transaction_scope: usage.transactionScope,
      usage_scope: usage.usageScope,
    }))
  }

  return controls
}

/** Reverse map: Airwallex major → domain minor. Absent allowlists → null. */
export function fromAirwallexControls(aw: AirwallexAuthorizationControls): CardControls {
  const currency = aw.transaction_limits.currency
  return {
    allowedTransactionCount: aw.allowed_transaction_count,
    transactionLimits: {
      currency,
      limits: aw.transaction_limits.limits.map((limit) => ({
        interval: limit.interval as TransactionLimitInterval,
        amount: majorToMinor(limit.amount, currency),
      })),
    },
    activeFrom: aw.active_from ?? null,
    activeTo: aw.active_to ?? null,
    allowedCurrencies: aw.allowed_currencies ?? null,
    allowedMerchantCategories: aw.allowed_merchant_categories ?? null,
    allowedMerchantCountries: aw.allowed_merchant_countries ?? null,
    allowedMerchantBrands: aw.allowed_merchant_brands ?? null,
    blockedTransactionUsages: (aw.blocked_transaction_usages ?? []).map((usage) => ({
      transactionScope: usage.transaction_scope,
      usageScope: usage.usage_scope,
    })),
  }
}

function lookupMax(
  maxByCurrency: ReadonlyMap<string, number> | Readonly<Record<string, number>>,
  currency: string,
): number | undefined {
  if (typeof (maxByCurrency as ReadonlyMap<string, number>).get === 'function') {
    const map = maxByCurrency as ReadonlyMap<string, number>
    return map.get(currency.toUpperCase()) ?? map.get(currency)
  }
  const record = maxByCurrency as Readonly<Record<string, number>>
  return record[currency.toUpperCase()] ?? record[currency]
}

/**
 * Clamp each limit amount to the per-currency maximum (same unit as domain: minor).
 * `maxByCurrency` values are Airwallex major units (from issuing config).
 */
export function clampLimits(
  controls: CardControls,
  maxByCurrency: ReadonlyMap<string, number> | Readonly<Record<string, number>>,
): { controls: CardControls; clamped: boolean } {
  const maxMajor = lookupMax(maxByCurrency, controls.transactionLimits.currency)

  if (maxMajor === undefined) {
    return { controls, clamped: false }
  }

  const maxMinor = majorToMinor(maxMajor, controls.transactionLimits.currency)
  let clamped = false
  const limits = controls.transactionLimits.limits.map((limit) => {
    if (limit.amount > maxMinor) {
      clamped = true
      return { ...limit, amount: maxMinor }
    }
    return limit
  })

  if (!clamped) {
    return { controls, clamped: false }
  }

  return {
    controls: {
      ...controls,
      transactionLimits: {
        ...controls.transactionLimits,
        limits,
      },
    },
    clamped: true,
  }
}

/** Deep equality for reconciler no-op detection (order-sensitive on arrays). */
export function controlsEqual(a: CardControls, b: CardControls): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
}
