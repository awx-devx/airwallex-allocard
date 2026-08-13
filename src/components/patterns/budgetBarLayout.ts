import { percentOf } from '@/lib/money'
import type { BudgetBarProps } from '@/components/patterns/types'

export type BudgetBarLayout = {
  actualPct: number
  committedPct: number
  remainingPct: number
  overPct: number
  isOver: boolean
}

export function budgetBarLayout(
  input: Pick<BudgetBarProps, 'approved' | 'committed' | 'actual' | 'remaining'>,
): BudgetBarLayout {
  const { approved, committed, actual, remaining } = input
  const actualPct = approved > 0 ? percentOf(actual, approved) : 0
  const committedPct = approved > 0 ? percentOf(committed, approved) : 0
  const isOver = remaining < 0
  const overPct = isOver ? (approved > 0 ? percentOf(-remaining, approved) : 100) : 0
  const remainingPct = approved > 0 && remaining > 0 ? percentOf(remaining, approved) : 0
  return { actualPct, committedPct, remainingPct, overPct, isOver }
}

/**
 * Scale actual+committed so the filled track is min(100, actualPct + committedPct).
 * overPct is a separate stripe after the track — do not fold it into the fill.
 */
export function budgetBarFillWidths(layout: BudgetBarLayout): {
  actual: number
  committed: number
} {
  const filled = layout.actualPct + layout.committedPct
  if (filled <= 100 || filled === 0) {
    return { actual: layout.actualPct, committed: layout.committedPct }
  }
  return {
    actual: Math.trunc((layout.actualPct * 100) / filled),
    committed: 100 - Math.trunc((layout.actualPct * 100) / filled),
  }
}
