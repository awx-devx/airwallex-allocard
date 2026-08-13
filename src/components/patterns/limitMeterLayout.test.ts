import { describe, expect, it } from 'vitest'
import { limitMeterLayout } from '@/components/patterns/limitMeterLayout'

describe('limitMeterLayout', () => {
  it('empty when remaining === amount', () => {
    expect(limitMeterLayout({ amount: 100_000, remaining: 100_000 })).toEqual({
      used: 0,
      usedPct: 0,
      isOver: false,
    })
  })

  it('full when remaining === 0', () => {
    expect(limitMeterLayout({ amount: 100_000, remaining: 0 })).toEqual({
      used: 100_000,
      usedPct: 100,
      isOver: false,
    })
  })

  it('over when remaining < 0', () => {
    const layout = limitMeterLayout({ amount: 100_000, remaining: -5_000 })
    expect(layout.used).toBe(105_000)
    expect(layout.usedPct).toBe(105)
    expect(layout.isOver).toBe(true)
  })

  it('JPY monthly numbers', () => {
    const layout = limitMeterLayout({ amount: 500_000, remaining: 120_000 })
    expect(layout.used).toBe(380_000)
    expect(layout.usedPct).toBe(76)
    expect(layout.isOver).toBe(false)
  })
})
