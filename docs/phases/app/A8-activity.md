# A8 — Activity & Transactions

**Track:** Application · **Powers:** B8 · **Hooks:** `useTransactions`, `useReports`

## Screens

| Route                        | Purpose                              |
| ---------------------------- | ------------------------------------ |
| `/projects/[id]/activity`    | Unified project activity feed        |
| `/transactions`              | Org-wide transactions, filterable    |
| `/transactions/[id]`         | Detail with the full lifecycle chain |
| `/transactions/declined`     | Declines, with reasons               |
| `/cards/[id]` (transactions) | Per-card history                     |
| `/receipts`                  | Missing-receipt queue                |

## Notes

**Authorizations and clearings are different things, and the UI must not pretend otherwise.** An authorization is pending money; a clearing is spent money; the amounts can differ. Show the lifecycle chain on the detail view — authorized, then cleared at a possibly different amount, or reversed, or expired. Collapsing them into one row is how a user comes to distrust the numbers.

The activity feed merges transactions, requests, approvals, card changes, access changes, and rule runs. Rule-driven entries must be visually distinct from human ones — this is where a user sees the system acting on its own, and it should be legible as such.

Declines deserve a first-class screen. A declined transaction is a policy working correctly _or_ a policy misconfigured, and the difference matters. Show the decline reason and, where it was our decision, which rule or control caused it.

Use infinite queries with cursor pagination, matching B9's semantics.

## Layout

Filter bars `flex flex-wrap gap-2`. Transaction `DataTable` scrolls inside. Timeline is already a column — keep it. Detail lifecycle chain stacks vertically. [`../../RESPONSIVENESS.md`](../../RESPONSIVENESS.md).

## States to handle

- A pending authorization not yet cleared
- A partial clearing, with the remainder still committed
- A reversal or refund
- A transaction on a since-closed card
- A missing receipt over the threshold
- An empty feed on a new project

## Review checklist

- [x] Authorization versus clearing is unambiguous
- [x] The lifecycle chain is visible on detail views
- [x] Rule-driven entries are visually distinct from human ones
- [x] Declines show a reason and, where applicable, the responsible rule
- [x] Cursor pagination is stable when new items arrive at the head
- [x] Amounts render through F2's helpers, with billing currency shown where it differs
- [x] 375px and 768px: no page-level horizontal scrollbar; filters wrap; tables may scroll internally
