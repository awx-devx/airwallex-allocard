import { describe, expect, it } from 'vitest'
import { BudgetEntryType } from '@/shared/enums/budgetEntryType'
import { TransactionType } from '@/shared/enums/transactionType'
import {
  mapEventToLedgerOps,
  type LifecycleLedgerSummary,
} from '@/server/services/transactions/ledgerMap'

const COMMITMENT = BudgetEntryType.COMMITMENT
const RELEASE = BudgetEntryType.RELEASE
const ACTUAL = BudgetEntryType.ACTUAL

function summary(committed: number, actual: number): LifecycleLedgerSummary {
  return { committed, actual }
}

describe('ledgerMap', () => {
  describe('AUTHORIZATION', () => {
    it('produces COMMITMENT for the authorized amount', () => {
      const ops = mapEventToLedgerOps(TransactionType.AUTHORIZATION, 10000)
      expect(ops).toEqual([{ type: COMMITMENT, amount: 10000 }])
    })

    it('INCREMENTAL_AUTHORIZATION also produces COMMITMENT', () => {
      const ops = mapEventToLedgerOps(
        TransactionType.INCREMENTAL_AUTHORIZATION,
        5000,
        summary(10000, 0),
      )
      expect(ops).toEqual([{ type: COMMITMENT, amount: 5000 }])
    })

    it('out-of-order: auth after clearing releases min(auth, alreadyActual)', () => {
      const ops = mapEventToLedgerOps(TransactionType.AUTHORIZATION, 10000, summary(0, 8000))
      expect(ops).toEqual([
        { type: COMMITMENT, amount: 10000 },
        { type: RELEASE, amount: 8000 },
      ])
    })

    it('out-of-order: auth after clearing where cleared > auth', () => {
      const ops = mapEventToLedgerOps(TransactionType.AUTHORIZATION, 5000, summary(0, 8000))
      expect(ops).toEqual([
        { type: COMMITMENT, amount: 5000 },
        { type: RELEASE, amount: 5000 },
      ])
    })
  })

  describe('CLEARING', () => {
    it('releases matching commitment then records ACTUAL', () => {
      const ops = mapEventToLedgerOps(TransactionType.CLEARING, 9500, summary(10000, 0))
      expect(ops).toEqual([
        { type: RELEASE, amount: 9500 },
        { type: ACTUAL, amount: 9500 },
      ])
    })

    it('out-of-order: clearing before auth omits RELEASE and records ACTUAL', () => {
      const ops = mapEventToLedgerOps(TransactionType.CLEARING, 9500)
      expect(ops).toEqual([{ type: ACTUAL, amount: 9500 }])
    })
  })

  describe('PARTIAL_CLEARING', () => {
    it('releases partial and records ACTUAL, remainder stays committed', () => {
      const ops = mapEventToLedgerOps(TransactionType.PARTIAL_CLEARING, 3000, summary(10000, 0))
      expect(ops).toEqual([
        { type: RELEASE, amount: 3000 },
        { type: ACTUAL, amount: 3000 },
      ])
    })

    it('partial clearing greater than committed releases only committed', () => {
      const ops = mapEventToLedgerOps(TransactionType.PARTIAL_CLEARING, 5000, summary(3000, 0))
      expect(ops).toEqual([
        { type: RELEASE, amount: 3000 },
        { type: ACTUAL, amount: 5000 },
      ])
    })

    it('partial clearing with no commitment (out-of-order) only records ACTUAL', () => {
      const ops = mapEventToLedgerOps(TransactionType.PARTIAL_CLEARING, 3000)
      expect(ops).toEqual([{ type: ACTUAL, amount: 3000 }])
    })
  })

  describe('REVERSAL_AUTH / EXPIRED_AUTHORIZATION', () => {
    it('REVERSAL_AUTH releases full commitment', () => {
      const ops = mapEventToLedgerOps(TransactionType.REVERSAL_AUTH, 0, summary(10000, 0))
      expect(ops).toEqual([{ type: RELEASE, amount: 10000 }])
    })

    it('EXPIRED_AUTHORIZATION releases full commitment', () => {
      const ops = mapEventToLedgerOps(TransactionType.EXPIRED_AUTHORIZATION, 0, summary(7500, 0))
      expect(ops).toEqual([{ type: RELEASE, amount: 7500 }])
    })

    it('PARTIAL_REVERSAL releases remaining commitment', () => {
      const ops = mapEventToLedgerOps(TransactionType.PARTIAL_REVERSAL, 0, summary(4000, 0))
      expect(ops).toEqual([{ type: RELEASE, amount: 4000 }])
    })

    it('release with no commitment is a no-op', () => {
      const ops = mapEventToLedgerOps(TransactionType.REVERSAL_AUTH, 0, summary(0, 5000))
      expect(ops).toEqual([])
    })
  })

  describe('CLEARING_REVERSAL', () => {
    it('produces negative ACTUAL (refund restores budget)', () => {
      const ops = mapEventToLedgerOps(TransactionType.CLEARING_REVERSAL, 5000, summary(0, 5000))
      expect(ops).toEqual([{ type: ACTUAL, amount: -5000 }])
    })
  })

  describe('out-of-order convergence', () => {
    it('clearing-then-auth converges to same final state as auth-then-clearing', () => {
      const authAmount = 10000
      const clearAmount = 9500

      // Path A: auth first, then clearing
      const authFirst = mapEventToLedgerOps(TransactionType.AUTHORIZATION, authAmount)
      const summaryAfterAuth: LifecycleLedgerSummary = { committed: authAmount, actual: 0 }
      const clearAfterAuth = mapEventToLedgerOps(
        TransactionType.CLEARING,
        clearAmount,
        summaryAfterAuth,
      )
      const opsA = [...authFirst, ...clearAfterAuth]

      // Path B: clearing first, then auth
      const clearFirst = mapEventToLedgerOps(TransactionType.CLEARING, clearAmount)
      const summaryAfterClear: LifecycleLedgerSummary = { committed: 0, actual: clearAmount }
      const authAfterClear = mapEventToLedgerOps(
        TransactionType.AUTHORIZATION,
        authAmount,
        summaryAfterClear,
      )
      const opsB = [...clearFirst, ...authAfterClear]

      // Both paths: net committed = auth - clear, net actual = clearAmount
      function netLedger(ops: Array<{ type: string; amount: number }>) {
        let committed = 0
        let actual = 0
        for (const op of ops) {
          if (op.type === COMMITMENT) committed += op.amount
          else if (op.type === RELEASE) committed -= op.amount
          else if (op.type === ACTUAL) actual += op.amount
        }
        return { committed, actual }
      }

      const expected = { committed: authAmount - clearAmount, actual: clearAmount }
      expect(netLedger(opsA)).toEqual(expected)
      expect(netLedger(opsB)).toEqual(expected)
    })

    it('partial-clearing-then-auth converges with remainder committed', () => {
      const authAmount = 10000
      const partialAmount = 3000

      // Path A: auth → partial clearing
      const summaryA: LifecycleLedgerSummary = { committed: authAmount, actual: 0 }
      const opsA = [
        ...mapEventToLedgerOps(TransactionType.AUTHORIZATION, authAmount),
        ...mapEventToLedgerOps(TransactionType.PARTIAL_CLEARING, partialAmount, summaryA),
      ]

      // Path B: partial clearing → auth
      const summaryB: LifecycleLedgerSummary = { committed: 0, actual: partialAmount }
      const opsB = [
        ...mapEventToLedgerOps(TransactionType.PARTIAL_CLEARING, partialAmount),
        ...mapEventToLedgerOps(TransactionType.AUTHORIZATION, authAmount, summaryB),
      ]

      function netLedger(ops: Array<{ type: string; amount: number }>) {
        let committed = 0
        let actual = 0
        for (const op of ops) {
          if (op.type === COMMITMENT) committed += op.amount
          else if (op.type === RELEASE) committed -= op.amount
          else if (op.type === ACTUAL) actual += op.amount
        }
        return { committed, actual }
      }

      // Both: committed = auth - partial = 7000, actual = 3000
      expect(netLedger(opsA)).toEqual({
        committed: authAmount - partialAmount,
        actual: partialAmount,
      })
      expect(netLedger(opsB)).toEqual({
        committed: authAmount - partialAmount,
        actual: partialAmount,
      })
    })
  })

  describe('expired auth RELEASE via lifecycleId', () => {
    it('expired auth after partial clearing releases only remaining commitment', () => {
      const ops = mapEventToLedgerOps(TransactionType.EXPIRED_AUTHORIZATION, 0, summary(7000, 3000))
      expect(ops).toEqual([{ type: RELEASE, amount: 7000 }])
    })
  })
})
