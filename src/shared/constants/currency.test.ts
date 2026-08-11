import { describe, expect, it } from 'vitest'
import { ZERO_DECIMAL_CURRENCIES, currencyExponent } from '@/shared/constants/currency'

describe('shared/constants/currency', () => {
  it('lists exactly the sixteen zero-decimal ISO codes', () => {
    expect([...ZERO_DECIMAL_CURRENCIES].sort()).toEqual(
      [
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
      ].sort(),
    )
  })

  it('currencyExponent returns 0 for zero-decimal codes (case-insensitive)', () => {
    expect(currencyExponent('JPY')).toBe(0)
    expect(currencyExponent('jpy')).toBe(0)
    expect(currencyExponent('KRW')).toBe(0)
  })

  it('currencyExponent returns 2 for other ISO codes', () => {
    expect(currencyExponent('USD')).toBe(2)
    expect(currencyExponent('EUR')).toBe(2)
    expect(currencyExponent('sgd')).toBe(2)
  })
})
