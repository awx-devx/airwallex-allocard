import { describe, expect, it } from 'vitest'
import { mccLabel } from '@/lib/format/mcc'

describe('lib/format/mcc', () => {
  it('maps known demo codes', () => {
    expect(mccLabel('5411')).toBe('Grocery stores, supermarkets')
    expect(mccLabel('5812')).toBe('Eating places, restaurants')
    expect(mccLabel('7995')).toBe('Betting, casino gambling')
    expect(mccLabel('4111')).toBe('Local and suburban commuter transport')
  })

  it('falls back for unknown codes', () => {
    expect(mccLabel('9999')).toBe('MCC 9999')
  })
})
