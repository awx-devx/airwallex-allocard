import { BudgetEntryType } from '@/shared/enums/budgetEntryType'
import type { BudgetSnapshot } from '@/shared/types/budget'

/** Minimal entry shape needed to recompute a projection. */
export type ProjectionEntry = {
  type: BudgetEntryType
  amount: number
}

export type BudgetProjectionValues = Omit<BudgetSnapshot, 'updatedAt'>

/**
 * Pure ledger projection — no I/O.
 *
 *   approved  = Σ(APPROVAL) + Σ(ADJUSTMENT)
 *   committed = Σ(COMMITMENT) − Σ(RELEASE)
 *   actual    = Σ(ACTUAL)
 *   remaining = approved − committed − actual
 *
 * utilisationPct = floor((committed+actual)*100/approved);
 *   if approved === 0 then (committed+actual > 0 ? 100 : 0)
 * overCommitted = remaining < 0 (never clamp remaining)
 */
export function projectBudget(entries: readonly ProjectionEntry[]): BudgetProjectionValues {
  let approved = 0
  let committed = 0
  let actual = 0

  for (const entry of entries) {
    switch (entry.type) {
      case BudgetEntryType.APPROVAL:
      case BudgetEntryType.ADJUSTMENT:
        approved += entry.amount
        break
      case BudgetEntryType.COMMITMENT:
        committed += entry.amount
        break
      case BudgetEntryType.RELEASE:
        committed -= entry.amount
        break
      case BudgetEntryType.ACTUAL:
        actual += entry.amount
        break
    }
  }

  const remaining = approved - committed - actual
  const utilised = committed + actual
  const utilisationPct =
    approved === 0 ? (utilised > 0 ? 100 : 0) : Math.floor((utilised * 100) / approved)

  return {
    approved,
    committed,
    actual,
    remaining,
    utilisationPct,
    overCommitted: remaining < 0,
  }
}
