/**
 * Pure ledger mapping: Airwallex transaction events → budget ledger ops.
 *
 * Input: event type + amounts (minor ints) + current lifecycle summary.
 * Output: ordered ops that appendBudgetEntry will write.
 *
 * Out-of-order handling: clearing before auth converges to the same final
 * state as auth-then-clearing. See inline comments per branch.
 */
import { BudgetEntryType } from '@/shared/enums/budgetEntryType'
import { TransactionType } from '@/shared/enums/transactionType'

export type LedgerOp = {
  type:
    | typeof BudgetEntryType.COMMITMENT
    | typeof BudgetEntryType.RELEASE
    | typeof BudgetEntryType.ACTUAL
  amount: number
}

/**
 * Summary of the current lifecycle ledger state, pre-computed from existing
 * budget entries sharing the same lifecycleId.
 */
export type LifecycleLedgerSummary = {
  /** Total committed (COMMITMENT − RELEASE) for this lifecycle. */
  committed: number
  /** Total actual spend for this lifecycle. */
  actual: number
}

const EMPTY_SUMMARY: LifecycleLedgerSummary = { committed: 0, actual: 0 }

/**
 * Map an Airwallex card-transaction event to an ordered list of budget ledger ops.
 *
 * Every amount argument is a non-negative integer in minor units.
 * The only exception: CLEARING_REVERSAL produces a negative ACTUAL.
 */
export function mapEventToLedgerOps(
  eventType: TransactionType,
  amount: number,
  summary: LifecycleLedgerSummary = EMPTY_SUMMARY,
): LedgerOp[] {
  switch (eventType) {
    case TransactionType.AUTHORIZATION:
    case TransactionType.INCREMENTAL_AUTHORIZATION:
      return mapAuthorization(amount, summary)

    case TransactionType.CLEARING:
      return mapClearing(amount, summary)

    case TransactionType.PARTIAL_CLEARING:
      return mapPartialClearing(amount, summary)

    case TransactionType.REVERSAL_AUTH:
    case TransactionType.EXPIRED_AUTHORIZATION:
    case TransactionType.PARTIAL_REVERSAL:
      return mapRelease(summary)

    case TransactionType.CLEARING_REVERSAL:
      return mapClearingReversal(amount)
  }
}

/**
 * AUTHORIZATION → COMMITMENT for the authorized amount.
 *
 * Out-of-order: if CLEARING already arrived (actual > 0), immediately
 * RELEASE min(amount, actual) so committed converges to max(0, auth − cleared).
 */
function mapAuthorization(amount: number, summary: LifecycleLedgerSummary): LedgerOp[] {
  const ops: LedgerOp[] = [{ type: BudgetEntryType.COMMITMENT, amount }]

  if (summary.actual > 0) {
    const releaseAmount = Math.min(amount, summary.actual)
    ops.push({ type: BudgetEntryType.RELEASE, amount: releaseAmount })
  }

  return ops
}

/**
 * CLEARING → RELEASE matching cleared amount (capped by commitment), then ACTUAL.
 *
 * Out-of-order: if auth hasn't arrived yet, committed is 0 so RELEASE omitted.
 * When auth later arrives, mapAuthorization RELEASEs min(auth, alreadyActual).
 * Both orders converge to committed = max(0, auth − cleared), actual = cleared.
 */
function mapClearing(amount: number, summary: LifecycleLedgerSummary): LedgerOp[] {
  const ops: LedgerOp[] = []

  if (summary.committed > 0) {
    const releaseAmount = Math.min(amount, summary.committed)
    ops.push({ type: BudgetEntryType.RELEASE, amount: releaseAmount })
  }

  ops.push({ type: BudgetEntryType.ACTUAL, amount })
  return ops
}

/**
 * PARTIAL_CLEARING → partial RELEASE + ACTUAL; remainder stays committed.
 *
 * The release is min(amount, committed) — if nothing is committed
 * (out-of-order), we only record the ACTUAL.
 */
function mapPartialClearing(amount: number, summary: LifecycleLedgerSummary): LedgerOp[] {
  const ops: LedgerOp[] = []

  if (summary.committed > 0) {
    const releaseAmount = Math.min(amount, summary.committed)
    ops.push({ type: BudgetEntryType.RELEASE, amount: releaseAmount })
  }

  ops.push({ type: BudgetEntryType.ACTUAL, amount })
  return ops
}

/**
 * REVERSAL_AUTH / EXPIRED_AUTHORIZATION / PARTIAL_REVERSAL → RELEASE
 * outstanding commitment. If nothing committed (already cleared or
 * out-of-order), no-op list.
 */
function mapRelease(summary: LifecycleLedgerSummary): LedgerOp[] {
  if (summary.committed <= 0) {
    return []
  }
  return [{ type: BudgetEntryType.RELEASE, amount: summary.committed }]
}

/**
 * CLEARING_REVERSAL / refund → negative ACTUAL (restores budget).
 */
function mapClearingReversal(amount: number): LedgerOp[] {
  return [{ type: BudgetEntryType.ACTUAL, amount: -amount }]
}
