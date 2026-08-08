import { describe, expect, it } from 'vitest'
import { BudgetEntryType } from '@/shared/enums/budgetEntryType'
import { projectBudget, type ProjectionEntry } from '@/server/services/budget/projectProjection'

function entry(type: BudgetEntryType, amount: number): ProjectionEntry {
  return { type, amount }
}

describe('budget/projectProjection', () => {
  it('returns zeros for an empty ledger', () => {
    expect(projectBudget([])).toEqual({
      approved: 0,
      committed: 0,
      actual: 0,
      remaining: 0,
      utilisationPct: 0,
      overCommitted: false,
    })
  })

  it('computes a long mixed sequence', () => {
    const entries: ProjectionEntry[] = [
      entry(BudgetEntryType.APPROVAL, 100_000),
      entry(BudgetEntryType.COMMITMENT, 40_000),
      entry(BudgetEntryType.COMMITMENT, 20_000),
      entry(BudgetEntryType.RELEASE, 10_000),
      entry(BudgetEntryType.ACTUAL, 15_000),
      entry(BudgetEntryType.ADJUSTMENT, 5_000),
      entry(BudgetEntryType.ACTUAL, 5_000),
    ]

    // approved = 100000 + 5000 = 105000
    // committed = 40000 + 20000 - 10000 = 50000
    // actual = 15000 + 5000 = 20000
    // remaining = 105000 - 50000 - 20000 = 35000
    // utilisation = floor((50000+20000)*100/105000) = floor(66.66…) = 66
    expect(projectBudget(entries)).toEqual({
      approved: 105_000,
      committed: 50_000,
      actual: 20_000,
      remaining: 35_000,
      utilisationPct: 66,
      overCommitted: false,
    })
  })

  it('flags negative remaining as overCommitted (never clamps)', () => {
    const snapshot = projectBudget([
      entry(BudgetEntryType.APPROVAL, 10_000),
      entry(BudgetEntryType.COMMITMENT, 8_000),
      entry(BudgetEntryType.ACTUAL, 5_000),
    ])

    expect(snapshot.remaining).toBe(-3_000)
    expect(snapshot.overCommitted).toBe(true)
    expect(snapshot.utilisationPct).toBe(130)
  })

  it('RELEASE reduces committed', () => {
    const before = projectBudget([
      entry(BudgetEntryType.APPROVAL, 50_000),
      entry(BudgetEntryType.COMMITMENT, 30_000),
    ])
    expect(before.committed).toBe(30_000)

    const after = projectBudget([
      entry(BudgetEntryType.APPROVAL, 50_000),
      entry(BudgetEntryType.COMMITMENT, 30_000),
      entry(BudgetEntryType.RELEASE, 12_000),
    ])
    expect(after.committed).toBe(18_000)
    expect(after.remaining).toBe(32_000)
  })

  it('utilisationPct is 0 when approved is 0 and nothing spent', () => {
    expect(projectBudget([]).utilisationPct).toBe(0)
    expect(projectBudget([entry(BudgetEntryType.ADJUSTMENT, 0)]).utilisationPct).toBe(0)
  })

  it('utilisationPct is 100 when approved is 0 but committed/actual positive', () => {
    expect(projectBudget([entry(BudgetEntryType.COMMITMENT, 1)]).utilisationPct).toBe(100)
    expect(projectBudget([entry(BudgetEntryType.ACTUAL, 1)]).overCommitted).toBe(true)
  })

  it('property: random sequences are deterministic (recompute equals itself)', () => {
    const types = Object.values(BudgetEntryType)
    for (let seed = 0; seed < 50; seed += 1) {
      const entries: ProjectionEntry[] = []
      let state = seed * 997 + 13
      const next = (): number => {
        state = (state * 1103515245 + 12345) & 0x7fffffff
        return state
      }

      const count = (next() % 40) + 1
      for (let i = 0; i < count; i += 1) {
        const type = types[next() % types.length]!
        // Keep amounts small integers; ADJUSTMENT may be negative.
        const magnitude = (next() % 10_000) + 1
        const amount =
          type === BudgetEntryType.ADJUSTMENT && next() % 3 === 0 ? -magnitude : magnitude
        entries.push(entry(type, amount))
      }

      const a = projectBudget(entries)
      const b = projectBudget(entries)
      expect(a).toEqual(b)
      expect(a.remaining).toBe(a.approved - a.committed - a.actual)
      expect(a.overCommitted).toBe(a.remaining < 0)
    }
  })
})
