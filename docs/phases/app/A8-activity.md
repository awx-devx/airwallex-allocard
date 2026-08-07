# A8 — Activity & Transactions

**Track:** Application · **Powers:** B8 · **Hooks:** `useTransactions`, `useReports`

## Screens

| Route | Purpose |
| --- | --- |
| `/projects/[id]/activity` | Unified project activity feed |
| `/transactions` | Org-wide transactions, filterable |
| `/transactions/[id]` | Detail with the full lifecycle chain |
| `/transactions/declined` | Declines, with reasons |
| `/cards/[id]` (transactions) | Per-card history |
| `/receipts` | Missing-receipt queue |

## Notes

**Authorizations and clearings are different things, and the UI must not pretend otherwise.** An authorization is pending money; a clearing is spent money; the amounts can differ. Show the lifecycle chain on the detail view — authorized, then cleared at a possibly different amount, or reversed, or expired. Collapsing them into one row is how a user comes to distrust the numbers.

The activity feed merges transactions, requests, approvals, card changes, access changes, and rule runs. Rule-driven entries must be visually distinct from human ones — this is where a user sees the system acting on its own, and it should be legible as such.

Declines deserve a first-class screen. A declined transaction is a policy working correctly *or* a policy misconfigured, and the difference matters. Show the decline reason and, where it was our decision, which rule or control caused it.

Use infinite queries with cursor pagination, matching B9's semantics.

## States to handle

- A pending authorization not yet cleared
- A partial clearing, with the remainder still committed
- A reversal or refund
- A transaction on a since-closed card
- A missing receipt over the threshold
- An empty feed on a new project

## Review checklist

- [ ] Authorization versus clearing is unambiguous
- [ ] The lifecycle chain is visible on detail views
- [ ] Rule-driven entries are visually distinct from human ones
- [ ] Declines show a reason and, where applicable, the responsible rule
- [ ] Cursor pagination is stable when new items arrive at the head
- [ ] Amounts render through F2's helpers, with billing currency shown where it differs
