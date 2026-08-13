import { describe, expect, it } from 'vitest'
import { moneyDisplayText, moneySignClass } from '@/components/patterns/moneyDisplayMap'

describe('moneyDisplay', () => {
  it('formats USD with cents via formatMoney', () => {
    expect(moneyDisplayText({ amount: 402_350, currency: 'USD' })).toBe('$4,023.50')
  })

  it('formats JPY without cents', () => {
    expect(moneyDisplayText({ amount: 4023, currency: 'JPY' })).toBe('¥4,023')
  })

  it('maps sign to money token classes', () => {
    expect(moneySignClass(1)).toBe('text-money-positive')
    expect(moneySignClass(-1)).toBe('text-money-negative')
    expect(moneySignClass(0)).toBe('text-money-zero')
  })
})
