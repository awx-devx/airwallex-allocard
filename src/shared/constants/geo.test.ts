import { describe, expect, it } from 'vitest'
import { countryName } from '@/lib/format/country'
import {
  ORG_COUNTRIES,
  ORG_CURRENCIES,
  countryOptions,
  currencyLabel,
  currencyOptions,
} from '@/shared/constants/geo'

describe('shared/constants/geo', () => {
  it('lists exactly the locked country set', () => {
    expect([...ORG_COUNTRIES]).toEqual([
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
    ])
  })

  it('lists exactly the locked currency set', () => {
    expect([...ORG_CURRENCIES]).toEqual([
      'AUD',
      'CAD',
      'EUR',
      'GBP',
      'HKD',
      'JPY',
      'NZD',
      'SGD',
      'USD',
    ])
  })

  it('currencyLabel returns Intl names for ISO 4217 codes', () => {
    expect(currencyLabel('USD')).toBe('US Dollar')
    expect(currencyLabel('jpy')).toBe('Japanese Yen')
  })

  it('currencyLabel returns the raw code when length is not 3 or Intl fails', () => {
    expect(currencyLabel('US')).toBe('US')
    expect(currencyLabel('XXXX')).toBe('XXXX')
    expect(currencyLabel('')).toBe('')
  })

  it('countryOptions maps ORG_COUNTRIES through countryName', () => {
    expect(countryOptions()).toEqual(
      ORG_COUNTRIES.map((value) => ({ value, label: countryName(value) })),
    )
  })

  it('currencyOptions maps ORG_CURRENCIES through currencyLabel', () => {
    expect(currencyOptions()).toEqual(
      ORG_CURRENCIES.map((value) => ({ value, label: currencyLabel(value) })),
    )
  })
})
