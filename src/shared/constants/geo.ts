import { countryName } from '@/lib/format/country'

/** Combobox allowlist for create-org (UX only — wire schema stays length 2 / 3). */
export const ORG_COUNTRIES = [
  'AU',
  'CA',
  'DE',
  'FR',
  'GB',
  'HK',
  'IE',
  'JP',
  'NL',
  'NZ',
  'SG',
  'US',
] as const

/** Combobox allowlist for create-org base currency (UX only). */
export const ORG_CURRENCIES = [
  'AUD',
  'CAD',
  'EUR',
  'GBP',
  'HKD',
  'JPY',
  'NZD',
  'SGD',
  'USD',
] as const

export type OrgCountry = (typeof ORG_COUNTRIES)[number]
export type OrgCurrency = (typeof ORG_CURRENCIES)[number]

/** ISO 4217 display name. Invalid or non-3-letter codes pass through unchanged. */
export function currencyLabel(code: string, locale?: string): string {
  if (code.length !== 3) {
    return code
  }
  try {
    const name = new Intl.DisplayNames([locale ?? 'en'], { type: 'currency' }).of(
      code.toUpperCase(),
    )
    return name ?? code
  } catch {
    return code
  }
}

export function countryOptions(): { value: string; label: string }[] {
  return ORG_COUNTRIES.map((value) => ({ value, label: countryName(value) }))
}

export function currencyOptions(): { value: string; label: string }[] {
  return ORG_CURRENCIES.map((value) => ({ value, label: currencyLabel(value) }))
}
