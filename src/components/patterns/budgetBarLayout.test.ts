import { describe, expect, it } from 'vitest'
import { budgetBarLayout } from '@/components/patterns/budgetBarLayout'
import {
  budgetFull,
  budgetHealthy,
  budgetOver,
  budgetZero,
  budgetZeroWithSpend,
} from '@/app/dev/ui/fixtures'

describe('budgetBarLayout', () => {
  it('zero approved / zero spend', () => {
    const layout = budgetBarLayout(budgetZero)
    expect(layout).toEqual({
      actualPct: 0,
      committedPct: 0,
      remainingPct: 0,
      overPct: 0,
      isOver: false,
    })
  })

  it('zero approved with spend is over at 100', () => {
    const layout = budgetBarLayout(budgetZeroWithSpend)
    expect(layout.isOver).toBe(true)
    expect(layout.overPct).toBe(100)
  })

  it('full spend leaves remaining 0', () => {
    const layout = budgetBarLayout(budgetFull)
    expect(layout.actualPct).toBe(100)
    expect(layout.remainingPct).toBe(0)
    expect(layout.isOver).toBe(false)
  })

  it('over-budget fixture', () => {
    const layout = budgetBarLayout(budgetOver)
    expect(layout.isOver).toBe(true)
    expect(layout.overPct).toBe(20)
  })

  it('healthy fixture segments sum conceptually to 100', () => {
    const layout = budgetBarLayout(budgetHealthy)
    const sum = layout.actualPct + layout.committedPct + layout.remainingPct
    expect(sum).toBeGreaterThanOrEqual(98)
    expect(sum).toBeLessThanOrEqual(100)
    expect(layout.isOver).toBe(false)
  })
})
